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
import schoolRouter from './routes/school.js';
import rehabProgramsRouter from './routes/rehabPrograms.js';
import injuriesRouter from './routes/injuries.js';
import soapNotesRouter from './routes/soapNotes.js';
import concussionsRouter, { rtpRouter } from './routes/concussions.js';
import anthropicRouter from './routes/anthropic.js';
import teamsRouter from './routes/teams.js';
import gpsRouter from './routes/gps.js';

const app = express();

// TODO: restrict origins once ECS is confirmed working
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/api/auth', authRouter);
app.use('/api/treatments', treatmentsRouter);
app.use('/api/daily-treatments', dailyTreatmentsRouter);
app.use('/api/athletes', athletesRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/school', schoolRouter);
app.use('/api/rehab-programs', rehabProgramsRouter);
app.use('/api/injuries', injuriesRouter);
app.use('/api/soap-notes', soapNotesRouter);
app.use('/api/concussions', concussionsRouter);
app.use('/api/rtp-protocols', rtpRouter);
app.use('/api/anthropic', anthropicRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/gps', gpsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
