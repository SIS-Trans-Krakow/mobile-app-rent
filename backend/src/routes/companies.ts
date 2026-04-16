import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { normalizeText } from '../utils/documentSnapshots';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const search = normalizeText(req.query.search);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  let companies: unknown[];

  if (search) {
    const normalizedSearch = `%${search.toLowerCase()}%`;
    companies = db.prepare(
      `SELECT *
       FROM companies
       WHERE LOWER(name) LIKE ?
          OR REPLACE(REPLACE(REPLACE(LOWER(tax_id), '-', ''), ' ', ''), '.', '') LIKE ?
       ORDER BY
         CASE
           WHEN LOWER(name) = ? THEN 0
           WHEN LOWER(name) LIKE ? THEN 1
           WHEN REPLACE(REPLACE(REPLACE(LOWER(tax_id), '-', ''), ' ', ''), '.', '') = ? THEN 2
           ELSE 3
         END,
         name ASC
       LIMIT ?`
    ).all(
      normalizedSearch,
      `%${search.toLowerCase().replace(/[-.\s]/g, '')}%`,
      search.toLowerCase(),
      `${search.toLowerCase()}%`,
      search.toLowerCase().replace(/[-.\s]/g, ''),
      limit
    );
  } else {
    companies = db.prepare('SELECT * FROM companies ORDER BY name LIMIT ?').all(limit);
  }

  res.json(companies);
});

router.post('/', requireAdmin, (req: Request, res: Response) => {
  const name = normalizeText(req.body.name);
  const addressLine1 = normalizeText(req.body.address_line1);
  const addressLine2 = normalizeText(req.body.address_line2);
  const postalCode = normalizeText(req.body.postal_code);
  const taxId = normalizeText(req.body.tax_id);
  const phone = normalizeText(req.body.phone);
  const email = normalizeText(req.body.email);
  const contactPerson = normalizeText(req.body.contact_person);

  if (!name) {
    res.status(400).json({ error: 'Company name is required' });
    return;
  }
  const db = getDb();
  const legacyAddress = [addressLine1, addressLine2, postalCode].filter(Boolean).join(', ');
  const result = db.prepare(
    `INSERT INTO companies (
      name, address, address_line1, address_line2, postal_code, tax_id, phone, email, contact_person
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    legacyAddress,
    addressLine1,
    addressLine2,
    postalCode,
    taxId,
    phone,
    email,
    contactPerson
  );
  res.status(201).json({
    id: result.lastInsertRowid,
    name,
    address: legacyAddress,
    address_line1: addressLine1,
    address_line2: addressLine2,
    postal_code: postalCode,
    tax_id: taxId,
    phone,
    email,
    contact_person: contactPerson,
  });
});

router.patch('/:id', requireAdmin, (req: Request, res: Response) => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    res.status(400).json({ error: 'Invalid company id' });
    return;
  }

  const name = normalizeText(req.body.name);
  const addressLine1 = normalizeText(req.body.address_line1);
  const addressLine2 = normalizeText(req.body.address_line2);
  const postalCode = normalizeText(req.body.postal_code);
  const taxId = normalizeText(req.body.tax_id);
  const phone = normalizeText(req.body.phone);
  const email = normalizeText(req.body.email);
  const contactPerson = normalizeText(req.body.contact_person);

  if (!name) {
    res.status(400).json({ error: 'Company name is required' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId);
  if (!existing) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  const legacyAddress = [addressLine1, addressLine2, postalCode].filter(Boolean).join(', ');
  db.prepare(
    `UPDATE companies
     SET name = ?,
         address = ?,
         address_line1 = ?,
         address_line2 = ?,
         postal_code = ?,
         tax_id = ?,
         phone = ?,
         email = ?,
         contact_person = ?
     WHERE id = ?`
  ).run(
    name,
    legacyAddress,
    addressLine1,
    addressLine2,
    postalCode,
    taxId,
    phone,
    email,
    contactPerson,
    companyId
  );

  res.json({
    id: companyId,
    name,
    address: legacyAddress,
    address_line1: addressLine1,
    address_line2: addressLine2,
    postal_code: postalCode,
    tax_id: taxId,
    phone,
    email,
    contact_person: contactPerson,
  });
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    res.status(400).json({ error: 'Invalid company id' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId);
  if (!existing) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  const removeCompany = db.transaction(() => {
    // Historical document data stays intact because snapshots live in handovers/returns.
    db.prepare('UPDATE handovers SET company_id = NULL WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
  });

  removeCompany();
  res.json({ message: 'Company deleted' });
});

export default router;
