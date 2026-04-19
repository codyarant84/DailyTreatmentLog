import pg from 'pg';

const { Pool } = pg;

// Strip sslmode from the URL so the pool ssl option takes full control
const connectionString = process.env.DATABASE_URL?.replace(/[?&]sslmode=[^&]*/g, (m) =>
  m.startsWith('?') ? '?' : ''
).replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const query = (text, params) => pool.query(text, params);
export { pool };
