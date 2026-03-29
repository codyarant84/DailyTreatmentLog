// Shared Express app — no listen() call so this file works in both
// local dev (server/index.js calls listen) and Vercel serverless (api/index.js exports it).
import express from 'express';
import cors from 'cors';
import treatmentsRouter from './routes/treatments.js';
import dailyTreatmentsRouter from './routes/dailyTreatments.js';
import athletesRouter from './routes/athletes.js';
import authRouter from './routes/auth.js';

const app = express();

// In production (Vercel) client and server share the same origin, so CORS only
// matters for local dev. CLIENT_URL can be set to a custom domain if needed.
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:5173']
  : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);
app.use('/api/treatments', treatmentsRouter);
app.use('/api/daily-treatments', dailyTreatmentsRouter);
app.use('/api/athletes', athletesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
