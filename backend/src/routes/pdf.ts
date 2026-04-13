import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';
import { generateHandoverPdf, generateReturnPdf } from '../services/pdf.service';

const router = Router();
router.use(authenticate);

router.get('/handover/:id', (req: Request, res: Response) => {
  const db = getDb();
  const handover = db.prepare(`
    SELECT h.*, c.name as company_name, c.address as company_address,
           c.phone as company_phone, c.email as company_email, c.contact_person as company_contact,
           t.registration_number, t.vin, t.brand, t.type as trailer_type,
           t.production_date,
           u.full_name as created_by_name
    FROM handovers h
    JOIN companies c ON h.company_id = c.id
    JOIN trailers t ON h.trailer_id = t.id
    JOIN users u ON h.created_by = u.id
    WHERE h.id = ?
  `).get(Number(req.params.id)) as any;

  if (!handover) {
    res.status(404).json({ error: 'Handover not found' });
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(Number(req.params.id));

  handover.photos = photos;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=przekazanie_${handover.id}.pdf`);

  const doc = generateHandoverPdf(handover);
  doc.pipe(res);
  doc.end();
});

router.get('/return/:id', (req: Request, res: Response) => {
  const db = getDb();
  const returnRecord = db.prepare(`
    SELECT r.*, u.full_name as created_by_name
    FROM returns r
    JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `).get(Number(req.params.id)) as any;

  if (!returnRecord) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }

  const returnPhotos = db.prepare(
    'SELECT * FROM return_photos WHERE return_id = ? ORDER BY id'
  ).all(returnRecord.id);
  returnRecord.photos = returnPhotos;

  const handover = db.prepare(`
    SELECT h.*, c.name as company_name, c.address as company_address,
           c.phone as company_phone, c.email as company_email, c.contact_person as company_contact,
           t.registration_number, t.vin, t.brand, t.type as trailer_type,
           t.production_date,
           u.full_name as created_by_name
    FROM handovers h
    JOIN companies c ON h.company_id = c.id
    JOIN trailers t ON h.trailer_id = t.id
    JOIN users u ON h.created_by = u.id
    WHERE h.id = ?
  `).get(returnRecord.handover_id) as any;

  const handoverPhotos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(returnRecord.handover_id);
  handover.photos = handoverPhotos;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=zwrot_${returnRecord.id}.pdf`);

  const doc = generateReturnPdf(handover, returnRecord);
  doc.pipe(res);
  doc.end();
});

export default router;
