import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// Base SELECT used by GET / and GET /:id
const INJURY_SELECT = `
  SELECT i.*, a.name AS athlete_name, a.sport AS athlete_sport
  FROM injuries i
  LEFT JOIN athletes a ON a.id = i.athlete_id
`;

// GET /api/injuries
// ?active=true          → only is_active injuries
// ?athlete_name=string  → injuries for a specific athlete (lookup by name)
router.get('/', async (req, res) => {
  try {
    const { active, athlete_name } = req.query;

    const conditions = ['i.school_id = $1'];
    const params = [req.schoolId];
    let p = 2;

    if (active === 'true') {
      conditions.push(`i.is_active = true`);
    }

    if (athlete_name) {
      conditions.push(`a.name = $${p++}`);
      params.push(decodeURIComponent(athlete_name));
    }

    const { rows } = await query(
      `${INJURY_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY i.injury_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/injuries/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `${INJURY_SELECT} WHERE i.id = $1 AND i.school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Injury not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/injuries
router.post('/', async (req, res) => {
  const { athlete_id, injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes } = req.body;

  if (!athlete_id || !injury_date || !body_part || !injury_type) {
    return res.status(400).json({ error: 'athlete_id, injury_date, body_part, and injury_type are required.' });
  }

  try {
    // Verify athlete belongs to this school
    const { rows: athRows } = await query(
      `SELECT id FROM athletes WHERE id = $1 AND school_id = $2`,
      [athlete_id, req.schoolId]
    );
    if (!athRows[0]) return res.status(400).json({ error: 'Athlete not found.' });

    const { rows } = await query(
      `INSERT INTO injuries
         (athlete_id, school_id, logged_by, injury_date, body_part, injury_type,
          mechanism, severity, rtp_status, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING *`,
      [athlete_id, req.schoolId, req.userId, injury_date, body_part, injury_type,
       mechanism || null, severity || null, rtp_status || 'Out', notes || null]
    );

    // Fetch with athlete join for response shape
    const { rows: full } = await query(
      `${INJURY_SELECT} WHERE i.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    console.error('POST /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/injuries/:id
router.put('/:id', async (req, res) => {
  const { injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes, is_active } = req.body;

  if (!injury_date || !body_part || !injury_type) {
    return res.status(400).json({ error: 'injury_date, body_part, and injury_type are required.' });
  }

  try {
    const wasActive = is_active ?? true;
    const isNowInactive = wasActive === false;

    const { rows } = await query(
      `UPDATE injuries
       SET injury_date = $1, body_part = $2, injury_type = $3, mechanism = $4,
           severity = $5, rtp_status = $6, notes = $7, is_active = $8,
           cleared_at = CASE WHEN $9 THEN NOW() ELSE cleared_at END
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [injury_date, body_part, injury_type, mechanism || null, severity || null,
       rtp_status || 'Out', notes || null, wasActive, isNowInactive,
       req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Injury not found.' });

    const { rows: full } = await query(`${INJURY_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.json(full[0]);
  } catch (err) {
    console.error('PUT /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/injuries/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM injuries WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
