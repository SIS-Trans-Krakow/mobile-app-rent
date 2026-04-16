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

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p8l6XQAAAAASUVORK5CYII=';
const REQUIRED_POSITIONS = ['front', 'rear', 'left-side', 'right-side'] as const;

interface TestContext {
  tempDir: string;
  uploadFile: string;
}

function createToken(userId: number, username: string, role: 'admin' | 'user') {
  return jwt.sign({ userId, username, role }, getJwtSecret(), { expiresIn: '1h' });
}

function createMultipartRequest(
  method: 'post' | 'patch',
  url: string,
  token: string,
  filePath: string,
  fields: Record<string, string>
) {
  let req = request(app)[method](url).set('Authorization', `Bearer ${token}`);

  for (const [key, value] of Object.entries(fields)) {
    req = req.field(key, value);
  }

  for (const position of REQUIRED_POSITIONS) {
    req = req
      .attach('photos', filePath)
      .field('photo_positions', position)
      .field('photo_descriptions', `${position} photo`)
      .field('photo_has_issues', '0')
      .field('photo_issue_descriptions', '');
  }

  return req;
}

function setupTestContext(): TestContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-app-rent-test-'));
  const uploadsDir = path.join(tempDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  process.env.DB_PATH = path.join(tempDir, 'app.db');
  process.env.UPLOADS_DIR = uploadsDir;

  resetDb();
  const db = getDb();

  db.prepare(
    `INSERT INTO users (id, username, password_hash, full_name, role, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(1, 'admin', 'hash', 'Jan Admin', 'admin');

  db.prepare(
    `INSERT INTO users (id, username, password_hash, full_name, role, active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(2, 'worker', 'hash', 'Anna Return', 'user');

  db.prepare(
    `INSERT INTO issuer_company_profile (id, name, address, tax_id, phone, email)
     VALUES (1, ?, ?, ?, ?, ?)`
  ).run('Issuer One', 'Admin Street 1', '1111111111', '123456789', 'issuer@example.com');

  db.prepare(
    `INSERT INTO trailers (id, registration_number, vin, brand, production_date, type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(1, 'WZ12345', 'VIN-001', 'Schmitz', '2024', 'Kurtyna');

  const uploadFile = path.join(tempDir, 'photo.png');
  fs.writeFileSync(uploadFile, Buffer.from(PNG_BASE64, 'base64'));

  return { tempDir, uploadFile };
}

function cleanupTestContext(ctx: TestContext) {
  resetDb();
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
  delete process.env.DB_PATH;
  delete process.env.UPLOADS_DIR;
}

test('manual handover keeps snapshots without creating company record', { concurrency: false }, async () => {
  const ctx = setupTestContext();

  try {
    const token = createToken(1, 'admin', 'admin');

    const createResponse = await createMultipartRequest(
      'post',
      '/api/handovers',
      token,
      ctx.uploadFile,
      {
        company_name: 'Manual Client',
        company_tax_id: '1234567890',
        company_address_line1: 'Client Street 1',
        company_address_line2: 'Suite 2',
        company_postal_code: '00-001',
        company_phone: '500600700',
        company_email: 'client@example.com',
        company_contact: 'Adam Manual',
        trailer_id: '1',
        registration_number: 'WZ12345',
        trailer_type: 'Kurtyna',
        handover_date: '2026-04-16',
        handover_time: '12:00',
        has_documents: '1',
        beams_count: '2',
        straps_count: '3',
        save_company_to_db: '0',
      }
    );

    assert.equal(createResponse.status, 201);
    const handoverId = createResponse.body.id as number;

    const db = getDb();
    const companiesCount = (db.prepare('SELECT COUNT(*) AS count FROM companies').get() as { count: number }).count;
    assert.equal(companiesCount, 0);

    db.prepare('UPDATE users SET full_name = ? WHERE id = 1').run('Changed Admin');
    db.prepare(
      `UPDATE issuer_company_profile
       SET name = ?, address = ?, tax_id = ?, phone = ?, email = ?
       WHERE id = 1`
    ).run('Issuer Changed', 'Other Street', '9999999999', '000000000', 'changed@example.com');

    const detailsResponse = await request(app)
      .get(`/api/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(detailsResponse.status, 200);
    assert.equal(detailsResponse.body.company_name, 'Manual Client');
    assert.equal(detailsResponse.body.company_tax_id, '1234567890');
    assert.equal(detailsResponse.body.created_by_name, 'Jan Admin');
    assert.equal(detailsResponse.body.issuer_name, 'Issuer One');
  } finally {
    cleanupTestContext(ctx);
  }
});

test('selected company fills document snapshot without mutating catalog record', { concurrency: false }, async () => {
  const ctx = setupTestContext();

  try {
    const db = getDb();
    const companyId = Number(
      db.prepare(
        `INSERT INTO companies (
          name, address, address_line1, address_line2, postal_code, tax_id, phone, email, contact_person
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'Catalog Client',
        'Original Street 1, 00-100',
        'Original Street 1',
        '',
        '00-100',
        '5555555555',
        '111222333',
        'catalog@example.com',
        'Catalog Owner'
      ).lastInsertRowid
    );

    const token = createToken(1, 'admin', 'admin');
    const createResponse = await createMultipartRequest(
      'post',
      '/api/handovers',
      token,
      ctx.uploadFile,
      {
        company_id: String(companyId),
        company_name: 'Catalog Client For Document',
        company_tax_id: '5555555555',
        company_address_line1: 'Snapshot Street 9',
        company_address_line2: '',
        company_postal_code: '00-109',
        company_phone: '999888777',
        company_email: 'snapshot@example.com',
        company_contact: 'Snapshot Person',
        trailer_id: '1',
        registration_number: 'WZ12345',
        trailer_type: 'Kurtyna',
        handover_date: '2026-04-16',
        handover_time: '12:00',
        has_documents: '0',
        beams_count: '0',
        straps_count: '0',
        save_company_to_db: '0',
      }
    );

    assert.equal(createResponse.status, 201);
    const handoverId = createResponse.body.id as number;

    const catalogCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    assert.equal(catalogCompany.name, 'Catalog Client');
    assert.equal(catalogCompany.address_line1, 'Original Street 1');

    const detailsResponse = await request(app)
      .get(`/api/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(detailsResponse.status, 200);
    assert.equal(detailsResponse.body.company_id, companyId);
    assert.equal(detailsResponse.body.company_name, 'Catalog Client For Document');
    assert.equal(detailsResponse.body.company_address_line1, 'Snapshot Street 9');
  } finally {
    cleanupTestContext(ctx);
  }
});

test('save_company_to_db creates catalog company and links handover', { concurrency: false }, async () => {
  const ctx = setupTestContext();

  try {
    const token = createToken(1, 'admin', 'admin');

    const createResponse = await createMultipartRequest(
      'post',
      '/api/handovers',
      token,
      ctx.uploadFile,
      {
        company_name: 'Saved Client',
        company_tax_id: '2223334445',
        company_address_line1: 'Saved Street 5',
        company_address_line2: 'Floor 1',
        company_postal_code: '01-234',
        company_phone: '600700800',
        company_email: 'saved@example.com',
        company_contact: 'Saved Person',
        trailer_id: '1',
        registration_number: 'WZ12345',
        trailer_type: 'Kurtyna',
        handover_date: '2026-04-16',
        handover_time: '12:00',
        has_documents: '1',
        beams_count: '1',
        straps_count: '1',
        save_company_to_db: '1',
      }
    );

    assert.equal(createResponse.status, 201);

    const db = getDb();
    const handover = db.prepare('SELECT * FROM handovers WHERE id = ?').get(createResponse.body.id) as any;
    assert.ok(handover.company_id);

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(handover.company_id) as any;
    assert.equal(company.name, 'Saved Client');
    assert.equal(company.tax_id, '2223334445');
  } finally {
    cleanupTestContext(ctx);
  }
});

test('return stores independent snapshot of company, issuer and preparer', { concurrency: false }, async () => {
  const ctx = setupTestContext();

  try {
    const adminToken = createToken(1, 'admin', 'admin');
    const workerToken = createToken(2, 'worker', 'user');

    const handoverResponse = await createMultipartRequest(
      'post',
      '/api/handovers',
      adminToken,
      ctx.uploadFile,
      {
        company_name: 'Return Client',
        company_tax_id: '8887776665',
        company_address_line1: 'Return Street 8',
        company_address_line2: '',
        company_postal_code: '02-345',
        company_phone: '700800900',
        company_email: 'return-client@example.com',
        company_contact: 'Return Owner',
        trailer_id: '1',
        registration_number: 'WZ12345',
        trailer_type: 'Kurtyna',
        handover_date: '2026-04-16',
        handover_time: '12:00',
        has_documents: '1',
        beams_count: '2',
        straps_count: '2',
        save_company_to_db: '1',
      }
    );

    assert.equal(handoverResponse.status, 201);
    const handoverId = handoverResponse.body.id as number;

    const db = getDb();
    db.prepare(
      `UPDATE issuer_company_profile
       SET name = ?, address = ?, tax_id = ?, phone = ?, email = ?
       WHERE id = 1`
    ).run('Issuer At Return', 'Return Admin Street', '4444444444', '123123123', 'return-issuer@example.com');

    const returnResponse = await createMultipartRequest(
      'post',
      '/api/returns',
      workerToken,
      ctx.uploadFile,
      {
        handover_id: String(handoverId),
        return_date: '2026-04-17',
        return_time: '14:30',
        notes: 'Returned in good condition',
        return_has_documents: '1',
        return_beams_count: '2',
        return_straps_count: '2',
      }
    );

    assert.equal(returnResponse.status, 201);
    const returnId = returnResponse.body.id as number;

    db.prepare('UPDATE users SET full_name = ? WHERE id = 2').run('Changed Worker');
    db.prepare(
      `UPDATE issuer_company_profile
       SET name = ?, address = ?, tax_id = ?, phone = ?, email = ?
       WHERE id = 1`
    ).run('Issuer Changed Again', 'Changed Address', '1212121212', '000000000', 'changed-again@example.com');
    db.prepare('UPDATE companies SET name = ? WHERE id = (SELECT company_id FROM handovers WHERE id = ?)').run(
      'Catalog Changed After Return',
      handoverId
    );

    const getReturnResponse = await request(app)
      .get(`/api/returns/${returnId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    assert.equal(getReturnResponse.status, 200);
    assert.equal(getReturnResponse.body.company_name, 'Return Client');
    assert.equal(getReturnResponse.body.created_by_name, 'Anna Return');
    assert.equal(getReturnResponse.body.issuer_name, 'Issuer At Return');

    const getHandoverResponse = await request(app)
      .get(`/api/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(getHandoverResponse.status, 200);
    assert.equal(getHandoverResponse.body.return.company_name, 'Return Client');
    assert.equal(getHandoverResponse.body.return.created_by_name, 'Anna Return');
    assert.equal(getHandoverResponse.body.return.issuer_name, 'Issuer At Return');
  } finally {
    cleanupTestContext(ctx);
  }
});

test('deleting company unlinks handovers but keeps document snapshots intact', { concurrency: false }, async () => {
  const ctx = setupTestContext();

  try {
    const db = getDb();
    const companyId = Number(
      db.prepare(
        `INSERT INTO companies (
          name, address, address_line1, address_line2, postal_code, tax_id, phone, email, contact_person
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'Delete Me Client',
        'Delete Street 7, 03-210',
        'Delete Street 7',
        '',
        '03-210',
        '1231231231',
        '700111222',
        'delete@example.com',
        'Delete Person'
      ).lastInsertRowid
    );

    const token = createToken(1, 'admin', 'admin');
    const createResponse = await createMultipartRequest(
      'post',
      '/api/handovers',
      token,
      ctx.uploadFile,
      {
        company_id: String(companyId),
        company_name: 'Delete Me Client',
        company_tax_id: '1231231231',
        company_address_line1: 'Delete Street 7',
        company_address_line2: '',
        company_postal_code: '03-210',
        company_phone: '700111222',
        company_email: 'delete@example.com',
        company_contact: 'Delete Person',
        trailer_id: '1',
        registration_number: 'WZ12345',
        trailer_type: 'Kurtyna',
        handover_date: '2026-04-16',
        handover_time: '12:00',
        has_documents: '0',
        beams_count: '0',
        straps_count: '0',
        save_company_to_db: '0',
      }
    );

    assert.equal(createResponse.status, 201);
    const handoverId = createResponse.body.id as number;

    const deleteResponse = await request(app)
      .delete(`/api/companies/${companyId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(deleteResponse.status, 200);

    const deletedCompany = db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId);
    assert.equal(deletedCompany, undefined);

    const handover = db.prepare('SELECT company_id, company_name FROM handovers WHERE id = ?').get(handoverId) as any;
    assert.equal(handover.company_id, null);
    assert.equal(handover.company_name, 'Delete Me Client');

    const detailsResponse = await request(app)
      .get(`/api/handovers/${handoverId}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(detailsResponse.status, 200);
    assert.equal(detailsResponse.body.company_name, 'Delete Me Client');
    assert.equal(detailsResponse.body.company_id, null);
  } finally {
    cleanupTestContext(ctx);
  }
});
