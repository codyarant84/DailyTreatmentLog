import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { calculateSavings } from '../lib/cptCodes.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/daily-treatments/athletes — distinct athlete names for this school
router.get('/athletes', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT athlete_name FROM daily_treatments
       WHERE school_id = $1 ORDER BY athlete_name`,
      [req.schoolId]
    );
    res.json(rows.map((r) => r.athlete_name));
  } catch (err) {
    console.error('GET /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-treatments
// ?date=YYYY-MM-DD      → single day (dashboard); sorts ASC
// ?athlete_name=string  → profile page; sorts DESC
// ?from / ?to           → date range (inclusive)
// ?treatment_type       → exact match
// ?sport                → exact match
router.get('/', async (req, res) => {
  try {
    const { date, athlete_name, from, to, treatment_type, sport } = req.query;

    const conditions = ['school_id = $1'];
    const params = [req.schoolId];
    let p = 2;

    if (date)           { conditions.push(`date = $${p++}`);           params.push(date); }
    if (athlete_name)   { conditions.push(`athlete_name = $${p++}`);   params.push(decodeURIComponent(athlete_name)); }
    if (from)           { conditions.push(`date >= $${p++}`);          params.push(from); }
    if (to)             { conditions.push(`date <= $${p++}`);          params.push(to); }
    if (treatment_type) { conditions.push(`treatment_type = $${p++}`); params.push(decodeURIComponent(treatment_type)); }
    if (sport)          { conditions.push(`sport = $${p++}`);          params.push(decodeURIComponent(sport)); }

    // Dashboard (single day) → chronological ASC; everything else → newest first
    const dir = (Boolean(date) && !athlete_name) ? 'ASC' : 'DESC';

    const { rows } = await query(
      `SELECT * FROM daily_treatments
       WHERE ${conditions.join(' AND ')}
       ORDER BY date ${dir}, created_at ${dir}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /daily-treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-treatments
router.post('/', async (req, res) => {
  const {
    athlete_name, sport, date, treatment_type, body_part,
    duration_minutes, notes, exercises_performed, injury_id,
  } = req.body;

  if (!athlete_name || !sport || !date || !treatment_type || !body_part) {
    return res.status(400).json({
      error: 'athlete_name, sport, date, treatment_type, and body_part are required.',
    });
  }

  try {
    const { rows: profile } = await query(`SELECT email FROM profiles WHERE id = $1`, [req.userId]);
    const logged_by_email = profile[0]?.email ?? null;

    const { rows } = await query(
      `INSERT INTO daily_treatments (
         athlete_name, sport, date, treatment_type, body_part,
         duration_minutes, notes, exercises_performed,
         estimated_savings, injury_id, school_id, logged_by_email
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        athlete_name.trim(), sport, date, treatment_type, body_part,
        duration_minutes || null, notes || null, exercises_performed || null,
        calculateSavings(treatment_type, body_part).total || null,
        injury_id || null, req.schoolId, logged_by_email,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /daily-treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-treatments/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM daily_treatments WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Treatment not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /daily-treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/daily-treatments/:id
router.put('/:id', async (req, res) => {
  const {
    athlete_name, sport, date, treatment_type, body_part,
    duration_minutes, notes, exercises_performed, injury_id,
  } = req.body;

  if (!athlete_name || !sport || !date || !treatment_type || !body_part) {
    return res.status(400).json({
      error: 'athlete_name, sport, date, treatment_type, and body_part are required.',
    });
  }

  try {
    const { rows } = await query(
      `UPDATE daily_treatments SET
         athlete_name = $1, sport = $2, date = $3, treatment_type = $4, body_part = $5,
         duration_minutes = $6, notes = $7, exercises_performed = $8,
         estimated_savings = $9, injury_id = $10
       WHERE id = $11 AND school_id = $12
       RETURNING *`,
      [
        athlete_name.trim(), sport, date, treatment_type, body_part,
        duration_minutes || null, notes || null, exercises_performed || null,
        calculateSavings(treatment_type, body_part).total || null,
        injury_id || null, req.params.id, req.schoolId,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Treatment not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /daily-treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/daily-treatments/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM daily_treatments WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /daily-treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
