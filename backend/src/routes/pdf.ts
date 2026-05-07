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

const POLISH_DIACRITIC_MAP: Record<string, string> = {
  ą: 'a', Ą: 'A', ć: 'c', Ć: 'C', ę: 'e', Ę: 'E',
  ł: 'l', Ł: 'L', ń: 'n', Ń: 'N', ó: 'o', Ó: 'O',
  ś: 's', Ś: 'S', ź: 'z', Ź: 'Z', ż: 'z', Ż: 'Z',
};

function sanitizeFilenamePart(value: unknown): string {
  const raw = (value === null || value === undefined ? '' : String(value)).trim();
  if (!raw) return 'brak';
  const normalized = raw.replace(/[ąĄćĆęĘłŁńŃóÓśŚźŹżŻ]/g, (ch) => POLISH_DIACRITIC_MAP[ch] || ch);
  const cleaned = normalized
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
  return cleaned || 'brak';
}

function extractClientName(value: unknown): string {
  const raw = (value === null || value === undefined ? '' : String(value)).trim();
  if (!raw) return '';
  const firstChunk = raw.split(/[\n\r,;|/]+/, 1)[0]?.trim() ?? '';
  const beforeAddress = firstChunk.split(
    /\s+(?:ul\.?|ulica|al\.?|aleja|pl\.?|plac|os\.?|osiedle|skr\.?|\d{2}-\d{3})\b/i
  )[0]?.trim() ?? '';
  return beforeAddress || firstChunk || raw;
}

function buildPdfFilename(parts: {
  registration: unknown;
  client: unknown;
  protocolNumber: unknown;
  type: 'przekazanie' | 'zwrot';
}): { ascii: string; utf8: string } {
  const clientName = extractClientName(parts.client);
  const reg = sanitizeFilenamePart(parts.registration);
  const client = sanitizeFilenamePart(clientName);
  const num = sanitizeFilenamePart(parts.protocolNumber);
  const ascii = `${reg}_${client}_${num}_${parts.type}.pdf`;
  const utf8 = `${String(parts.registration ?? '').trim() || 'brak'}_${clientName || 'brak'}_${String(parts.protocolNumber ?? '').trim() || 'brak'}_${parts.type}.pdf`;
  return { ascii, utf8 };
}

function setPdfDisposition(res: Response, filename: { ascii: string; utf8: string }): void {
  const asciiQuoted = filename.ascii.replace(/"/g, '');
  const utf8Encoded = encodeURIComponent(filename.utf8).replace(/['()]/g, escape);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiQuoted}"; filename*=UTF-8''${utf8Encoded}`
  );
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
    setPdfDisposition(res, buildPdfFilename({
      registration: handover.registration_number,
      client: handover.company_name,
      protocolNumber: returnRecord.id,
      type: 'zwrot',
    }));

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
  setPdfDisposition(res, buildPdfFilename({
    registration: handover.registration_number,
    client: handover.company_name,
    protocolNumber: handover.id,
    type: 'przekazanie',
  }));

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
  setPdfDisposition(res, buildPdfFilename({
    registration: handover.registration_number,
    client: handover.company_name,
    protocolNumber: returnRecord.id,
    type: 'zwrot',
  }));

  const doc = generateReturnPdf(handover, returnRecord, getIssuerSnapshotForPdf(returnRecord));
  doc.pipe(res);
  doc.end();
});

export default router;
