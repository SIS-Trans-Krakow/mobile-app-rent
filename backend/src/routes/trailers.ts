import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const trailers = db.prepare('SELECT * FROM trailers ORDER BY registration_number').all();
  res.json(trailers);
});

router.post('/', (req: Request, res: Response) => {
  const { registration_number, vin, brand, type } = req.body;
  if (!registration_number || !type) {
    res.status(400).json({ error: 'Registration number and type are required' });
    return;
  }
  const validTypes = ['Kurtyna', 'Box', 'Izoterma', 'Chłodnia'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    return;
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO trailers (registration_number, vin, brand, type) VALUES (?, ?, ?, ?)'
  ).run(registration_number, vin || '', brand || '', type);
  res.status(201).json({ id: result.lastInsertRowid, registration_number, vin, brand, type });
});

export default router;
