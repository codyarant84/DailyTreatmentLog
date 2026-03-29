import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/rehab-programs — list all programs with exercise count
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rehab_programs')
      .select('id, name, description, athlete_name, created_at, program_exercises(id)')
      .eq('school_id', req.schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const programs = data.map(({ program_exercises, ...p }) => ({
      ...p,
      exercise_count: program_exercises.length,
    }));

    res.json(programs);
  } catch (err) {
    console.error('GET /rehab-programs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rehab-programs/:id — full program with ordered exercises
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rehab_programs')
      .select(`
        id, name, description, athlete_name, created_at,
        program_exercises (
          id, sets, reps, duration_seconds, notes, sort_order,
          exercises ( id, name, video_url )
        )
      `)
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Program not found' });

    data.program_exercises.sort((a, b) => a.sort_order - b.sort_order);
    res.json(data);
  } catch (err) {
    console.error('GET /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rehab-programs — create program with exercises
router.post('/', async (req, res) => {
  const { name, description, athlete_name, exercises = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { data: program, error: progErr } = await supabase
      .from('rehab_programs')
      .insert([{
        school_id: req.schoolId,
        name: name.trim(),
        description: description?.trim() || null,
        athlete_name: athlete_name?.trim() || null,
      }])
      .select('id')
      .single();

    if (progErr) throw progErr;

    if (exercises.length > 0) {
      const rows = exercises.map((ex, i) => ({
        program_id: program.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets || null,
        reps: ex.reps || null,
        duration_seconds: ex.duration_seconds || null,
        notes: ex.notes?.trim() || null,
        sort_order: i,
      }));
      const { error: exErr } = await supabase.from('program_exercises').insert(rows);
      if (exErr) throw exErr;
    }

    res.status(201).json({ id: program.id });
  } catch (err) {
    console.error('POST /rehab-programs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rehab-programs/:id — update program; replaces full exercise list
router.put('/:id', async (req, res) => {
  const { name, description, athlete_name, exercises = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { error: progErr } = await supabase
      .from('rehab_programs')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        athlete_name: athlete_name?.trim() || null,
      })
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId);

    if (progErr) throw progErr;

    // Replace exercise list
    await supabase.from('program_exercises').delete().eq('program_id', req.params.id);

    if (exercises.length > 0) {
      const rows = exercises.map((ex, i) => ({
        program_id: req.params.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets || null,
        reps: ex.reps || null,
        duration_seconds: ex.duration_seconds || null,
        notes: ex.notes?.trim() || null,
        sort_order: i,
      }));
      const { error: exErr } = await supabase.from('program_exercises').insert(rows);
      if (exErr) throw exErr;
    }

    res.json({ id: req.params.id });
  } catch (err) {
    console.error('PUT /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rehab-programs/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('rehab_programs')
      .delete()
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /rehab-programs/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
