import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/exercises — all exercises for this school, alphabetical
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('school_id', req.schoolId)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exercises — add a new exercise to the library
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('exercises')
      .insert([{ school_id: req.schoolId, name: name.trim() }])
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Exercise already exists' });
      }
      throw error;
    }

      res.status(201).json(data);
  } catch (err) {
    console.error('POST /exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
