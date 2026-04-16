import 'dotenv/config';
import { seedDefaultAdmin, seedTrailersFromCsv } from './database/seed';
import app from './app';
const PORT = process.env.PORT || 3001;

async function start() {
  await seedDefaultAdmin();
  seedTrailersFromCsv();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
