import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

function flattenAthlete({ athletes: ath, ...inj }) {
  return { ...inj, athlete_name: ath?.name ?? null, athlete_sport: ath?.sport ?? null };
}

// GET /api/injuries
// ?active=true          → only is_active injuries
// ?athlete_name=string  → injuries for a specific athlete (lookup by name)
router.get('/', async (req, res) => {
  try {
    const { active, athlete_name } = req.query;

    let query = supabase
      .from('injuries')
      .select('*, athletes(name, sport)')
      .eq('school_id', req.schoolId)
      .order('injury_date', { ascending: false });

    if (active === 'true') query = query.eq('is_active', true);

    if (athlete_name) {
      const { data: ath } = await supabase
        .from('athletes')
        .select('id')
        .eq('school_id', req.schoolId)
        .eq('name', decodeURIComponent(athlete_name))
        .single();

      if (!ath) return res.json([]);
      query = query.eq('athlete_id', ath.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data.map(flattenAthlete));
  } catch (err) {
    console.error('GET /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/injuries
router.post('/', async (req, res) => {
  try {
    const { athlete_id, injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes } = req.body;

    if (!athlete_id || !injury_date || !body_part || !injury_type) {
      return res.status(400).json({ error: 'athlete_id, injury_date, body_part, and injury_type are required.' });
    }

    // Verify athlete belongs to this school
    const { data: ath } = await supabase
      .from('athletes')
      .select('id')
      .eq('id', athlete_id)
      .eq('school_id', req.schoolId)
      .single();

    if (!ath) return res.status(400).json({ error: 'Athlete not found.' });

    const { data, error } = await supabase
      .from('injuries')
      .insert({
        athlete_id,
        school_id:   req.schoolId,
        logged_by:   req.userId,
        injury_date,
        body_part,
        injury_type,
        mechanism:   mechanism  || null,
        severity:    severity   || null,
        rtp_status:  rtp_status || 'Out',
        notes:       notes      || null,
        is_active:   true,
      })
      .select('*, athletes(name, sport)')
      .single();

    if (error) throw error;
    res.status(201).json(flattenAthlete(data));
  } catch (err) {
    console.error('POST /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/injuries/:id
router.put('/:id', async (req, res) => {
  try {
    const { injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes, is_active } = req.body;

    if (!injury_date || !body_part || !injury_type) {
      return res.status(400).json({ error: 'injury_date, body_part, and injury_type are required.' });
    }

    const { data, error } = await supabase
      .from('injuries')
      .update({
        injury_date,
        body_part,
        injury_type,
        mechanism:  mechanism  || null,
        severity:   severity   || null,
        rtp_status: rtp_status || 'Out',
        notes:      notes      || null,
        is_active:  is_active  ?? true,
      })
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId)
      .select('*, athletes(name, sport)')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Injury not found.' });

    res.json(flattenAthlete(data));
  } catch (err) {
    console.error('PUT /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/injuries/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('injuries')
      .delete()
      .eq('id', req.params.id)
      .eq('school_id', req.schoolId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
