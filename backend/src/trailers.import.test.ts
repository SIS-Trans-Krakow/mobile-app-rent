import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from './app';
import { getDb, resetDb } from './database/schema';
import { getJwtSecret } from './middleware/auth';

function adminToken() {
  return jwt.sign(
    { userId: 1, username: 'admin', role: 'admin' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

function userToken() {
  return jwt.sign(
    { userId: 2, username: 'user', role: 'user' },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

function setupDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-app-rent-import-'));
  process.env.DB_PATH = path.join(tempDir, 'app.db');
  process.env.UPLOADS_DIR = path.join(tempDir, 'uploads');
  fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

  resetDb();
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, full_name, role, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(1, 'admin', 'hash', 'Admin', 'admin');
  db.prepare(
    `INSERT INTO users (id, username, password_hash, full_name, role, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(2, 'user', 'hash', 'User', 'user');
  return tempDir;
}

test('POST /api/trailers/import imports valid CSV rows', async () => {
  const tempDir = setupDb();
  try {
    const csv = [
      'KK058PC,SUDNS200200154752,2026,WIELTON,BOX',
      'KK059PC,SUDNS200400154753,2026,WIELTON,BOX',
      'KK068PC,SUDNS200600154754,2026,WIELTON,BOX',
    ].join('\n');

    const res = await request(app)
      .post('/api/trailers/import')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ csv });

    assert.equal(res.status, 200);
    assert.equal(res.body.imported, 3);
    assert.equal(res.body.skipped, 0);
    assert.equal(res.body.parse_errors.length, 0);

    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) AS c FROM trailers').get() as { c: number }).c;
    assert.equal(count, 3);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/trailers/import handles header line and skips duplicates', async () => {
  const tempDir = setupDb();
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO trailers (registration_number, vin, brand, production_date, type)
       VALUES (?, ?, ?, ?, ?)`
    ).run('KK058PC', 'OLD', 'OLD', '2020', 'Box');

    const csv = [
      'Numer Rejestracyjny,VIN,rocznik,MARKA,TYP',
      'KK058PC,SUDNS200200154752,2026,WIELTON,BOX',
      'KK059PC,SUDNS200400154753,2026,WIELTON,BOX',
    ].join('\n');

    const res = await request(app)
      .post('/api/trailers/import')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ csv });

    assert.equal(res.status, 200);
    assert.equal(res.body.imported, 1);
    assert.equal(res.body.skipped, 1);
    assert.equal(res.body.skipped_rows[0].registration_number, 'KK058PC');

    const count = (db.prepare('SELECT COUNT(*) AS c FROM trailers').get() as { c: number }).c;
    assert.equal(count, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/trailers/import reports parse errors for invalid types', async () => {
  const tempDir = setupDb();
  try {
    const csv = [
      'KK001PC,VIN001,2026,WIELTON,UNKNOWN_TYPE',
      'KK002PC,VIN002,2026,WIELTON,BOX',
      ',VIN003,2026,WIELTON,BOX',
    ].join('\n');

    const res = await request(app)
      .post('/api/trailers/import')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ csv });

    assert.equal(res.status, 200);
    assert.equal(res.body.imported, 1);
    assert.equal(res.body.parse_errors.length, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/trailers/import requires admin role', async () => {
  const tempDir = setupDb();
  try {
    const res = await request(app)
      .post('/api/trailers/import')
      .set('Authorization', `Bearer ${userToken()}`)
      .send({ csv: 'KK001PC,VIN,2026,WIELTON,BOX' });
    assert.equal(res.status, 403);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('POST /api/trailers/import rejects empty payload', async () => {
  const tempDir = setupDb();
  try {
    const res = await request(app)
      .post('/api/trailers/import')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ csv: '' });
    assert.equal(res.status, 400);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
