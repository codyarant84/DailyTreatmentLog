import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireJwt } from '../middleware/requireJwt.js';

const router = express.Router();

// GET /api/auth/invite-info/:token
// Public endpoint — returns the school name for a valid unused invite token.
router.get('/invite-info/:token', async (req, res) => {
  try {
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, used, schools(name)')
      .eq('token', req.params.token)
      .single();

    if (error || !invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used) return res.status(409).json({ error: 'This invite link has already been used' });

    res.json({ school_name: invite.schools.name });
  } catch (err) {
    console.error('GET /auth/invite-info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/accept-invite-signup
// Creates a confirmed Supabase account and profile in one step for an invited user.
// No email confirmation required — the invite link is the proof of authorization.
router.post('/accept-invite-signup', async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    return res.status(400).json({ error: 'token, email, and password are required' });
  }

  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .select('id, school_id, used')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used) return res.status(409).json({ error: 'This invite link has already been used' });

    // Create a pre-confirmed Supabase user (bypasses email confirmation)
    const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createErr) throw createErr;

    // Create profile and mark invite used
    const [profileResult, usedResult] = await Promise.all([
      supabase.from('profiles').insert([{ id: user.id, school_id: invite.school_id }]),
      supabase.from('invites').update({ used: true }).eq('id', invite.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (usedResult.error) throw usedResult.error;

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('POST /auth/accept-invite-signup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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

    const { data: school } = await supabase
      .from('schools')
      .select('primary_color, logo_url, cost_per_visit')
      .eq('id', profileResult.data.school_id)
      .single();

    res.json({
      user_id: req.userId,
      email: userResult.data.user?.email ?? null,
      school_id: profileResult.data.school_id,
      is_admin: profileResult.data.is_admin ?? false,
      primary_color: school?.primary_color ?? null,
      logo_url: school?.logo_url ?? null,
      cost_per_visit: school?.cost_per_visit ?? 50,
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
