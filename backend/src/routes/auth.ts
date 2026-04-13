import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/schema';
import { getJwtSecret } from '../middleware/auth';
import { User, JwtPayload } from '../types';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

    if (!user || !user.active) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
    const refreshToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const payload = jwt.verify(refreshToken, getJwtSecret()) as JwtPayload;
    const newPayload: JwtPayload = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };

    const accessToken = jwt.sign(newPayload, getJwtSecret(), { expiresIn: '24h' });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
