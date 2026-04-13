import express from 'express';
import cors from 'cors';
import path from 'path';
import { seedDefaultAdmin } from './database/seed';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import companyRoutes from './routes/companies';
import trailerRoutes from './routes/trailers';
import handoverRoutes from './routes/handovers';
import returnRoutes from './routes/returns';
import pdfRoutes from './routes/pdf';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/trailers', trailerRoutes);
app.use('/api/handovers', handoverRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/pdf', pdfRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await seedDefaultAdmin();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
