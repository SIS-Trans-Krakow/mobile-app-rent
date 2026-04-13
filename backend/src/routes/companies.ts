import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
  res.json(companies);
});

router.post('/', (req: Request, res: Response) => {
  const { name, address, phone, email, contact_person } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Company name is required' });
    return;
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO companies (name, address, phone, email, contact_person) VALUES (?, ?, ?, ?, ?)'
  ).run(name, address || '', phone || '', email || '', contact_person || '');
  res.status(201).json({ id: result.lastInsertRowid, name, address, phone, email, contact_person });
});

export default router;
