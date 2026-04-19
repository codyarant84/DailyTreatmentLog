import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// Bulk-insert program_exercises rows from an exercises array
async function insertProgramExercises(programId, exercises) {
  if (!exercises.length) return;

  const values = [];
  const params = [];
  let p = 1;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(
      programId,
      ex.exercise_id,
      ex.sets || null,
      ex.reps || null,
      ex.duration_seconds || null,
      ex.notes?.trim() || null,
      i
    );
  }

  await query(
    `INSERT INTO program_exercises (program_id, exercise_id, sets, reps, duration_seconds, notes, sort_order)
     VALUES ${values.join(', ')}`,
    params
  );
}

// GET /api/rehab-programs
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT rp.id, rp.name, rp.description, rp.athlete_name, rp.is_shared, rp.created_at,
              COUNT(pe.id)::int AS exercise_count
       FROM rehab_programs rp
       LEFT JOIN program_exercises pe ON pe.program_id = rp.id
       WHERE (rp.school_id = $1 OR rp.is_shared = true)
       GROUP BY rp.id
       ORDER BY rp.created_at DESC`,
      [req.schoolId]
    );

    res.json(rows.map((r) => ({ ...r, is_shared: r.is_shared ?? false })));
  } catch (err) {
    console.error('GET /rehab-programs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rehab-programs/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows: programs } = await query(
      `SELECT id, name, description, athlete_name, is_shared, created_at
       FROM rehab_programs
       WHERE id = $1 AND (school_id = $2 OR is_shared = true)`,
      [req.params.id, req.schoolId]
    );
    if (!programs[0]) return res.status(404).json({ error: 'Program not found' });

    const { rows: exRows } = await query(
      `SELECT pe.id, pe.sets, pe.reps, pe.duration_seconds, pe.notes, pe.sort_order,
              e.id AS exercise_id, e.name AS exercise_name, e.video_url AS exercise_video_url
       FROM program_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.program_id = $1
       ORDER BY pe.sort_order`,
      [req.params.id]
    );

    // Rebuild nested shape the client expects
    const program = {
      ...programs[0],
      program_exercises: exRows.map((r) => ({
        id:               r.id,
        sets:             r.sets,
        reps:             r.reps,
        duration_seconds: r.duration_seconds,
        notes:            r.notes,
        sort_order:       r.sort_order,
        exercises:        { id: r.exercise_id, name: r.exercise_name, video_url: r.exercise_video_url },
      })),
    };

    res.json(program);
  } catch (err) {
    console.error('GET /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rehab-programs
router.post('/', async (req, res) => {
  const { name, description, athlete_name, is_shared, exercises = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    // Only super_admin can create shared programs
    const { rows: profile } = await query(`SELECT role FROM profiles WHERE id = $1`, [req.userId]);
    const role = profile[0]?.role ?? 'trainer';
    const sharedFlag = role === 'super_admin' ? (is_shared === true) : false;

    const { rows } = await query(
      `INSERT INTO rehab_programs (school_id, name, description, athlete_name, is_shared)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.schoolId, name.trim(), description?.trim() || null, athlete_name?.trim() || null, sharedFlag]
    );

    await insertProgramExercises(rows[0].id, exercises);

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error('POST /rehab-programs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rehab-programs/:id
router.put('/:id', async (req, res) => {
  const { name, description, athlete_name, exercises = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    await query(
      `UPDATE rehab_programs
       SET name = $1, description = $2, athlete_name = $3
       WHERE id = $4 AND school_id = $5`,
      [name.trim(), description?.trim() || null, athlete_name?.trim() || null,
       req.params.id, req.schoolId]
    );

    // Replace exercise list
    await query(`DELETE FROM program_exercises WHERE program_id = $1`, [req.params.id]);
    await insertProgramExercises(req.params.id, exercises);

    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rehab-programs/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM rehab_programs WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
