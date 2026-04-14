import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';
import { convertToPdfCompatibleJpeg } from '../utils/image';

const router = Router();
router.use(authenticate);

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Niedozwolony format pliku: ${file.mimetype}. Dozwolone: jpg, jpeg, png`));
    }
  },
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const returnRecord = db.prepare(`
    SELECT r.*, u.full_name as created_by_name
    FROM returns r
    JOIN users u ON r.created_by = u.id
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
    SELECT r.*, u.full_name as created_by_name
    FROM returns r
    JOIN users u ON r.created_by = u.id
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
      photo_positions, photo_descriptions, photo_has_issues, photo_issue_descriptions,
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

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = Array.isArray(photo_positions) ? photo_positions : photo_positions ? [photo_positions] : [];
    const descriptions = Array.isArray(photo_descriptions) ? photo_descriptions : photo_descriptions ? [photo_descriptions] : [];
    const hasIssues = Array.isArray(photo_has_issues) ? photo_has_issues : photo_has_issues ? [photo_has_issues] : [];
    const issueDescs = Array.isArray(photo_issue_descriptions) ? photo_issue_descriptions : photo_issue_descriptions ? [photo_issue_descriptions] : [];

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

    const returnResult = db.prepare(`
      INSERT INTO returns (handover_id, created_by, return_date, return_time, notes, return_has_documents, return_beams_count, return_straps_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(handover_id), req.user!.userId, return_date, return_time, notes || '',
      return_has_documents === '1' || return_has_documents === 'true' ? 1 : 0,
      Number(return_beams_count) || 0,
      Number(return_straps_count) || 0,
    );
    const returnId = Number(returnResult.lastInsertRowid);

    db.prepare('UPDATE handovers SET status = ? WHERE id = ?').run('returned', Number(handover_id));

    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
    await Promise.all(files.map(f => convertToPdfCompatibleJpeg(path.join(UPLOADS_DIR, f.filename))));

    const insertPhoto = db.prepare(
      'INSERT INTO return_photos (return_id, file_path, position_on_template, description, has_issue, issue_description) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (let i = 0; i < files.length; i++) {
      insertPhoto.run(
        returnId,
        files[i].filename,
        positions[i] || 'front',
        descriptions[i] || '',
        hasIssues[i] === '1' || hasIssues[i] === 'true' ? 1 : 0,
        issueDescs[i] || ''
      );
    }

    res.status(201).json({ id: returnId, message: 'Return created' });
  } catch (err) {
    console.error('Create return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
