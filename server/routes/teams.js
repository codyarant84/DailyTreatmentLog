import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/teams — all teams for the school with athlete count
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.id, t.name, t.sport, t.season, t.is_active, t.created_at,
              COUNT(ta.id)::int AS athlete_count
       FROM teams t
       LEFT JOIN team_athletes ta ON ta.team_id = t.id
       WHERE t.school_id = $1
       GROUP BY t.id
       ORDER BY t.is_active DESC, t.name ASC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /teams error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams
router.post('/', async (req, res) => {
  const { name, sport, season } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await query(
      `INSERT INTO teams (school_id, name, sport, season, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, sport, season, is_active, created_at`,
      [req.schoolId, name.trim(), sport?.trim() || null, season?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /teams error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id
router.put('/:id', async (req, res) => {
  const { name, sport, season, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await query(
      `UPDATE teams
       SET name = $1, sport = $2, season = $3, is_active = $4
       WHERE id = $5 AND school_id = $6
       RETURNING id, name, sport, season, is_active, created_at`,
      [name.trim(), sport?.trim() || null, season?.trim() || null, is_active ?? true,
       req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /teams/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM teams WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /teams/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:id/athletes
router.get('/:id/athletes', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade, a.date_of_birth,
              a.emergency_contact_name, a.emergency_contact_phone,
              ta.jersey_number, ta.position
       FROM team_athletes ta
       JOIN athletes a ON a.id = ta.athlete_id
       WHERE ta.team_id = $1 AND ta.school_id = $2
       ORDER BY ta.jersey_number ASC NULLS LAST`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /teams/:id/athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:id/athletes — add athlete to team, ignore if already present
router.post('/:id/athletes', async (req, res) => {
  const { athlete_id, jersey_number, position } = req.body;
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id is required' });

  try {
    await query(
      `INSERT INTO team_athletes (team_id, athlete_id, school_id, jersey_number, position)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, athlete_id) DO NOTHING`,
      [req.params.id, athlete_id, req.schoolId, jersey_number || null, position?.trim() || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST /teams/:id/athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id/athletes/:athleteId
router.delete('/:id/athletes/:athleteId', async (req, res) => {
  try {
    await query(
      `DELETE FROM team_athletes WHERE team_id = $1 AND athlete_id = $2 AND school_id = $3`,
      [req.params.id, req.params.athleteId, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /teams/:id/athletes/:athleteId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
