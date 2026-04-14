import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { convertToPdfCompatibleJpeg } from '../utils/image';

const router = Router();
router.use(authenticate);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
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
  let query = `
    SELECT h.*, c.name as company_name, t.registration_number, t.type as trailer_type,
           t.production_date, u.full_name as created_by_name
    FROM handovers h
    JOIN companies c ON h.company_id = c.id
    JOIN trailers t ON h.trailer_id = t.id
    JOIN users u ON h.created_by = u.id
  `;
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
  const handover = db.prepare(`
    SELECT h.*, c.name as company_name, c.address as company_address,
           c.phone as company_phone, c.email as company_email, c.contact_person as company_contact,
           t.registration_number, t.vin, t.brand, t.type as trailer_type,
           t.production_date, u.full_name as created_by_name
    FROM handovers h
    JOIN companies c ON h.company_id = c.id
    JOIN trailers t ON h.trailer_id = t.id
    JOIN users u ON h.created_by = u.id
    WHERE h.id = ?
  `).get(Number(req.params.id));

  if (!handover) {
    res.status(404).json({ error: 'Handover not found' });
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(Number(req.params.id));

  const returnRecord = db.prepare(
    'SELECT r.*, u.full_name as created_by_name FROM returns r JOIN users u ON r.created_by = u.id WHERE r.handover_id = ?'
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
      company_name, company_address, company_phone, company_email, company_contact,
      company_id: existingCompanyId,
      registration_number, vin, brand, trailer_type, production_date,
      trailer_id: existingTrailerId,
      handover_date, handover_time, equipment_notes,
      has_documents, beams_count, straps_count,
      photo_positions, photo_descriptions,
      photo_has_issues, photo_issue_descriptions,
      inherited_photo_filenames, inherited_photo_positions, inherited_photo_descriptions,
      inherited_photo_has_issues, inherited_photo_issue_descriptions,
    } = req.body;

    const normalizedCompanyName = (company_name || '').trim();
    const normalizedCompanyContact = (company_contact || '').trim();
    const normalizedRegistration = (registration_number || '').trim();

    let companyId = existingCompanyId ? Number(existingCompanyId) : null;
    if (!companyId) {
      if (!normalizedCompanyName) {
        res.status(400).json({ error: 'Company name is required' });
        return;
      }

      const companies = db.prepare(
        `SELECT id, contact_person
         FROM companies
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         ORDER BY id DESC`
      ).all(normalizedCompanyName) as Array<{ id: number; contact_person: string }>;

      if (companies.length > 0) {
        if (!normalizedCompanyContact) {
          companyId = companies[0].id;
        } else {
          const exactContactMatch = companies.find(
            (company) => (company.contact_person || '').trim().toLowerCase() === normalizedCompanyContact.toLowerCase()
          );
          companyId = exactContactMatch ? exactContactMatch.id : companies[0].id;
        }
      } else {
        const result = db.prepare(
          'INSERT INTO companies (name, address, phone, email, contact_person) VALUES (?, ?, ?, ?, ?)'
        ).run(normalizedCompanyName, company_address || '', company_phone || '', company_email || '', company_contact || '');
        companyId = Number(result.lastInsertRowid);
      }
    }

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

    const handoverResult = db.prepare(`
      INSERT INTO handovers (company_id, trailer_id, created_by, handover_date, handover_time, equipment_notes, has_documents, beams_count, straps_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, trailerId, req.user!.userId,
      handover_date, handover_time, equipment_notes || '',
      has_documents === '1' || has_documents === 'true' ? 1 : 0,
      Number(beams_count) || 0,
      Number(straps_count) || 0,
    );
    const handoverId = Number(handoverResult.lastInsertRowid);

    const toArray = (v: any) => Array.isArray(v) ? v : v ? [v] : [];

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = toArray(photo_positions);
    const descriptions = toArray(photo_descriptions);
    const hasIssues = toArray(photo_has_issues);
    const issueDescs = toArray(photo_issue_descriptions);

    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
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
      const filePath = path.join(__dirname, '..', '..', 'uploads', photo.file_path);
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
