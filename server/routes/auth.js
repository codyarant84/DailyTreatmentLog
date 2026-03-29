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
// Returns the current user's email, school_id, and admin status.
router.get('/me', requireJwt, async (req, res) => {
  try {
    const [profileResult, userResult] = await Promise.all([
      supabase.from('profiles').select('school_id, is_admin').eq('id', req.userId).single(),
      supabase.auth.admin.getUserById(req.userId),
    ]);

    if (profileResult.error) {
      // No profile row means setup is incomplete
      return res.status(403).json({ error: 'User profile not found' });
    }

    res.json({
      user_id: req.userId,
      email: userResult.data.user?.email ?? null,
      school_id: profileResult.data.school_id,
      is_admin: profileResult.data.is_admin ?? false,
    });
  } catch (err) {
    console.error('GET /auth/me error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/accept-invite
// Called when an invited user lands on /setup?invite=TOKEN after clicking their email link.
// Looks up the invite, creates their profile for the invited school, and marks the invite used.
router.post('/accept-invite', requireJwt, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .select('id, school_id, used')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    if (invite.used) {
      return res.status(409).json({ error: 'Invite has already been used' });
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', req.userId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    // Create profile and mark invite used atomically
    const [profileResult, usedResult] = await Promise.all([
      supabase.from('profiles').insert([{ id: req.userId, school_id: invite.school_id }]),
      supabase.from('invites').update({ used: true }).eq('id', invite.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (usedResult.error) throw usedResult.error;

    res.status(201).json({ school_id: invite.school_id });
  } catch (err) {
    console.error('POST /auth/accept-invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
