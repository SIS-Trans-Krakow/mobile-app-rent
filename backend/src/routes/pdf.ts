import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';
import { generateHandoverPdf, generateReturnPdf } from '../services/pdf.service';

const router = Router();
router.use(authenticate);

function getIssuerSnapshotForPdf(record: any) {
  return {
    name: record?.issuer_name || '',
    address: record?.issuer_address || '',
    tax_id: record?.issuer_tax_id || '',
    phone: record?.issuer_phone || '',
    email: record?.issuer_email || '',
  };
}

router.get('/handover/:id', (req: Request, res: Response) => {
  const db = getDb();
  const handover = db.prepare(`
    SELECT h.*,
           h.prepared_by_name AS created_by_name,
           t.registration_number, t.vin, t.brand, t.type as trailer_type,
           t.production_date
    FROM handovers h
    JOIN trailers t ON h.trailer_id = t.id
    WHERE h.id = ?
  `).get(Number(req.params.id)) as any;

  if (!handover) {
    res.status(404).json({ error: 'Handover not found' });
    return;
  }

  const returnRecord = db.prepare(`
    SELECT r.*, r.prepared_by_name AS created_by_name
    FROM returns r
    WHERE r.handover_id = ?
  `).get(Number(req.params.id)) as any;

  if (returnRecord) {
    const returnPhotos = db.prepare(
      'SELECT * FROM return_photos WHERE return_id = ? ORDER BY id'
    ).all(returnRecord.id);
    returnRecord.photos = returnPhotos;

    const handoverPhotos = db.prepare(
      'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
    ).all(Number(req.params.id));
    handover.photos = handoverPhotos;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=zwrot_${returnRecord.id}.pdf`);

    const returnDoc = generateReturnPdf(handover, returnRecord, getIssuerSnapshotForPdf(returnRecord));
    returnDoc.pipe(res);
    returnDoc.end();
    return;
  }

  const photos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(Number(req.params.id));

  handover.photos = photos;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=przekazanie_${handover.id}.pdf`);

  const doc = generateHandoverPdf(handover, getIssuerSnapshotForPdf(handover));
  doc.pipe(res);
  doc.end();
});

router.get('/return/:id', (req: Request, res: Response) => {
  const db = getDb();
  const returnRecord = db.prepare(`
    SELECT r.*, r.prepared_by_name AS created_by_name
    FROM returns r
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
    SELECT h.*,
           h.prepared_by_name AS created_by_name,
           t.registration_number, t.vin, t.brand, t.type as trailer_type,
           t.production_date
    FROM handovers h
    JOIN trailers t ON h.trailer_id = t.id
    WHERE h.id = ?
  `).get(returnRecord.handover_id) as any;

  const handoverPhotos = db.prepare(
    'SELECT * FROM handover_photos WHERE handover_id = ? ORDER BY id'
  ).all(returnRecord.handover_id);
  handover.photos = handoverPhotos;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=zwrot_${returnRecord.id}.pdf`);

  const doc = generateReturnPdf(handover, returnRecord, getIssuerSnapshotForPdf(returnRecord));
  doc.pipe(res);
  doc.end();
});

export default router;
