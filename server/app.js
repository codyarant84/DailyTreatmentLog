// Shared Express app — no listen() call so this file works in both
// local dev (server/index.js calls listen) and Vercel serverless (api/index.js exports it).
import express from 'express';
import cors from 'cors';
import treatmentsRouter from './routes/treatments.js';
import dailyTreatmentsRouter from './routes/dailyTreatments.js';
import athletesRouter from './routes/athletes.js';
import authRouter from './routes/auth.js';
import exercisesRouter from './routes/exercises.js';
import adminRouter from './routes/admin.js';

const app = express();

// In production on Vercel the client and API share the same domain (same-origin),
// so the browser never sends a cross-origin request and CORS headers are irrelevant.
// We still run the middleware so development (localhost:5173 → localhost:3001) works.
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);
app.use('/api/treatments', treatmentsRouter);
app.use('/api/daily-treatments', dailyTreatmentsRouter);
app.use('/api/athletes', athletesRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
