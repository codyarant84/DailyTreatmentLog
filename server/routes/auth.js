import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireJwt } from '../middleware/requireJwt.js';

const router = express.Router();

// POST /api/auth/setup-profile
// Called once after initial signup. Finds or creates the school and links it to the user.
router.post('/setup-profile', requireJwt, async (req, res) => {
  const { school_name } = req.body;
  if (!school_name?.trim()) {
    return res.status(400).json({ error: 'school_name is required' });
  }

  try {
    // Check if profile already exists (prevent duplicate setup)
    const { data: existing } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', req.userId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    // Find or create the school (case-insensitive match)
    let school;
    const { data: found } = await supabase
      .from('schools')
      .select('id, name')
      .ilike('name', school_name.trim())
      .single();

    if (found) {
      school = found;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('schools')
        .insert([{ name: school_name.trim() }])
        .select()
        .single();
      if (createErr) throw createErr;
      school = created;
    }

    // Create the profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .insert([{ id: req.userId, school_id: school.id }]);

    if (profileErr) throw profileErr;

    res.status(201).json({ school_id: school.id, school_name: school.name });
  } catch (err) {
    console.error('setup-profile error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
// Returns the current user's email and school_id — used by the dashboard for the realtime filter.
router.get('/me', requireJwt, async (req, res) => {
  try {
    const [profileResult, userResult] = await Promise.all([
      supabase.from('profiles').select('school_id').eq('id', req.userId).single(),
      supabase.auth.admin.getUserById(req.userId),
    ]);

    if (profileResult.error) throw profileResult.error;

    res.json({
      user_id: req.userId,
      email: userResult.data.user?.email ?? null,
      school_id: profileResult.data.school_id,
    });
  } catch (err) {
    console.error('GET /auth/me error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
