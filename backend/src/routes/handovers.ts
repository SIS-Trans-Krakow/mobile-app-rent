import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status } = req.query;
  let query = `
    SELECT h.*, c.name as company_name, t.registration_number, t.type as trailer_type,
           u.full_name as created_by_name
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
           u.full_name as created_by_name
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

  res.json({ ...handover, photos });
});

router.post('/', upload.array('photos', 20), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      company_name, company_address, company_phone, company_email, company_contact,
      company_id: existingCompanyId,
      registration_number, vin, brand, trailer_type,
      trailer_id: existingTrailerId,
      handover_date, handover_time, equipment_notes,
      photo_positions, photo_descriptions,
    } = req.body;

    let companyId = existingCompanyId ? Number(existingCompanyId) : null;
    if (!companyId) {
      if (!company_name) {
        res.status(400).json({ error: 'Company name is required' });
        return;
      }
      const result = db.prepare(
        'INSERT INTO companies (name, address, phone, email, contact_person) VALUES (?, ?, ?, ?, ?)'
      ).run(company_name, company_address || '', company_phone || '', company_email || '', company_contact || '');
      companyId = Number(result.lastInsertRowid);
    }

    let trailerId = existingTrailerId ? Number(existingTrailerId) : null;
    if (!trailerId) {
      if (!registration_number || !trailer_type) {
        res.status(400).json({ error: 'Registration number and trailer type are required' });
        return;
      }
      const result = db.prepare(
        'INSERT INTO trailers (registration_number, vin, brand, type) VALUES (?, ?, ?, ?)'
      ).run(registration_number, vin || '', brand || '', trailer_type);
      trailerId = Number(result.lastInsertRowid);
    }

    const handoverResult = db.prepare(`
      INSERT INTO handovers (company_id, trailer_id, created_by, handover_date, handover_time, equipment_notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(companyId, trailerId, req.user!.userId, handover_date, handover_time, equipment_notes || '');
    const handoverId = Number(handoverResult.lastInsertRowid);

    const files = (req.files as Express.Multer.File[]) || [];
    const positions = Array.isArray(photo_positions) ? photo_positions : photo_positions ? [photo_positions] : [];
    const descriptions = Array.isArray(photo_descriptions) ? photo_descriptions : photo_descriptions ? [photo_descriptions] : [];

    const insertPhoto = db.prepare(
      'INSERT INTO handover_photos (handover_id, file_path, position_on_template, description) VALUES (?, ?, ?, ?)'
    );

    for (let i = 0; i < files.length; i++) {
      insertPhoto.run(
        handoverId,
        files[i].filename,
        positions[i] || 'front',
        descriptions[i] || ''
      );
    }

    res.status(201).json({ id: handoverId, message: 'Handover created' });
  } catch (err) {
    console.error('Create handover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
