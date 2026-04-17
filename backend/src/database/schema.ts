import Database from 'better-sqlite3';
import path from 'path';

export const VALID_TRAILER_TYPES = [
  'Kurtyna', 'Box', 'Izoterma', 'Chłodnia', 'Kurtyna MEGA', 'TANDEM', 'Double Deck',
] as const;

const TRAILER_TYPE_CHECK = VALID_TRAILER_TYPES.map((t) => `'${t}'`).join(', ');

let db: Database.Database;

function resolveDbPath(): string {
  return process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db');
}

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dbPath = resolveDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    migrateTrailersTable(db);
    db.pragma('foreign_keys = ON');
    initSchema(db);
    migrateCompaniesFields(db);
    migrateHandoversEquipmentFields(db);
    migrateReturnsEquipmentFields(db);
    migrateHandoverPhotosIssueFields(db);
    migrateReturnPhotosDeltaFields(db);
    migrateDocumentSnapshotTables(db);
    migrateUsersSignatureField(db);
    migrateHandoversSignatureFields(db);
    migrateReturnsSignatureFields(db);
  }
  return db;
}

export function resetDb(): void {
  if (db) {
    db.close();
    // @ts-expect-error reset singleton between tests/app restarts
    db = undefined;
  }
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
      signature_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      address_line1 TEXT NOT NULL DEFAULT '',
      address_line2 TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      contact_person TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS issuer_company_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT ''
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
      company_id INTEGER,
      trailer_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      company_address_line1 TEXT NOT NULL DEFAULT '',
      company_address_line2 TEXT NOT NULL DEFAULT '',
      company_postal_code TEXT NOT NULL DEFAULT '',
      company_tax_id TEXT NOT NULL DEFAULT '',
      company_phone TEXT NOT NULL DEFAULT '',
      company_email TEXT NOT NULL DEFAULT '',
      company_contact TEXT NOT NULL DEFAULT '',
      issuer_name TEXT NOT NULL DEFAULT '',
      issuer_address TEXT NOT NULL DEFAULT '',
      issuer_tax_id TEXT NOT NULL DEFAULT '',
      issuer_phone TEXT NOT NULL DEFAULT '',
      issuer_email TEXT NOT NULL DEFAULT '',
      prepared_by_name TEXT NOT NULL DEFAULT '',
      handover_date TEXT NOT NULL,
      handover_time TEXT NOT NULL,
      equipment_notes TEXT NOT NULL DEFAULT '',
      has_documents INTEGER NOT NULL DEFAULT 0,
      beams_count INTEGER NOT NULL DEFAULT 0,
      straps_count INTEGER NOT NULL DEFAULT 0,
      issuer_signature_path TEXT NOT NULL DEFAULT '',
      client_signature_path TEXT NOT NULL DEFAULT '',
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
      company_name TEXT NOT NULL DEFAULT '',
      company_address_line1 TEXT NOT NULL DEFAULT '',
      company_address_line2 TEXT NOT NULL DEFAULT '',
      company_postal_code TEXT NOT NULL DEFAULT '',
      company_tax_id TEXT NOT NULL DEFAULT '',
      company_phone TEXT NOT NULL DEFAULT '',
      company_email TEXT NOT NULL DEFAULT '',
      company_contact TEXT NOT NULL DEFAULT '',
      issuer_name TEXT NOT NULL DEFAULT '',
      issuer_address TEXT NOT NULL DEFAULT '',
      issuer_tax_id TEXT NOT NULL DEFAULT '',
      issuer_phone TEXT NOT NULL DEFAULT '',
      issuer_email TEXT NOT NULL DEFAULT '',
      prepared_by_name TEXT NOT NULL DEFAULT '',
      return_date TEXT NOT NULL,
      return_time TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      return_has_documents INTEGER NOT NULL DEFAULT 0,
      return_beams_count INTEGER NOT NULL DEFAULT 0,
      return_straps_count INTEGER NOT NULL DEFAULT 0,
      issuer_signature_path TEXT NOT NULL DEFAULT '',
      client_signature_path TEXT NOT NULL DEFAULT '',
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
      new_issue_description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
    CREATE INDEX IF NOT EXISTS idx_companies_tax_id ON companies(tax_id);
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

function migrateCompaniesFields(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='companies'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(companies)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('address_line1')) {
    db.exec("ALTER TABLE companies ADD COLUMN address_line1 TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE companies SET address_line1 = address WHERE TRIM(address_line1) = ''");
    console.log('[db] companies: added address_line1');
  }
  if (!names.includes('address_line2')) {
    db.exec("ALTER TABLE companies ADD COLUMN address_line2 TEXT NOT NULL DEFAULT ''");
    console.log('[db] companies: added address_line2');
  }
  if (!names.includes('postal_code')) {
    db.exec("ALTER TABLE companies ADD COLUMN postal_code TEXT NOT NULL DEFAULT ''");
    console.log('[db] companies: added postal_code');
  }
  if (!names.includes('tax_id')) {
    db.exec("ALTER TABLE companies ADD COLUMN tax_id TEXT NOT NULL DEFAULT ''");
    console.log('[db] companies: added tax_id');
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

function migrateReturnPhotosDeltaFields(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='return_photos'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(return_photos)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('new_issue_description')) {
    db.exec("ALTER TABLE return_photos ADD COLUMN new_issue_description TEXT NOT NULL DEFAULT ''");
    console.log('[db] return_photos: added new_issue_description');
  }
}

function migrateDocumentSnapshotTables(db: Database.Database): void {
  migrateHandoversSnapshotTable(db);
  migrateReturnsSnapshotTable(db);
}

function migrateHandoversSnapshotTable(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(handovers)').all() as Array<{
    name: string;
    notnull: number;
  }>;

  const names = columns.map((column) => column.name);
  const companyIdColumn = columns.find((column) => column.name === 'company_id');
  const requiredColumns = [
    'company_name',
    'company_address_line1',
    'company_address_line2',
    'company_postal_code',
    'company_tax_id',
    'company_phone',
    'company_email',
    'company_contact',
    'issuer_name',
    'issuer_address',
    'issuer_tax_id',
    'issuer_phone',
    'issuer_email',
    'prepared_by_name',
  ];

  const missingColumns = requiredColumns.filter((column) => !names.includes(column));
  const companyIdRequiresRebuild = companyIdColumn?.notnull === 1;

  if (missingColumns.length === 0 && !companyIdRequiresRebuild) {
    return;
  }

  console.log('[db] Rebuilding handovers table for snapshot fields...');
  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE handovers_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER,
        trailer_id INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        company_name TEXT NOT NULL DEFAULT '',
        company_address_line1 TEXT NOT NULL DEFAULT '',
        company_address_line2 TEXT NOT NULL DEFAULT '',
        company_postal_code TEXT NOT NULL DEFAULT '',
        company_tax_id TEXT NOT NULL DEFAULT '',
        company_phone TEXT NOT NULL DEFAULT '',
        company_email TEXT NOT NULL DEFAULT '',
        company_contact TEXT NOT NULL DEFAULT '',
        issuer_name TEXT NOT NULL DEFAULT '',
        issuer_address TEXT NOT NULL DEFAULT '',
        issuer_tax_id TEXT NOT NULL DEFAULT '',
        issuer_phone TEXT NOT NULL DEFAULT '',
        issuer_email TEXT NOT NULL DEFAULT '',
        prepared_by_name TEXT NOT NULL DEFAULT '',
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
    `);

    const rows = db.prepare(`
      SELECT
        h.*,
        c.name AS source_company_name,
        c.address AS source_company_address,
        c.address_line1 AS source_company_address_line1,
        c.address_line2 AS source_company_address_line2,
        c.postal_code AS source_company_postal_code,
        c.tax_id AS source_company_tax_id,
        c.phone AS source_company_phone,
        c.email AS source_company_email,
        c.contact_person AS source_company_contact,
        u.full_name AS source_prepared_by_name,
        ip.name AS source_issuer_name,
        ip.address AS source_issuer_address,
        ip.tax_id AS source_issuer_tax_id,
        ip.phone AS source_issuer_phone,
        ip.email AS source_issuer_email
      FROM handovers h
      LEFT JOIN companies c ON c.id = h.company_id
      LEFT JOIN users u ON u.id = h.created_by
      LEFT JOIN issuer_company_profile ip ON ip.id = 1
    `).all() as Array<Record<string, unknown>>;

    const insert = db.prepare(`
      INSERT INTO handovers_new (
        id, company_id, trailer_id, created_by,
        company_name, company_address_line1, company_address_line2, company_postal_code,
        company_tax_id, company_phone, company_email, company_contact,
        issuer_name, issuer_address, issuer_tax_id, issuer_phone, issuer_email, prepared_by_name,
        handover_date, handover_time, equipment_notes, has_documents, beams_count, straps_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      insert.run(
        row.id,
        row.company_id ?? null,
        row.trailer_id,
        row.created_by,
        row.company_name ?? row.source_company_name ?? '',
        row.company_address_line1 ?? row.source_company_address_line1 ?? row.source_company_address ?? '',
        row.company_address_line2 ?? row.source_company_address_line2 ?? '',
        row.company_postal_code ?? row.source_company_postal_code ?? '',
        row.company_tax_id ?? row.source_company_tax_id ?? '',
        row.company_phone ?? row.source_company_phone ?? '',
        row.company_email ?? row.source_company_email ?? '',
        row.company_contact ?? row.source_company_contact ?? '',
        row.issuer_name ?? row.source_issuer_name ?? '',
        row.issuer_address ?? row.source_issuer_address ?? '',
        row.issuer_tax_id ?? row.source_issuer_tax_id ?? '',
        row.issuer_phone ?? row.source_issuer_phone ?? '',
        row.issuer_email ?? row.source_issuer_email ?? '',
        row.prepared_by_name ?? row.source_prepared_by_name ?? '',
        row.handover_date,
        row.handover_time,
        row.equipment_notes,
        row.has_documents,
        row.beams_count,
        row.straps_count,
        row.status,
        row.created_at
      );
    }

    db.exec(`
      DROP TABLE handovers;
      ALTER TABLE handovers_new RENAME TO handovers;
    `);
  });
  migrate();
  db.pragma('foreign_keys = ON');
  console.log('[db] handovers snapshot migration complete.');
}

function migrateReturnsSnapshotTable(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='returns'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(returns)').all() as Array<{ name: string }>;
  const names = columns.map((column) => column.name);
  const requiredColumns = [
    'company_name',
    'company_address_line1',
    'company_address_line2',
    'company_postal_code',
    'company_tax_id',
    'company_phone',
    'company_email',
    'company_contact',
    'issuer_name',
    'issuer_address',
    'issuer_tax_id',
    'issuer_phone',
    'issuer_email',
    'prepared_by_name',
  ];

  const missingColumns = requiredColumns.filter((column) => !names.includes(column));
  if (missingColumns.length === 0) {
    return;
  }

  console.log('[db] Rebuilding returns table for snapshot fields...');
  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE returns_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handover_id INTEGER NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        company_name TEXT NOT NULL DEFAULT '',
        company_address_line1 TEXT NOT NULL DEFAULT '',
        company_address_line2 TEXT NOT NULL DEFAULT '',
        company_postal_code TEXT NOT NULL DEFAULT '',
        company_tax_id TEXT NOT NULL DEFAULT '',
        company_phone TEXT NOT NULL DEFAULT '',
        company_email TEXT NOT NULL DEFAULT '',
        company_contact TEXT NOT NULL DEFAULT '',
        issuer_name TEXT NOT NULL DEFAULT '',
        issuer_address TEXT NOT NULL DEFAULT '',
        issuer_tax_id TEXT NOT NULL DEFAULT '',
        issuer_phone TEXT NOT NULL DEFAULT '',
        issuer_email TEXT NOT NULL DEFAULT '',
        prepared_by_name TEXT NOT NULL DEFAULT '',
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
    `);

    const rows = db.prepare(`
      SELECT
        r.*,
        h.company_name AS source_company_name,
        h.company_address_line1 AS source_company_address_line1,
        h.company_address_line2 AS source_company_address_line2,
        h.company_postal_code AS source_company_postal_code,
        h.company_tax_id AS source_company_tax_id,
        h.company_phone AS source_company_phone,
        h.company_email AS source_company_email,
        h.company_contact AS source_company_contact,
        u.full_name AS source_prepared_by_name,
        ip.name AS source_issuer_name,
        ip.address AS source_issuer_address,
        ip.tax_id AS source_issuer_tax_id,
        ip.phone AS source_issuer_phone,
        ip.email AS source_issuer_email
      FROM returns r
      LEFT JOIN handovers h ON h.id = r.handover_id
      LEFT JOIN users u ON u.id = r.created_by
      LEFT JOIN issuer_company_profile ip ON ip.id = 1
    `).all() as Array<Record<string, unknown>>;

    const insert = db.prepare(`
      INSERT INTO returns_new (
        id, handover_id, created_by,
        company_name, company_address_line1, company_address_line2, company_postal_code,
        company_tax_id, company_phone, company_email, company_contact,
        issuer_name, issuer_address, issuer_tax_id, issuer_phone, issuer_email, prepared_by_name,
        return_date, return_time, notes, return_has_documents, return_beams_count, return_straps_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      insert.run(
        row.id,
        row.handover_id,
        row.created_by,
        row.company_name ?? row.source_company_name ?? '',
        row.company_address_line1 ?? row.source_company_address_line1 ?? '',
        row.company_address_line2 ?? row.source_company_address_line2 ?? '',
        row.company_postal_code ?? row.source_company_postal_code ?? '',
        row.company_tax_id ?? row.source_company_tax_id ?? '',
        row.company_phone ?? row.source_company_phone ?? '',
        row.company_email ?? row.source_company_email ?? '',
        row.company_contact ?? row.source_company_contact ?? '',
        row.issuer_name ?? row.source_issuer_name ?? '',
        row.issuer_address ?? row.source_issuer_address ?? '',
        row.issuer_tax_id ?? row.source_issuer_tax_id ?? '',
        row.issuer_phone ?? row.source_issuer_phone ?? '',
        row.issuer_email ?? row.source_issuer_email ?? '',
        row.prepared_by_name ?? row.source_prepared_by_name ?? '',
        row.return_date,
        row.return_time,
        row.notes,
        row.return_has_documents,
        row.return_beams_count,
        row.return_straps_count,
        row.created_at
      );
    }

    db.exec(`
      DROP TABLE returns;
      ALTER TABLE returns_new RENAME TO returns;
    `);
  });
  migrate();
  db.pragma('foreign_keys = ON');
  console.log('[db] returns snapshot migration complete.');
}

function migrateUsersSignatureField(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);
  if (!names.includes('signature_path')) {
    db.exec("ALTER TABLE users ADD COLUMN signature_path TEXT NOT NULL DEFAULT ''");
    console.log('[db] users: added signature_path');
  }
}

function migrateHandoversSignatureFields(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(handovers)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);
  if (!names.includes('issuer_signature_path')) {
    db.exec("ALTER TABLE handovers ADD COLUMN issuer_signature_path TEXT NOT NULL DEFAULT ''");
    console.log('[db] handovers: added issuer_signature_path');
  }
  if (!names.includes('client_signature_path')) {
    db.exec("ALTER TABLE handovers ADD COLUMN client_signature_path TEXT NOT NULL DEFAULT ''");
    console.log('[db] handovers: added client_signature_path');
  }
}

function migrateReturnsSignatureFields(db: Database.Database): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='returns'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare('PRAGMA table_info(returns)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);
  if (!names.includes('issuer_signature_path')) {
    db.exec("ALTER TABLE returns ADD COLUMN issuer_signature_path TEXT NOT NULL DEFAULT ''");
    console.log('[db] returns: added issuer_signature_path');
  }
  if (!names.includes('client_signature_path')) {
    db.exec("ALTER TABLE returns ADD COLUMN client_signature_path TEXT NOT NULL DEFAULT ''");
    console.log('[db] returns: added client_signature_path');
  }
}
