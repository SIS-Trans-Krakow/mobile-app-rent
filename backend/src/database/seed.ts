import bcrypt from 'bcrypt';
import { getDb } from './schema';

export async function seedDefaultAdmin(): Promise<void> {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 12);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'Administrator', 'admin');
    console.log('Default admin user created (admin / admin123)');
  }
}

if (require.main === module) {
  seedDefaultAdmin().then(() => {
    console.log('Seed complete');
    process.exit(0);
  });
}
