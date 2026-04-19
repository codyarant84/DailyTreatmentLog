import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/treatments
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM treatments WHERE school_id = $1 ORDER BY date DESC, created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/treatments/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM treatments WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Treatment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treatments
router.post('/', async (req, res) => {
  const { athlete_name, date, treatment_type, body_part, notes, duration_minutes } = req.body;

  if (!athlete_name || !date || !treatment_type || !body_part) {
    return res.status(400).json({
      error: 'athlete_name, date, treatment_type, and body_part are required.',
    });
  }

  try {
    const { rows } = await query(
      `INSERT INTO treatments (athlete_name, date, treatment_type, body_part, notes, duration_minutes, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [athlete_name, date, treatment_type, body_part, notes || null, duration_minutes || null, req.schoolId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/treatments/:id
router.put('/:id', async (req, res) => {
  const { athlete_name, date, treatment_type, body_part, notes, duration_minutes } = req.body;

  try {
    const { rows } = await query(
      `UPDATE treatments
       SET athlete_name = $1, date = $2, treatment_type = $3, body_part = $4,
           notes = $5, duration_minutes = $6
       WHERE id = $7 AND school_id = $8
       RETURNING *`,
      [athlete_name, date, treatment_type, body_part, notes || null, duration_minutes || null,
       req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Treatment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/treatments/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM treatments WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
