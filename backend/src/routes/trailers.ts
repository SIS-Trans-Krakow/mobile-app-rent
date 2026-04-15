import { Router, Request, Response } from 'express';
import { getDb, VALID_TRAILER_TYPES } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { Trailer } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { search } = req.query;
  let query = `
    SELECT
      t.*,
      (
        SELECT h.id
        FROM handovers h
        WHERE h.trailer_id = t.id AND h.status = 'active'
        ORDER BY h.id DESC
        LIMIT 1
      ) as active_handover_id,
      CASE WHEN EXISTS (
        SELECT 1
        FROM handovers h
        WHERE h.trailer_id = t.id AND h.status = 'active'
      ) THEN 0 ELSE 1 END as is_available_for_handover
    FROM trailers t
  `;
  const params: any[] = [];
  if (search && typeof search === 'string' && search.trim()) {
    query += ' WHERE t.registration_number LIKE ? OR t.vin LIKE ? OR t.brand LIKE ?';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  query += ' ORDER BY t.registration_number';
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

router.get('/:id/last-return-photos', (req: Request, res: Response) => {
  const db = getDb();
  const trailerId = Number(req.params.id);
  if (!Number.isFinite(trailerId)) {
    res.status(400).json({ error: 'Invalid trailer id' });
    return;
  }

  const lastReturn = db.prepare(`
    SELECT r.id, r.return_date
    FROM returns r
    JOIN handovers h ON r.handover_id = h.id
    WHERE h.trailer_id = ?
    ORDER BY r.created_at DESC
    LIMIT 1
  `).get(trailerId) as { id: number; return_date: string } | undefined;

  if (!lastReturn) {
    res.json({ photos: [] });
    return;
  }

  const photos = db.prepare(
    'SELECT file_path, position_on_template, description, has_issue, issue_description FROM return_photos WHERE return_id = ? ORDER BY id'
  ).all(lastReturn.id);

  res.json({ photos, return_date: lastReturn.return_date });
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
