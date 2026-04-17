import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/schema';
import { authenticate, getJwtSecret } from '../middleware/auth';
import { User, JwtPayload } from '../types';
import {
  removeSignatureFile,
  saveSignatureFromBase64,
  saveSignatureFromUploadedFile,
} from '../utils/signature';
import { getUploadsDir } from '../utils/paths';

const router = Router();

const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: getUploadsDir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `sig_tmp_${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Signature must be a PNG file'));
    }
  },
});

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

router.get('/me/signature', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT signature_path FROM users WHERE id = ?').get(req.user!.userId) as
    | { signature_path: string }
    | undefined;

  res.json({ signature_path: user?.signature_path || null });
});

router.put(
  '/me/signature',
  authenticate,
  signatureUpload.single('signature'),
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      const userId = req.user!.userId;
      const file = req.file as Express.Multer.File | undefined;
      const base64 = req.body?.signature_base64;

      let newFilename: string | null = null;
      try {
        if (file) {
          newFilename = saveSignatureFromUploadedFile(file, 'sig_user');
        } else if (typeof base64 === 'string' && base64) {
          newFilename = saveSignatureFromBase64(base64, 'sig_user');
        }
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      if (!newFilename) {
        res.status(400).json({ error: 'No signature payload provided' });
        return;
      }

      const existing = db.prepare('SELECT signature_path FROM users WHERE id = ?').get(userId) as
        | { signature_path: string }
        | undefined;

      db.prepare('UPDATE users SET signature_path = ? WHERE id = ?').run(newFilename, userId);

      if (existing?.signature_path && existing.signature_path !== newFilename) {
        removeSignatureFile(existing.signature_path);
      }

      res.json({ signature_path: newFilename });
    } catch (err) {
      console.error('Update signature error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/me/signature', authenticate, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;

    const existing = db.prepare('SELECT signature_path FROM users WHERE id = ?').get(userId) as
      | { signature_path: string }
      | undefined;

    db.prepare("UPDATE users SET signature_path = '' WHERE id = ?").run(userId);

    if (existing?.signature_path) {
      removeSignatureFile(existing.signature_path);
    }

    res.json({ signature_path: null });
  } catch (err) {
    console.error('Delete signature error:', err);
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
