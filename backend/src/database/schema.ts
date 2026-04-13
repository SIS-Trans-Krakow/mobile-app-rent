import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app.db');

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
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
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
      type TEXT NOT NULL CHECK(type IN ('Kurtyna', 'Box', 'Izoterma', 'Chłodnia'))
    );

    CREATE TABLE IF NOT EXISTS handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      trailer_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      handover_date TEXT NOT NULL,
      handover_time TEXT NOT NULL,
      equipment_notes TEXT NOT NULL DEFAULT '',
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
}
