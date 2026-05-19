import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/athletes
router.get('/', async (req, res) => {
  const includeArchived = req.query.include_archived === 'true';
  const conditions = ['a.school_id = $1'];
  const params = [req.schoolId];
  let p = 2;

  if (!includeArchived) conditions.push('(a.archived = false OR a.archived IS NULL)');
  if (req.role === 'coach' && req.coachSport) {
    conditions.push(`a.sport = $${p++}`);
    params.push(req.coachSport);
  }

  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade, a.date_of_birth,
              a.emergency_contact_name, a.emergency_contact_phone,
              a.created_at, a.archived,
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

// POST /api/athletes
router.post('/', async (req, res) => {
  const { first_name, last_name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone } = req.body;

  if (!first_name?.trim()) return res.status(400).json({ error: 'First name is required.' });
  if (!last_name?.trim())  return res.status(400).json({ error: 'Last name is required.' });
  if (!sport?.trim())      return res.status(400).json({ error: 'Sport is required.' });
  if (!grade?.trim())      return res.status(400).json({ error: 'Grade is required.' });

  const name = `${first_name.trim()} ${last_name.trim()}`;

  try {
    const { rows } = await query(
      `INSERT INTO athletes (school_id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at`,
      [req.schoolId, name, sport.trim(), grade.trim(), date_of_birth || null, emergency_contact_name?.trim() || null, emergency_contact_phone?.trim() || null]
    );
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
