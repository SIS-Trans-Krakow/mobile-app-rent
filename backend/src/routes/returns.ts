import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';
import { convertToPdfCompatibleJpeg } from '../utils/image';
import { getIssuerSnapshot, getPreparedByName } from '../utils/documentSnapshots';
import { getUploadsDir } from '../utils/paths';

const router = Router();
router.use(authenticate);

function normalizeIssueText(value: unknown): string {
  return String(value || '').trim();
}

function mergeIssueDescriptions(baseText: string, deltaText: string): string {
  const base = normalizeIssueText(baseText);
  const delta = normalizeIssueText(deltaText);

  if (!base) return delta;
  if (!delta) return base;
  if (base.toLowerCase() === delta.toLowerCase()) return base;

  return `${base}; ${delta}`;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

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

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const returnRecord = db.prepare(`
    SELECT r.*, r.prepared_by_name AS created_by_name
    FROM returns r
    WHERE r.id = ?
  `).get(Number(req.params.id));

  if (!returnRecord) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM return_photos WHERE return_id = ? ORDER BY id'
  ).all(Number(req.params.id));

  res.json({ ...returnRecord, photos });
});

router.get('/by-handover/:handoverId', (req: Request, res: Response) => {
  const db = getDb();
  const returnRecord = db.prepare(`
    SELECT r.*, r.prepared_by_name AS created_by_name
    FROM returns r
    WHERE r.handover_id = ?
  `).get(Number(req.params.handoverId)) as any;

  if (!returnRecord) {
    res.status(404).json({ error: 'Return not found for this handover' });
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM return_photos WHERE return_id = ? ORDER BY id'
  ).all(returnRecord.id);

  res.json({ ...returnRecord, photos });
});

router.post('/', upload.array('photos', 20), async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      handover_id, return_date, return_time, notes,
      return_has_documents, return_beams_count, return_straps_count,
      photo_positions, photo_descriptions, photo_has_issues, photo_issue_descriptions, photo_new_issue_descriptions,
    } = req.body;

    if (!handover_id || !return_date || !return_time) {
      res.status(400).json({ error: 'handover_id, return_date, and return_time are required' });
      return;
    }

    const handover = db.prepare('SELECT * FROM handovers WHERE id = ? AND status = ?').get(Number(handover_id), 'active') as any;
    if (!handover) {
      res.status(400).json({ error: 'Handover not found or already returned' });
      return;
    }

    const existingReturn = db.prepare('SELECT id FROM returns WHERE handover_id = ?').get(Number(handover_id));
    if (existingReturn) {
      res.status(400).json({ error: 'Return already exists for this handover' });
      return;
    }

    const issuerSnapshot = getIssuerSnapshot(db);
    const preparedByName = getPreparedByName(db, req.user!.userId);

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = Array.isArray(photo_positions) ? photo_positions : photo_positions ? [photo_positions] : [];
    const descriptions = Array.isArray(photo_descriptions) ? photo_descriptions : photo_descriptions ? [photo_descriptions] : [];
    const hasIssues = Array.isArray(photo_has_issues) ? photo_has_issues : photo_has_issues ? [photo_has_issues] : [];
    const issueDescs = Array.isArray(photo_issue_descriptions) ? photo_issue_descriptions : photo_issue_descriptions ? [photo_issue_descriptions] : [];
    const newIssueDescs = Array.isArray(photo_new_issue_descriptions)
      ? photo_new_issue_descriptions
      : photo_new_issue_descriptions ? [photo_new_issue_descriptions] : [];
    const originalIssueRows = db.prepare(
      'SELECT position_on_template, has_issue, issue_description FROM handover_photos WHERE handover_id = ?'
    ).all(Number(handover_id)) as Array<{ position_on_template: string; has_issue: number; issue_description: string }>;
    const originalIssueByPosition = new Map(
      originalIssueRows
        .filter((row) => row.has_issue)
        .map((row) => [row.position_on_template, normalizeIssueText(row.issue_description)])
    );

    const requiredRows = db.prepare(
      'SELECT DISTINCT position_on_template FROM handover_photos WHERE handover_id = ?'
    ).all(Number(handover_id)) as Array<{ position_on_template: string }>;
    const requiredPositions = requiredRows.map((row) => row.position_on_template);

    if (requiredPositions.length > 0) {
      const submittedPositions = new Set<string>();
      for (let i = 0; i < files.length; i++) {
        const position = (positions[i] || '').toString().trim();
        if (position) {
          submittedPositions.add(position);
        }
      }

      const missingPositions = requiredPositions.filter((position) => !submittedPositions.has(position));
      if (missingPositions.length > 0) {
        res.status(400).json({
          error: 'Missing return photos for required handover positions',
          missing_positions: missingPositions,
        });
        return;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const position = (positions[i] || 'front').toString();
      const originalIssue = originalIssueByPosition.get(position) || '';
      const hasOriginalIssue = originalIssueByPosition.has(position);
      const hasIssue = hasIssues[i] === '1' || hasIssues[i] === 'true';
      const normalizedNewIssue = normalizeIssueText(newIssueDescs[i]);
      const normalizedCurrentIssue = normalizeIssueText(issueDescs[i]);

      if (!hasOriginalIssue && hasIssue && !normalizedCurrentIssue) {
        res.status(400).json({
          error: 'Issue description is required when issue is marked',
          position,
        });
        return;
      }

      if (hasOriginalIssue && hasIssue && normalizedCurrentIssue !== originalIssue && !normalizedNewIssue) {
        res.status(400).json({
          error: 'New issue description is required when adding damage to an existing issue',
          position,
        });
        return;
      }
    }

    const returnResult = db.prepare(`
      INSERT INTO returns (
        handover_id, created_by,
        company_name, company_address_line1, company_address_line2, company_postal_code,
        company_tax_id, company_phone, company_email, company_contact,
        issuer_name, issuer_address, issuer_tax_id, issuer_phone, issuer_email, prepared_by_name,
        return_date, return_time, notes, return_has_documents, return_beams_count, return_straps_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(handover_id),
      req.user!.userId,
      handover.company_name || '',
      handover.company_address_line1 || '',
      handover.company_address_line2 || '',
      handover.company_postal_code || '',
      handover.company_tax_id || '',
      handover.company_phone || '',
      handover.company_email || '',
      handover.company_contact || '',
      issuerSnapshot.issuer_name,
      issuerSnapshot.issuer_address,
      issuerSnapshot.issuer_tax_id,
      issuerSnapshot.issuer_phone,
      issuerSnapshot.issuer_email,
      preparedByName,
      return_date,
      return_time,
      notes || '',
      return_has_documents === '1' || return_has_documents === 'true' ? 1 : 0,
      Number(return_beams_count) || 0,
      Number(return_straps_count) || 0,
    );
    const returnId = Number(returnResult.lastInsertRowid);

    db.prepare('UPDATE handovers SET status = ? WHERE id = ?').run('returned', Number(handover_id));

    const UPLOADS_DIR = getUploadsDir();
    await Promise.all(files.map(f => convertToPdfCompatibleJpeg(path.join(UPLOADS_DIR, f.filename))));

    const insertPhoto = db.prepare(
      `INSERT INTO return_photos (
        return_id, file_path, position_on_template, description, has_issue, issue_description, new_issue_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (let i = 0; i < files.length; i++) {
      const position = (positions[i] || 'front').toString();
      const originalIssue = originalIssueByPosition.get(position) || '';
      const currentIssue = normalizeIssueText(issueDescs[i]);
      const newIssue = normalizeIssueText(newIssueDescs[i]);
      const hasOriginalIssue = Boolean(originalIssue);
      const hasMarkedIssue = hasIssues[i] === '1' || hasIssues[i] === 'true';
      const hasIssue = hasOriginalIssue || hasMarkedIssue;
      const mergedIssue = hasIssue
        ? mergeIssueDescriptions(originalIssue, newIssue || (!hasOriginalIssue ? currentIssue : ''))
        : '';

      insertPhoto.run(
        returnId,
        files[i].filename,
        position,
        descriptions[i] || '',
        hasIssue ? 1 : 0,
        mergedIssue,
        hasOriginalIssue ? newIssue : (hasIssue ? (newIssue || currentIssue) : '')
      );
    }

    res.status(201).json({ id: returnId, message: 'Return created' });
  } catch (err) {
    console.error('Create return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
