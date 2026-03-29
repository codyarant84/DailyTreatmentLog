import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
const TABLE = 'daily_treatments';

router.use(requireAuth);

// GET /api/daily-treatments/athletes
router.get('/athletes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('athlete_name')
      .eq('school_id', req.schoolId)
      .order('athlete_name');

    if (error) throw error;

    const names = [...new Set(data.map((r) => r.athlete_name))].sort((a, b) =>
      a.localeCompare(b)
    );
    res.json(names);
  } catch (err) {
    console.error('GET /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-treatments
// Supported query params:
//   date=YYYY-MM-DD      → single day (dashboard); sorts created_at ASC
//   athlete_name=string  → profile page; sorts date DESC, created_at DESC
//   from=YYYY-MM-DD      → date range start (inclusive)
//   to=YYYY-MM-DD        → date range end (inclusive)
//   treatment_type=string → exact match
router.get('/', async (req, res) => {
  try {
    const { date, athlete_name, from, to, treatment_type } = req.query;

    let query = supabase.from(TABLE).select('*').eq('school_id', req.schoolId);

    if (date)           query = query.eq('date', date);
    if (athlete_name)   query = query.eq('athlete_name', decodeURIComponent(athlete_name));
    if (from)           query = query.gte('date', from);
    if (to)             query = query.lte('date', to);
    if (treatment_type) query = query.eq('treatment_type', decodeURIComponent(treatment_type));

    // Dashboard (single day) → chronological ASC; everything else → newest first
    const ascending = Boolean(date) && !athlete_name;
    query = query
      .order('date', { ascending })
      .order('created_at', { ascending });

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /daily-treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-treatments
router.post('/', async (req, res) => {
  try {
    const { athlete_name, date, treatment_type, body_part, duration_minutes, notes } = req.body;

    if (!athlete_name || !date || !treatment_type || !body_part) {
      return res.status(400).json({
        error: 'athlete_name, date, treatment_type, and body_part are required.',
      });
    }

    const { data: { user } } = await supabase.auth.admin.getUserById(req.userId);
    const logged_by_email = user?.email ?? null;

    const { data, error } = await supabase
      .from(TABLE)
      .insert([{
        athlete_name: athlete_name.trim(),
        date,
        treatment_type,
        body_part,
        duration_minutes: duration_minutes || null,
        notes: notes || null,
        school_id: req.schoolId,
        logged_by_email,
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('POST /daily-treatments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/daily-treatments/:id
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
    console.error('DELETE /daily-treatments/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
