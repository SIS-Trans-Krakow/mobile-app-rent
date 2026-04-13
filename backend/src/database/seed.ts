import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { getDb, VALID_TRAILER_TYPES } from './schema';

const TYPE_NORMALIZE: Record<string, string> = {
  'BOX': 'Box',
  'Box': 'Box',
  'Kurtyna': 'Kurtyna',
  'Kurtyna MEGA': 'Kurtyna MEGA',
  'CHŁODNIA': 'Chłodnia',
  'Chłodnia': 'Chłodnia',
  'Izoterma': 'Izoterma',
  'TANDEM': 'TANDEM',
  'Double Deck': 'Double Deck',
};

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
  const lines = csv.split('\n').slice(1).filter((l) => l.trim());

  const insert = db.prepare(
    'INSERT OR IGNORE INTO trailers (registration_number, vin, brand, type, production_date) VALUES (?, ?, ?, ?, ?)'
  );

  const insertAll = db.transaction(() => {
    let imported = 0;
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 5) continue;

      const regNum = parts[0];
      const vin = parts[1];
      const productionDate = parts[2] || '';
      const brand = parts[3];
      const rawType = parts.slice(4).join(',').trim();
      const normalizedType = TYPE_NORMALIZE[rawType];

      if (!regNum || !normalizedType) {
        console.warn(`[seed] Skipping invalid row: ${line.substring(0, 60)}`);
        continue;
      }

      insert.run(regNum, vin, brand, normalizedType, productionDate);
      imported++;
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
