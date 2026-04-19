import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/athletes
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at FROM athletes WHERE school_id = $1 ORDER BY name',
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /athletes error:', err.message);
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
      query('SELECT COUNT(*)::int AS cnt FROM injuries WHERE school_id = $1 AND athlete_name = $2', [req.schoolId, athlete.name]),
      query('SELECT COUNT(*)::int AS cnt FROM concussion_cases WHERE school_id = $1 AND athlete_id = $2', [req.schoolId, athlete.id]),
    ]);

    const hasRecords =
      treatmentsRes.rows[0].cnt > 0 ||
      injuriesRes.rows[0].cnt   > 0 ||
      concussionsRes.rows[0].cnt > 0;

    if (hasRecords) {
      return res.status(409).json({ error: `${athlete.name} has existing treatment or injury records and cannot be deleted.` });
    }

    await query('DELETE FROM athletes WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /athletes/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
