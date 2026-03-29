import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
const TABLE = 'treatments';

router.use(requireAuth);

// GET /api/treatments - fetch all treatments for the user's school, newest first
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('school_id', req.schoolId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/treatments/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Treatment not found' });
    res.json(data);
  } catch (err) {
    console.error('GET /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/treatments
router.post('/', async (req, res) => {
  try {
    const { athlete_name, date, treatment_type, body_part, notes, duration_minutes } = req.body;

    if (!athlete_name || !date || !treatment_type || !body_part) {
      return res.status(400).json({
        error: 'athlete_name, date, treatment_type, and body_part are required.',
      });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert([{ athlete_name, date, treatment_type, body_part, notes, duration_minutes, school_id: req.schoolId }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/treatments/:id
router.put('/:id', async (req, res) => {
  try {
    const { athlete_name, date, treatment_type, body_part, notes, duration_minutes } = req.body;

    const { data, error } = await supabase
      .from(TABLE)
      .update({ athlete_name, date, treatment_type, body_part, notes, duration_minutes })
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Treatment not found' });
    res.json(data);
  } catch (err) {
    console.error('PUT /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/treatments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
