import { Router, Request, Response } from 'express';
import { getDb, VALID_TRAILER_TYPES } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { Trailer } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { search } = req.query;
  let query = 'SELECT * FROM trailers';
  const params: any[] = [];
  if (search && typeof search === 'string' && search.trim()) {
    query += ' WHERE registration_number LIKE ? OR vin LIKE ? OR brand LIKE ?';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  query += ' ORDER BY registration_number';
  const trailers = db.prepare(query).all(...params);
  res.json(trailers);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const trailer = db.prepare('SELECT * FROM trailers WHERE id = ?').get(Number(req.params.id));
  if (!trailer) {
    res.status(404).json({ error: 'Trailer not found' });
    return;
  }
  res.json(trailer);
});

router.post('/', requireAdmin, (req: Request, res: Response) => {
  const { registration_number, vin, brand, type, production_date } = req.body;
  if (!registration_number || !type) {
    res.status(400).json({ error: 'Registration number and type are required' });
    return;
  }
  if (!VALID_TRAILER_TYPES.includes(type)) {
    res.status(400).json({ error: `Type must be one of: ${VALID_TRAILER_TYPES.join(', ')}` });
    return;
  }
  const db = getDb();
  const existing = db.prepare(
    'SELECT id FROM trailers WHERE UPPER(TRIM(registration_number)) = UPPER(TRIM(?))'
  ).get(registration_number.trim());
  if (existing) {
    res.status(409).json({ error: 'Trailer with this registration number already exists' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO trailers (registration_number, vin, brand, type, production_date) VALUES (?, ?, ?, ?, ?)'
  ).run(registration_number.trim(), vin || '', brand || '', type, production_date || '');
  res.status(201).json({
    id: result.lastInsertRowid,
    registration_number: registration_number.trim(),
    vin: vin || '',
    brand: brand || '',
    type,
    production_date: production_date || '',
  });
});

router.patch('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { registration_number, vin, brand, type, production_date } = req.body;
    const db = getDb();

    const trailer = db.prepare('SELECT * FROM trailers WHERE id = ?').get(Number(id)) as Trailer | undefined;
    if (!trailer) {
      res.status(404).json({ error: 'Trailer not found' });
      return;
    }

    if (type !== undefined && !VALID_TRAILER_TYPES.includes(type)) {
      res.status(400).json({ error: `Type must be one of: ${VALID_TRAILER_TYPES.join(', ')}` });
      return;
    }

    if (registration_number !== undefined) {
      const duplicate = db.prepare(
        'SELECT id FROM trailers WHERE UPPER(TRIM(registration_number)) = UPPER(TRIM(?)) AND id != ?'
      ).get(registration_number.trim(), Number(id));
      if (duplicate) {
        res.status(409).json({ error: 'Trailer with this registration number already exists' });
        return;
      }
      db.prepare('UPDATE trailers SET registration_number = ? WHERE id = ?').run(registration_number.trim(), Number(id));
    }
    if (vin !== undefined) {
      db.prepare('UPDATE trailers SET vin = ? WHERE id = ?').run(vin, Number(id));
    }
    if (brand !== undefined) {
      db.prepare('UPDATE trailers SET brand = ? WHERE id = ?').run(brand, Number(id));
    }
    if (type !== undefined) {
      db.prepare('UPDATE trailers SET type = ? WHERE id = ?').run(type, Number(id));
    }
    if (production_date !== undefined) {
      db.prepare('UPDATE trailers SET production_date = ? WHERE id = ?').run(production_date, Number(id));
    }

    const updated = db.prepare('SELECT * FROM trailers WHERE id = ?').get(Number(id));
    res.json(updated);
  } catch (err) {
    console.error('Update trailer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const trailerId = Number(req.params.id);
    if (!Number.isFinite(trailerId)) {
      res.status(400).json({ error: 'Invalid trailer id' });
      return;
    }

    const trailer = db.prepare('SELECT id FROM trailers WHERE id = ?').get(trailerId);
    if (!trailer) {
      res.status(404).json({ error: 'Trailer not found' });
      return;
    }

    const usedInHandover = db.prepare(
      'SELECT id FROM handovers WHERE trailer_id = ? LIMIT 1'
    ).get(trailerId);
    if (usedInHandover) {
      res.status(400).json({ error: 'Cannot delete trailer that is used in handovers' });
      return;
    }

    db.prepare('DELETE FROM trailers WHERE id = ?').run(trailerId);
    res.json({ message: 'Trailer deleted' });
  } catch (err) {
    console.error('Delete trailer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
