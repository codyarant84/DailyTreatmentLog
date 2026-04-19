// One-time migration: copies email addresses from Supabase auth.users into
// the RDS profiles table. Run once with:
//   node server/scripts/migrateUsers.js
//
// Requires these env vars (same ones the server uses):
//   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

// ── Validate env vars up front ────────────────────────────────────────────────
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Strip sslmode from the URL so the pool ssl option takes full control
// (same logic as server/lib/db.js)
const connectionString = DATABASE_URL
  .replace(/[?&]sslmode=[^&]*/g, (m) => (m.startsWith('?') ? '?' : ''))
  .replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ── Fetch all Supabase auth users (handles pagination) ────────────────────────
async function fetchAllSupabaseUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Supabase listUsers failed: ${error.message}`);

    users.push(...data.users);

    // Stop when we've received a partial page (no more pages)
    if (data.users.length < perPage) break;
    page++;
  }

  return users;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching users from Supabase auth...');
  const supabaseUsers = await fetchAllSupabaseUsers();
  console.log(`Found ${supabaseUsers.length} users in Supabase auth.\n`);

  let migrated = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const user of supabaseUsers) {
    const { id, email } = user;

    if (!email) {
      console.warn(`  SKIP  ${id} — no email address`);
      skipped++;
      continue;
    }

    try {
      const result = await pool.query(
        `UPDATE profiles SET email = $1 WHERE id = $2`,
        [email.trim().toLowerCase(), id]
      );

      if (result.rowCount === 0) {
        console.warn(`  SKIP  ${email} (${id}) — no matching profile in RDS`);
        skipped++;
      } else {
        console.log(`  OK    ${email} (${id})`);
        migrated++;
      }
    } catch (err) {
      console.error(`  ERROR ${email} (${id}) — ${err.message}`);
      errors++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`Migration complete`);
  console.log(`  Migrated : ${migrated}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Errors   : ${errors}`);
  console.log('─────────────────────────────────');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
