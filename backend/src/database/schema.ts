import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app.db');

export const VALID_TRAILER_TYPES = [
  'Kurtyna', 'Box', 'Izoterma', 'Chłodnia', 'Kurtyna MEGA', 'TANDEM', 'Double Deck',
] as const;

const TRAILER_TYPE_CHECK = VALID_TRAILER_TYPES.map((t) => `'${t}'`).join(', ');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrateTrailersTable(db);
    db.pragma('foreign_keys = ON');
    initSchema(db);
    migrateHandoversEquipmentFields(db);
    migrateReturnsEquipmentFields(db);
    migrateHandoverPhotosIssueFields(db);
  }
  return db;
}

function migrateTrailersTable(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='trailers'"
  ).get();

  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(trailers)').all() as Array<{ name: string }>;
  const hasProductionDate = columns.some((col) => col.name === 'production_date');

  if (hasProductionDate) return;

  console.log('[db] Migrating trailers table: adding production_date, updating type constraint...');
  db.pragma('foreign_keys = OFF');
  db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE trailers_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL,
      vin TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      production_date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN (${TRAILER_TYPE_CHECK}))
    );

    INSERT INTO trailers_new (id, registration_number, vin, brand, type)
      SELECT id, registration_number, vin, brand, type FROM trailers;

    DROP TABLE trailers;

    ALTER TABLE trailers_new RENAME TO trailers;

    COMMIT;
  `);
  console.log('[db] Trailers table migration complete.');
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      contact_person TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS trailers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL,
      vin TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      production_date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN (${TRAILER_TYPE_CHECK}))
    );

    CREATE TABLE IF NOT EXISTS handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      trailer_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      handover_date TEXT NOT NULL,
      handover_time TEXT NOT NULL,
      equipment_notes TEXT NOT NULL DEFAULT '',
      has_documents INTEGER NOT NULL DEFAULT 0,
      beams_count INTEGER NOT NULL DEFAULT 0,
      straps_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (trailer_id) REFERENCES trailers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS handover_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handover_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      position_on_template TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (handover_id) REFERENCES handovers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handover_id INTEGER NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      return_date TEXT NOT NULL,
      return_time TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      return_has_documents INTEGER NOT NULL DEFAULT 0,
      return_beams_count INTEGER NOT NULL DEFAULT 0,
      return_straps_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (handover_id) REFERENCES handovers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS return_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      position_on_template TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      has_issue INTEGER NOT NULL DEFAULT 0,
      issue_description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
    CREATE INDEX IF NOT EXISTS idx_trailers_registration_number ON trailers(registration_number);
  `);

  const duplicateTrailers = db.prepare(`
    SELECT UPPER(TRIM(registration_number)) AS registration_key, COUNT(*) AS count
    FROM trailers
    GROUP BY registration_key
    HAVING count > 1
    LIMIT 1
  `).get() as { registration_key: string; count: number } | undefined;

  if (duplicateTrailers) {
    console.warn(
      `[db] Skipping unique trailer registration index, duplicate key detected: ${duplicateTrailers.registration_key}`
    );
  } else {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_trailers_registration_number_unique
      ON trailers(UPPER(TRIM(registration_number)));
    `);
  }
}

function migrateHandoversEquipmentFields(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(handovers)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('has_documents')) {
    db.exec('ALTER TABLE handovers ADD COLUMN has_documents INTEGER NOT NULL DEFAULT 0');
    console.log('[db] handovers: added has_documents');
  }
  if (!names.includes('beams_count')) {
    db.exec('ALTER TABLE handovers ADD COLUMN beams_count INTEGER NOT NULL DEFAULT 0');
    console.log('[db] handovers: added beams_count');
  }
  if (!names.includes('straps_count')) {
    db.exec('ALTER TABLE handovers ADD COLUMN straps_count INTEGER NOT NULL DEFAULT 0');
    console.log('[db] handovers: added straps_count');
  }
}

function migrateReturnsEquipmentFields(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='returns'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(returns)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('return_has_documents')) {
    db.exec('ALTER TABLE returns ADD COLUMN return_has_documents INTEGER NOT NULL DEFAULT 0');
    console.log('[db] returns: added return_has_documents');
  }
  if (!names.includes('return_beams_count')) {
    db.exec('ALTER TABLE returns ADD COLUMN return_beams_count INTEGER NOT NULL DEFAULT 0');
    console.log('[db] returns: added return_beams_count');
  }
  if (!names.includes('return_straps_count')) {
    db.exec('ALTER TABLE returns ADD COLUMN return_straps_count INTEGER NOT NULL DEFAULT 0');
    console.log('[db] returns: added return_straps_count');
  }
}

function migrateHandoverPhotosIssueFields(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='handover_photos'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(handover_photos)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('has_issue')) {
    db.exec('ALTER TABLE handover_photos ADD COLUMN has_issue INTEGER NOT NULL DEFAULT 0');
    console.log('[db] handover_photos: added has_issue');
  }
  if (!names.includes('issue_description')) {
    db.exec("ALTER TABLE handover_photos ADD COLUMN issue_description TEXT NOT NULL DEFAULT ''");
    console.log('[db] handover_photos: added issue_description');
  }
}
