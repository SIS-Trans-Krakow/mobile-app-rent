import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import companyRoutes from './routes/companies';
import companyProfileRoutes from './routes/company-profile';
import trailerRoutes from './routes/trailers';
import handoverRoutes from './routes/handovers';
import returnRoutes from './routes/returns';
import pdfRoutes from './routes/pdf';
import { getUploadsDir } from './utils/paths';

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use('/uploads', express.static(getUploadsDir()));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/trailers', trailerRoutes);
app.use('/api/handovers', handoverRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/pdf', pdfRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
