// Local development entry point only.
// Loads .env and starts the HTTP server.
// Vercel uses api/index.js instead — it never calls this file.
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
