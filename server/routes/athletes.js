import express from 'express';
import { query, pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { logActivity } from '../middleware/logActivity.js';
import { calculateRiskFlags, getHighRiskAthletes } from '../lib/riskFlags.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/athletes
router.get('/', async (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  const archivedOnly    = req.query.archived_only === 'true';
  const conditions = ['a.school_id = $1'];
  const params = [req.schoolId];
  let p = 2;

  if (archivedOnly) {
    conditions.push('a.archived = true');
  } else if (!includeArchived) {
    conditions.push('(a.archived = false OR a.archived IS NULL)');
  }
  if (req.role === 'coach' && req.coachSport) {
    conditions.push(`a.sport = $${p++}`);
    params.push(req.coachSport);
  }

  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade, a.date_of_birth,
              a.emergency_contact_name, a.emergency_contact_phone,
              a.created_at, a.archived, a.archived_reason, a.archived_at,
              a.graduation_year, a.eligibility_override,
              (SELECT COUNT(*)::int FROM athlete_flags WHERE athlete_id = a.id) AS flag_count,
              (SELECT severity FROM athlete_flags WHERE athlete_id = a.id
               ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END LIMIT 1
              ) AS top_flag_severity
       FROM athletes a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athletes/archived — full archive detail (reason, date, grade/year at archive)
router.get('/archived', async (req, res) => {
  const conditions = ['a.school_id = $1', 'a.archived = true'];
  const params = [req.schoolId];
  let p = 2;

  if (req.role === 'coach' && req.coachSport) {
    conditions.push(`a.sport = $${p++}`);
    params.push(req.coachSport);
  }

  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade, a.archived_reason, a.archived_at, a.graduation_year
       FROM athletes a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.archived_at DESC NULLS LAST, a.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /athletes/archived error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athletes/by-name/:name
router.get('/by-name/:name', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade, a.date_of_birth,
              a.emergency_contact_name, a.emergency_contact_phone, a.archived
       FROM athletes a
       WHERE a.school_id = $1 AND a.name = $2 LIMIT 1`,
      [req.schoolId, decodeURIComponent(req.params.name)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Athlete not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /athletes/by-name/:name error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/athletes/high-risk — all athletes with at least one active risk flag
router.get('/high-risk', async (req, res) => {
  try {
    const coachSport = req.role === 'coach' ? req.coachSport : null;
    const athletes = await getHighRiskAthletes(req.schoolId, { coachSport });
    res.json(athletes);
  } catch (err) {
    console.error('GET /athletes/high-risk error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes
router.post('/', async (req, res) => {
  const { first_name, last_name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone } = req.body;

  if (!first_name?.trim()) return res.status(400).json({ error: 'First name is required.' });
  if (!last_name?.trim())  return res.status(400).json({ error: 'Last name is required.' });
  if (!sport?.trim())      return res.status(400).json({ error: 'Sport is required.' });

  const name = `${first_name.trim()} ${last_name.trim()}`;

  try {
    const { rows } = await query(
      `INSERT INTO athletes (school_id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at`,
      [req.schoolId, name, sport.trim(), grade?.trim() || null, date_of_birth || null, emergency_contact_name?.trim() || null, emergency_contact_phone?.trim() || null]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'athlete.created', entityType: 'athlete', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `An athlete named "${name}" already exists.` });
    console.error('POST /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes/import
router.post('/import', async (req, res) => {
  const { rows: inputRows } = req.body;
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return res.status(400).json({ error: 'No rows provided.' });
  }
  if (inputRows.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 rows per import.' });
  }

  const invalid = inputRows.filter((r) => !r.name?.trim());
  if (invalid.length > 0) {
    return res.status(400).json({ error: `${invalid.length} row(s) are missing the athlete name field.` });
  }

  try {
    const placeholders = inputRows.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(', ');
    const values = [req.schoolId, ...inputRows.flatMap((r) => [r.name.trim(), r.sport?.trim() || null, r.grade?.trim() || null, r.date_of_birth || null])];

    const { rows } = await query(
      `INSERT INTO athletes (school_id, name, sport, grade, date_of_birth)
       VALUES ${placeholders}
       ON CONFLICT (school_id, name) DO NOTHING
       RETURNING id`,
      values
    );

    const imported = rows.length;
    const skipped  = inputRows.length - imported;
    res.json({ imported, skipped, total: inputRows.length });
  } catch (err) {
    console.error('POST /athletes/import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/athletes/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows: found } = await query(
      'SELECT id, name FROM athletes WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Athlete not found.' });

    const athlete = found[0];

    const [treatmentsRes, injuriesRes, concussionsRes] = await Promise.all([
      query('SELECT COUNT(*)::int AS cnt FROM daily_treatments WHERE school_id = $1 AND athlete_name = $2', [req.schoolId, athlete.name]),
      query('SELECT COUNT(*)::int AS cnt FROM injuries WHERE school_id = $1 AND athlete_id = $2', [req.schoolId, athlete.id]),
      query('SELECT COUNT(*)::int AS cnt FROM concussion_cases WHERE school_id = $1 AND athlete_id = $2', [req.schoolId, athlete.id]),
    ]);

    const hasRecords =
      treatmentsRes.rows[0].cnt > 0 ||
      injuriesRes.rows[0].cnt   > 0 ||
      concussionsRes.rows[0].cnt > 0;

    if (hasRecords) {
      await query('UPDATE athletes SET archived = true WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
      return res.json({ archived: true, message: 'Athlete archived successfully.' });
    }

    await query('DELETE FROM athletes WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /athletes/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athletes/:id — edit core fields (name is immutable: daily_treatments,
// treatments, and rehab_programs key off it by text with no FK to repoint).
router.put('/:id', async (req, res) => {
  const { sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, eligibility_override } = req.body;

  const fields = [];
  const params = [];
  let p = 1;
  if (sport !== undefined)                   { fields.push(`sport = $${p++}`);                   params.push(sport?.trim() || null); }
  if (grade !== undefined)                   { fields.push(`grade = $${p++}`);                   params.push(grade?.trim() || null); }
  if (date_of_birth !== undefined)           { fields.push(`date_of_birth = $${p++}`);            params.push(date_of_birth || null); }
  if (emergency_contact_name !== undefined)  { fields.push(`emergency_contact_name = $${p++}`);   params.push(emergency_contact_name?.trim() || null); }
  if (emergency_contact_phone !== undefined) { fields.push(`emergency_contact_phone = $${p++}`);  params.push(emergency_contact_phone?.trim() || null); }
  if (eligibility_override !== undefined)    { fields.push(`eligibility_override = $${p++}`);     params.push(!!eligibility_override); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields provided.' });

  params.push(req.params.id, req.schoolId);

  try {
    const { rows } = await query(
      `UPDATE athletes SET ${fields.join(', ')} WHERE id = $${p++} AND school_id = $${p}
       RETURNING id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, eligibility_override`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Athlete not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /athletes/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes/:id/unarchive
router.post('/:id/unarchive', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE athletes SET archived = false, archived_reason = NULL, archived_at = NULL
       WHERE id = $1 AND school_id = $2
       RETURNING id, name`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Athlete not found.' });
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'athlete.unarchived', entityType: 'athlete', entityId: rows[0].id });
    res.json({ success: true });
  } catch (err) {
    console.error('POST /athletes/:id/unarchive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/athletes/:id/permanent — irreversible; archived athletes only.
router.delete('/:id/permanent', requireAdmin, async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Pass { confirm: true } to permanently delete this athlete.' });
  }

  const client = await pool.connect();
  try {
    const { rows: found } = await client.query(
      'SELECT id, name, archived FROM athletes WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    if (!found[0]) {
      return res.status(404).json({ error: 'Athlete not found.' });
    }
    const athlete = found[0];
    if (!athlete.archived) {
      return res.status(400).json({ error: 'Only archived athletes can be permanently deleted.' });
    }

    await client.query('BEGIN');

    // concussion_cases has no FK to athletes at all, and its own child
    // tables (checkins/assessments/links) key off case_id — clean up
    // explicitly before removing the case rows themselves.
    await client.query(
      `DELETE FROM concussion_checkins WHERE case_id IN
        (SELECT id FROM concussion_cases WHERE athlete_id = $1 AND school_id = $2)`,
      [athlete.id, req.schoolId]
    );
    await client.query(
      `DELETE FROM concussion_assessments WHERE case_id IN
        (SELECT id FROM concussion_cases WHERE athlete_id = $1 AND school_id = $2)`,
      [athlete.id, req.schoolId]
    );
    await client.query(
      `DELETE FROM concussion_links WHERE case_id IN
        (SELECT id FROM concussion_cases WHERE athlete_id = $1 AND school_id = $2)`,
      [athlete.id, req.schoolId]
    );
    await client.query('DELETE FROM concussion_cases WHERE athlete_id = $1 AND school_id = $2', [athlete.id, req.schoolId]);

    // soap_notes has direct athlete_id/school_id columns but no confirmed
    // cascade (predates the migration-script convention) — clean up explicitly.
    await client.query('DELETE FROM soap_notes WHERE athlete_id = $1 AND school_id = $2', [athlete.id, req.schoolId]);

    // Name-keyed tables (no FK possible).
    await client.query('DELETE FROM daily_treatments WHERE athlete_name = $1 AND school_id = $2', [athlete.name, req.schoolId]);
    await client.query('DELETE FROM treatments WHERE athlete_name = $1 AND school_id = $2', [athlete.name, req.schoolId]);
    await client.query('DELETE FROM rehab_programs WHERE athlete_name = $1 AND school_id = $2', [athlete.name, req.schoolId]);

    // Everything else (injuries + injury_attachments, general_medical,
    // athlete_flags, treatment_requests, portal_parent_athlete) cascades via
    // FK; portal_users.athlete_id is ON DELETE SET NULL.
    await client.query('DELETE FROM athletes WHERE id = $1 AND school_id = $2', [athlete.id, req.schoolId]);

    await client.query('COMMIT');
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'athlete.permanently_deleted', entityType: 'athlete', entityId: athlete.id, metadata: { name: athlete.name } });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DELETE /athletes/:id/permanent error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Risk flags (automatic, computed fresh on every request) ─────────

// GET /api/athletes/:id/risk-flags
router.get('/:id/risk-flags', async (req, res) => {
  try {
    const { rows: found } = await query(
      'SELECT id FROM athletes WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Athlete not found.' });

    const flags = await calculateRiskFlags(req.params.id, req.schoolId);
    res.json(flags);
  } catch (err) {
    console.error('GET /athletes/:id/risk-flags error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Flags ──────────────────────────────────────────────────────────

// GET /api/athletes/:id/flags
router.get('/:id/flags', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM athlete_flags
       WHERE athlete_id = $1 AND school_id = $2
       ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /athletes/:id/flags error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes/:id/flags
router.post('/:id/flags', async (req, res) => {
  const { flag_type, description, severity } = req.body;
  if (!flag_type || !description?.trim()) {
    return res.status(400).json({ error: 'flag_type and description are required.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO athlete_flags (athlete_id, school_id, flag_type, description, severity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.schoolId, flag_type, description.trim(), severity || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /athletes/:id/flags error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/athletes/:id/flags/:flagId
router.put('/:id/flags/:flagId', async (req, res) => {
  const { flag_type, description, severity } = req.body;
  if (!flag_type || !description?.trim()) {
    return res.status(400).json({ error: 'flag_type and description are required.' });
  }

  try {
    const { rows } = await query(
      `UPDATE athlete_flags
       SET flag_type = $1, description = $2, severity = $3
       WHERE id = $4 AND athlete_id = $5 AND school_id = $6
       RETURNING *`,
      [flag_type, description.trim(), severity || null, req.params.flagId, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Flag not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /athletes/:id/flags/:flagId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/athletes/:id/flags/:flagId
router.delete('/:id/flags/:flagId', async (req, res) => {
  try {
    await query(
      `DELETE FROM athlete_flags WHERE id = $1 AND athlete_id = $2 AND school_id = $3`,
      [req.params.flagId, req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /athletes/:id/flags/:flagId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
