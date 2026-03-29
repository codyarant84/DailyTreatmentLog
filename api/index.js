// Vercel serverless entry point.
// Exports the Express app as a function — Vercel's Node.js runtime accepts it directly.
// dotenv is NOT imported here; Vercel injects environment variables automatically.
import app from '../server/app.js';

export default app;
