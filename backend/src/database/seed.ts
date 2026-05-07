import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { getDb } from './schema';
import { parseTrailersCsv } from '../utils/trailerCsv';

export async function seedDefaultAdmin(): Promise<void> {
  const db = getDb();
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const fullName = process.env.ADMIN_FULL_NAME || 'Administrator';

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, fullName, 'admin');
    console.log(`Default admin user created (${username})`);
  }
}

export function seedTrailersFromCsv(): void {
  const csvPath = path.join(__dirname, '..', '..', '..', 'references', 'naczepy_spis.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('[seed] CSV file not found, skipping trailer seed.');
    return;
  }

  const db = getDb();
  const existingCount = (db.prepare('SELECT COUNT(*) AS count FROM trailers').get() as { count: number }).count;
  if (existingCount > 0) {
    return;
  }

  console.log('[seed] Seeding trailers from CSV...');
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const { rows, errors } = parseTrailersCsv(csv);

  for (const err of errors) {
    console.warn(`[seed] Skipping invalid row (line ${err.line}): ${err.reason}`);
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO trailers (registration_number, vin, brand, type, production_date) VALUES (?, ?, ?, ?, ?)'
  );

  const insertAll = db.transaction(() => {
    let imported = 0;
    for (const row of rows) {
      const result = insert.run(
        row.registration_number,
        row.vin,
        row.brand,
        row.type,
        row.production_date,
      );
      if (result.changes > 0) imported++;
    }
    console.log(`[seed] Imported ${imported} trailers.`);
  });

  insertAll();
}

if (require.main === module) {
  require('dotenv/config');
  seedDefaultAdmin().then(() => {
    seedTrailersFromCsv();
    console.log('Seed complete');
    process.exit(0);
  });
}
