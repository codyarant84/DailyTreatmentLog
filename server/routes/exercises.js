import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/exercises — global library, all schools, alphabetical
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, description, video_url, body_parts FROM exercises ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exercises
router.post('/', async (req, res) => {
  const { name, description, video_url, body_parts } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await query(
      `INSERT INTO exercises (name, description, video_url, body_parts)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, video_url, body_parts`,
      [name.trim(), description?.trim() || null, video_url?.trim() || null, body_parts?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Exercise already exists' });
    console.error('POST /exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exercises/:id
router.put('/:id', async (req, res) => {
  const { name, description, video_url, body_parts } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await query(
      `UPDATE exercises
       SET name = $1, description = $2, video_url = $3, body_parts = $4
       WHERE id = $5
       RETURNING id, name, description, video_url, body_parts`,
      [name.trim(), description?.trim() || null, video_url?.trim() || null, body_parts?.trim() || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Exercise not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /exercises/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM exercises WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /exercises/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
