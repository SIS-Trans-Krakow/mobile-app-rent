import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const profile = db.prepare(
    'SELECT name, address, tax_id, phone, email FROM issuer_company_profile WHERE id = 1'
  ).get() as
    | { name: string; address: string; tax_id: string; phone: string; email: string }
    | undefined;

  res.json(
    profile ?? {
      name: '',
      address: '',
      tax_id: '',
      phone: '',
      email: '',
    }
  );
});

router.put('/', (req: Request, res: Response) => {
  const db = getDb();
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  const taxId = typeof req.body.tax_id === 'string' ? req.body.tax_id.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';

  db.prepare(`
    INSERT INTO issuer_company_profile (id, name, address, tax_id, phone, email)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      tax_id = excluded.tax_id,
      phone = excluded.phone,
      email = excluded.email
  `).run(name, address, taxId, phone, email);

  res.json({
    name,
    address,
    tax_id: taxId,
    phone,
    email,
  });
});

export default router;
