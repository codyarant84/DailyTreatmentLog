import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/exercises — global library, all schools, alphabetical
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, description, video_url, body_parts')
      .order('name');

    if (error) throw error;
    res.json(data);
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
    const { data, error } = await supabase
      .from('exercises')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        video_url: video_url?.trim() || null,
        body_parts: body_parts?.trim() || null,
      }])
      .select('id, name, description, video_url, body_parts')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Exercise already exists' });
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exercises/:id
router.put('/:id', async (req, res) => {
  const { name, description, video_url, body_parts } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { data, error } = await supabase
      .from('exercises')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        video_url: video_url?.trim() || null,
        body_parts: body_parts?.trim() || null,
      })
      .eq('id', req.params.id)
      .select('id, name, description, video_url, body_parts')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Exercise not found' });
    res.json(data);
  } catch (err) {
    console.error('PUT /exercises/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /exercises/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
