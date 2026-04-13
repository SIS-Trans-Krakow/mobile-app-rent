import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../database/schema';
import { authenticate, requireAdmin } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, username, full_name, role, active, created_at FROM users ORDER BY id'
  ).all();
  res.json(users);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      res.status(400).json({ error: 'username, password, and full_name are required' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, full_name, role || 'user');

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      full_name,
      role: role || 'user',
      active: 1,
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, role, active, password } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) as User | undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (password) {
      const hash = await bcrypt.hash(password, 12);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, Number(id));
    }
    if (full_name !== undefined) {
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, Number(id));
    }
    if (role !== undefined) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, Number(id));
    }
    if (active !== undefined) {
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, Number(id));
    }

    const updated = db.prepare(
      'SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?'
    ).get(Number(id));
    res.json(updated);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
