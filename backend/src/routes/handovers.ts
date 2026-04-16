import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { convertToPdfCompatibleJpeg } from '../utils/image';
import {
  getCompanyCatalogRecord,
  getCompanySnapshotFromBody,
  getIssuerSnapshot,
  getPreparedByName,
  normalizeText,
  upsertCompanyCatalogRecord,
} from '../utils/documentSnapshots';
import { getUploadsDir } from '../utils/paths';

const router = Router();
router.use(authenticate);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const REQUIRED_HANDOVER_POSITIONS = ['front', 'rear', 'left-side', 'right-side'];
const toArray = (v: any) => Array.isArray(v) ? v : v ? [v] : [];

function toOptionalId(value: unknown): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanFlag(value: unknown): boolean {
  return value === '1' || value === 'true' || value === true;
}

function getHandoverSelectSql(whereClause = ''): string {
  return `
    SELECT h.*,
           h.prepared_by_name AS created_by_name,
           t.registration_number,
           t.vin,
           t.brand,
           t.type AS trailer_type,
           t.production_date,
           (
             SELECT COUNT(*)
             FROM handover_photos hp
             WHERE hp.handover_id = h.id AND hp.has_issue = 1
           ) AS issue_count
    FROM handovers h
    JOIN trailers t ON h.trailer_id = t.id
    ${whereClause}
  `;
}

function ensureExistingCompanyId(companyId: number | null): number | null {
  if (!companyId) return null;
  const db = getDb();
  const company = getCompanyCatalogRecord(db, companyId);
  return company ? companyId : null;
}

const storage = multer.diskStorage({
  destination: getUploadsDir(),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Niedozwolony format pliku: ${file.mimetype}. Dozwolone: jpg, jpeg, png`));
    }
  },
});

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status } = req.query;
  let query = getHandoverSelectSql();
  const params: any[] = [];
  if (status) {
    query += ' WHERE h.status = ?';
    params.push(status);
  }
  query += ' ORDER BY h.created_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const handover = db.prepare(`${getHandoverSelectSql('WHERE h.id = ?')}`).get(Number(req.params.id));

  if (!handover) {
    res.status(404).json({ error: 'Handover not found' });
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(Number(req.params.id));

  const returnRecord = db.prepare(
    `SELECT r.*, r.prepared_by_name AS created_by_name
     FROM returns r
     WHERE r.handover_id = ?`
  ).get(Number(req.params.id)) as any | undefined;

  let returnPhotos: any[] = [];
  if (returnRecord) {
    returnPhotos = db.prepare(
      'SELECT * FROM return_photos WHERE return_id = ? ORDER BY id'
    ).all(returnRecord.id) as any[];
  }

  res.json({
    ...handover,
    photos,
    return: returnRecord ? { ...returnRecord, photos: returnPhotos } : null,
  });
});

router.post('/', upload.array('photos', 20), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      company_id: existingCompanyId,
      save_company_to_db,
      registration_number, vin, brand, trailer_type, production_date,
      trailer_id: existingTrailerId,
      handover_date, handover_time, equipment_notes,
      has_documents, beams_count, straps_count,
      photo_positions, photo_descriptions,
      photo_has_issues, photo_issue_descriptions,
      inherited_photo_filenames, inherited_photo_positions, inherited_photo_descriptions,
      inherited_photo_has_issues, inherited_photo_issue_descriptions,
    } = req.body;

    const companySnapshot = getCompanySnapshotFromBody(req.body);
    const selectedCompanyId = ensureExistingCompanyId(toOptionalId(existingCompanyId));
    const shouldSaveCompanyToDb = toBooleanFlag(save_company_to_db);
    const normalizedRegistration = normalizeText(registration_number);

    if (!companySnapshot.company_name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    let companyId = selectedCompanyId;
    if (shouldSaveCompanyToDb) {
      companyId = upsertCompanyCatalogRecord(db, companySnapshot, selectedCompanyId);
    }

    const issuerSnapshot = getIssuerSnapshot(db);
    const preparedByName = getPreparedByName(db, req.user!.userId);

    let trailerId = existingTrailerId ? Number(existingTrailerId) : null;
    if (!trailerId) {
      if (!normalizedRegistration || !trailer_type) {
        res.status(400).json({ error: 'Registration number and trailer type are required' });
        return;
      }

      const existingTrailer = db.prepare(
        `SELECT id
         FROM trailers
         WHERE UPPER(TRIM(registration_number)) = UPPER(TRIM(?))
         LIMIT 1`
      ).get(normalizedRegistration) as { id: number } | undefined;

      if (existingTrailer) {
        trailerId = existingTrailer.id;
      } else {
        const result = db.prepare(
          'INSERT INTO trailers (registration_number, vin, brand, type, production_date) VALUES (?, ?, ?, ?, ?)'
        ).run(normalizedRegistration, vin || '', brand || '', trailer_type, production_date || '');
        trailerId = Number(result.lastInsertRowid);
      }
    }

    const activeHandover = db.prepare(
      `SELECT h.id, t.registration_number
       FROM handovers h
       JOIN trailers t ON t.id = h.trailer_id
       WHERE h.trailer_id = ? AND h.status = 'active'
       LIMIT 1`
    ).get(trailerId) as { id: number; registration_number: string } | undefined;

    if (activeHandover) {
      res.status(409).json({
        error: `Trailer ${activeHandover.registration_number} is already handed over and must be returned first`,
      });
      return;
    }

    const handoverResult = db.prepare(`
      INSERT INTO handovers (
        company_id, trailer_id, created_by,
        company_name, company_address_line1, company_address_line2, company_postal_code,
        company_tax_id, company_phone, company_email, company_contact,
        issuer_name, issuer_address, issuer_tax_id, issuer_phone, issuer_email, prepared_by_name,
        handover_date, handover_time, equipment_notes, has_documents, beams_count, straps_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      trailerId,
      req.user!.userId,
      companySnapshot.company_name,
      companySnapshot.company_address_line1,
      companySnapshot.company_address_line2,
      companySnapshot.company_postal_code,
      companySnapshot.company_tax_id,
      companySnapshot.company_phone,
      companySnapshot.company_email,
      companySnapshot.company_contact,
      issuerSnapshot.issuer_name,
      issuerSnapshot.issuer_address,
      issuerSnapshot.issuer_tax_id,
      issuerSnapshot.issuer_phone,
      issuerSnapshot.issuer_email,
      preparedByName,
      handover_date,
      handover_time,
      equipment_notes || '',
      has_documents === '1' || has_documents === 'true' ? 1 : 0,
      Number(beams_count) || 0,
      Number(straps_count) || 0,
    );
    const handoverId = Number(handoverResult.lastInsertRowid);

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = toArray(photo_positions);
    const descriptions = toArray(photo_descriptions);
    const hasIssues = toArray(photo_has_issues);
    const issueDescs = toArray(photo_issue_descriptions);

    const UPLOADS_DIR = getUploadsDir();
    await Promise.all(files.map(f => convertToPdfCompatibleJpeg(path.join(UPLOADS_DIR, f.filename))));

    const insertPhoto = db.prepare(
      'INSERT INTO handover_photos (handover_id, file_path, position_on_template, description, has_issue, issue_description) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (let i = 0; i < files.length; i++) {
      insertPhoto.run(
        handoverId,
        files[i].filename,
        positions[i] || 'front',
        descriptions[i] || '',
        hasIssues[i] === '1' || hasIssues[i] === 'true' ? 1 : 0,
        issueDescs[i] || ''
      );
    }

    const inhFilenames = toArray(inherited_photo_filenames);
    const inhPositions = toArray(inherited_photo_positions);
    const inhDescriptions = toArray(inherited_photo_descriptions);
    const inhHasIssues = toArray(inherited_photo_has_issues);
    const inhIssueDescs = toArray(inherited_photo_issue_descriptions);

    const submittedPositions = new Set<string>();
    for (let i = 0; i < files.length; i++) {
      submittedPositions.add((positions[i] || 'front').toString().trim());
    }
    for (let i = 0; i < inhFilenames.length; i++) {
      submittedPositions.add((inhPositions[i] || 'front').toString().trim());
    }

    const missingRequiredPositions = REQUIRED_HANDOVER_POSITIONS.filter(
      (position) => !submittedPositions.has(position)
    );
    if (missingRequiredPositions.length > 0) {
      res.status(400).json({
        error: 'Missing required handover photos',
        missing_positions: missingRequiredPositions,
      });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const hasIssue = hasIssues[i] === '1' || hasIssues[i] === 'true';
      if (hasIssue && !String(issueDescs[i] || '').trim()) {
        res.status(400).json({
          error: 'Issue description is required when issue is marked',
          position: positions[i] || 'front',
        });
        return;
      }
    }

    for (let i = 0; i < inhFilenames.length; i++) {
      const hasIssue = inhHasIssues[i] === '1' || inhHasIssues[i] === 'true';
      if (hasIssue && !String(inhIssueDescs[i] || '').trim()) {
        res.status(400).json({
          error: 'Issue description is required when issue is marked',
          position: inhPositions[i] || 'front',
        });
        return;
      }
    }

    for (let i = 0; i < inhFilenames.length; i++) {
      const originalFilename = inhFilenames[i];
      const originalPath = path.join(UPLOADS_DIR, originalFilename);
      if (fs.existsSync(originalPath)) {
        const ext = path.extname(originalFilename);
        const newFilename = `${uuidv4()}${ext}`;
        const newPath = path.join(UPLOADS_DIR, newFilename);
        fs.copyFileSync(originalPath, newPath);
        insertPhoto.run(
          handoverId,
          newFilename,
          inhPositions[i] || 'front',
          inhDescriptions[i] || '',
          inhHasIssues[i] === '1' || inhHasIssues[i] === 'true' ? 1 : 0,
          inhIssueDescs[i] || ''
        );
      }
    }

    res.status(201).json({ id: handoverId, message: 'Handover created' });
  } catch (err) {
    console.error('Create handover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireAdmin, upload.array('photos', 20), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const handoverId = Number(req.params.id);
    if (!Number.isFinite(handoverId)) {
      res.status(400).json({ error: 'Invalid handover id' });
      return;
    }

    const existingHandover = db.prepare(`
      SELECT id, company_id, trailer_id, status
      FROM handovers
      WHERE id = ?
    `).get(handoverId) as
      | { id: number; company_id: number | null; trailer_id: number; status: 'active' | 'returned' }
      | undefined;

    if (!existingHandover) {
      res.status(404).json({ error: 'Handover not found' });
      return;
    }

    const {
      company_id: existingCompanyId,
      save_company_to_db,
      registration_number, vin, brand, trailer_type, production_date,
      trailer_id: existingTrailerId,
      handover_date, handover_time, equipment_notes,
      has_documents, beams_count, straps_count,
      photo_positions, photo_descriptions,
      photo_has_issues, photo_issue_descriptions,
      inherited_photo_filenames, inherited_photo_positions, inherited_photo_descriptions,
      inherited_photo_has_issues, inherited_photo_issue_descriptions,
    } = req.body;

    const companySnapshot = getCompanySnapshotFromBody(req.body);
    const selectedCompanyId = ensureExistingCompanyId(toOptionalId(existingCompanyId));
    const shouldSaveCompanyToDb = toBooleanFlag(save_company_to_db);
    const normalizedRegistration = normalizeText(registration_number);

    if (!companySnapshot.company_name) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }

    let companyId = selectedCompanyId;
    if (shouldSaveCompanyToDb) {
      companyId = upsertCompanyCatalogRecord(db, companySnapshot, selectedCompanyId);
    }

    const issuerSnapshot = getIssuerSnapshot(db);
    const preparedByName = getPreparedByName(db, req.user!.userId);

    let trailerId = existingTrailerId ? Number(existingTrailerId) : null;
    if (!trailerId) {
      if (!normalizedRegistration || !trailer_type) {
        res.status(400).json({ error: 'Registration number and trailer type are required' });
        return;
      }

      const existingTrailer = db.prepare(
        `SELECT id
         FROM trailers
         WHERE UPPER(TRIM(registration_number)) = UPPER(TRIM(?))
         LIMIT 1`
      ).get(normalizedRegistration) as { id: number } | undefined;

      if (existingTrailer) {
        trailerId = existingTrailer.id;
      } else {
        const result = db.prepare(
          'INSERT INTO trailers (registration_number, vin, brand, type, production_date) VALUES (?, ?, ?, ?, ?)'
        ).run(normalizedRegistration, vin || '', brand || '', trailer_type, production_date || '');
        trailerId = Number(result.lastInsertRowid);
      }
    }

    if (existingHandover.status === 'active') {
      const activeHandover = db.prepare(
        `SELECT h.id, t.registration_number
         FROM handovers h
         JOIN trailers t ON t.id = h.trailer_id
         WHERE h.trailer_id = ? AND h.status = 'active' AND h.id != ?
         LIMIT 1`
      ).get(trailerId, handoverId) as { id: number; registration_number: string } | undefined;

      if (activeHandover) {
        res.status(409).json({
          error: `Trailer ${activeHandover.registration_number} is already handed over and must be returned first`,
        });
        return;
      }
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = toArray(photo_positions);
    const descriptions = toArray(photo_descriptions);
    const hasIssues = toArray(photo_has_issues);
    const issueDescs = toArray(photo_issue_descriptions);
    const inhFilenames = toArray(inherited_photo_filenames);
    const inhPositions = toArray(inherited_photo_positions);
    const inhDescriptions = toArray(inherited_photo_descriptions);
    const inhHasIssues = toArray(inherited_photo_has_issues);
    const inhIssueDescs = toArray(inherited_photo_issue_descriptions);

    const submittedPositions = new Set<string>();
    for (let i = 0; i < files.length; i++) {
      submittedPositions.add((positions[i] || 'front').toString().trim());
    }
    for (let i = 0; i < inhFilenames.length; i++) {
      submittedPositions.add((inhPositions[i] || 'front').toString().trim());
    }

    const missingRequiredPositions = REQUIRED_HANDOVER_POSITIONS.filter(
      (position) => !submittedPositions.has(position)
    );
    if (missingRequiredPositions.length > 0) {
      res.status(400).json({
        error: 'Missing required handover photos',
        missing_positions: missingRequiredPositions,
      });
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const hasIssue = hasIssues[i] === '1' || hasIssues[i] === 'true';
      if (hasIssue && !String(issueDescs[i] || '').trim()) {
        res.status(400).json({
          error: 'Issue description is required when issue is marked',
          position: positions[i] || 'front',
        });
        return;
      }
    }

    for (let i = 0; i < inhFilenames.length; i++) {
      const hasIssue = inhHasIssues[i] === '1' || inhHasIssues[i] === 'true';
      if (hasIssue && !String(inhIssueDescs[i] || '').trim()) {
        res.status(400).json({
          error: 'Issue description is required when issue is marked',
          position: inhPositions[i] || 'front',
        });
        return;
      }
    }

    const UPLOADS_DIR = getUploadsDir();
    await Promise.all(files.map((f) => convertToPdfCompatibleJpeg(path.join(UPLOADS_DIR, f.filename))));

    const previousPhotos = db.prepare(
      'SELECT file_path FROM handover_photos WHERE handover_id = ?'
    ).all(handoverId) as Array<{ file_path: string }>;

    const updateHandover = db.transaction(() => {
      db.prepare(`
        UPDATE handovers
        SET company_id = ?,
            company_name = ?,
            company_address_line1 = ?,
            company_address_line2 = ?,
            company_postal_code = ?,
            company_tax_id = ?,
            company_phone = ?,
            company_email = ?,
            company_contact = ?,
            issuer_name = ?,
            issuer_address = ?,
            issuer_tax_id = ?,
            issuer_phone = ?,
            issuer_email = ?,
            prepared_by_name = ?,
            trailer_id = ?,
            handover_date = ?,
            handover_time = ?,
            equipment_notes = ?,
            has_documents = ?,
            beams_count = ?,
            straps_count = ?
        WHERE id = ?
      `).run(
        companyId,
        companySnapshot.company_name,
        companySnapshot.company_address_line1,
        companySnapshot.company_address_line2,
        companySnapshot.company_postal_code,
        companySnapshot.company_tax_id,
        companySnapshot.company_phone,
        companySnapshot.company_email,
        companySnapshot.company_contact,
        issuerSnapshot.issuer_name,
        issuerSnapshot.issuer_address,
        issuerSnapshot.issuer_tax_id,
        issuerSnapshot.issuer_phone,
        issuerSnapshot.issuer_email,
        preparedByName,
        trailerId,
        handover_date,
        handover_time,
        equipment_notes || '',
        has_documents === '1' || has_documents === 'true' ? 1 : 0,
        Number(beams_count) || 0,
        Number(straps_count) || 0,
        handoverId
      );

      db.prepare('DELETE FROM handover_photos WHERE handover_id = ?').run(handoverId);

      const insertPhoto = db.prepare(
        'INSERT INTO handover_photos (handover_id, file_path, position_on_template, description, has_issue, issue_description) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (let i = 0; i < files.length; i++) {
        insertPhoto.run(
          handoverId,
          files[i].filename,
          positions[i] || 'front',
          descriptions[i] || '',
          hasIssues[i] === '1' || hasIssues[i] === 'true' ? 1 : 0,
          issueDescs[i] || ''
        );
      }

      for (let i = 0; i < inhFilenames.length; i++) {
        const originalFilename = inhFilenames[i];
        const originalPath = path.join(UPLOADS_DIR, originalFilename);
        if (fs.existsSync(originalPath)) {
          const ext = path.extname(originalFilename);
          const newFilename = `${uuidv4()}${ext}`;
          const newPath = path.join(UPLOADS_DIR, newFilename);
          fs.copyFileSync(originalPath, newPath);
          insertPhoto.run(
            handoverId,
            newFilename,
            inhPositions[i] || 'front',
            inhDescriptions[i] || '',
            inhHasIssues[i] === '1' || inhHasIssues[i] === 'true' ? 1 : 0,
            inhIssueDescs[i] || ''
          );
        }
      }
    });

    updateHandover();

    for (const photo of previousPhotos) {
      const filePath = path.join(UPLOADS_DIR, photo.file_path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('[handovers] Failed to remove previous photo file:', filePath, err);
        }
      }
    }

    res.json({ id: handoverId, message: 'Handover updated' });
  } catch (err) {
    console.error('Update handover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const handoverId = Number(req.params.id);
    if (!Number.isFinite(handoverId)) {
      res.status(400).json({ error: 'Invalid handover id' });
      return;
    }

    const handover = db.prepare('SELECT id FROM handovers WHERE id = ?').get(handoverId);
    if (!handover) {
      res.status(404).json({ error: 'Handover not found' });
      return;
    }

    const handoverPhotos = db.prepare(
      'SELECT file_path FROM handover_photos WHERE handover_id = ?'
    ).all(handoverId) as Array<{ file_path: string }>;
    const returnPhotos = db.prepare(`
      SELECT rp.file_path
      FROM return_photos rp
      JOIN returns r ON r.id = rp.return_id
      WHERE r.handover_id = ?
    `).all(handoverId) as Array<{ file_path: string }>;

    const removeData = db.transaction(() => {
      db.prepare(
        `DELETE FROM return_photos
         WHERE return_id IN (SELECT id FROM returns WHERE handover_id = ?)`
      ).run(handoverId);
      db.prepare('DELETE FROM returns WHERE handover_id = ?').run(handoverId);
      db.prepare('DELETE FROM handover_photos WHERE handover_id = ?').run(handoverId);
      db.prepare('DELETE FROM handovers WHERE id = ?').run(handoverId);
    });
    removeData();

    for (const photo of [...handoverPhotos, ...returnPhotos]) {
      const filePath = path.join(getUploadsDir(), photo.file_path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('[handovers] Failed to remove photo file:', filePath, err);
        }
      }
    }

    res.json({ message: 'Handover deleted' });
  } catch (err) {
    console.error('Delete handover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
