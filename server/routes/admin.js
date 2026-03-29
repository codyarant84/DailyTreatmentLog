import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/schools
// Returns all schools with their users and pending invites.
router.get('/schools', async (req, res) => {
  try {
    const [schoolsResult, profilesResult, invitesResult, usersResult] = await Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('profiles').select('id, school_id, is_admin'),
      supabase.from('invites').select('id, email, school_id, created_at').eq('used', false),
      supabase.auth.admin.listUsers(),
    ]);

    if (schoolsResult.error) throw schoolsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (invitesResult.error) throw invitesResult.error;

    const emailMap = Object.fromEntries(
      (usersResult.data?.users ?? []).map((u) => [u.id, { email: u.email, created_at: u.created_at }])
    );

    const schools = schoolsResult.data.map((school) => {
      const users = profilesResult.data
        .filter((p) => p.school_id === school.id)
        .map((p) => ({
          id: p.id,
          email: emailMap[p.id]?.email ?? '(unknown)',
          created_at: emailMap[p.id]?.created_at ?? null,
          is_admin: p.is_admin,
        }));

      const pending_invites = invitesResult.data.filter((inv) => inv.school_id === school.id);

      return { ...school, users, pending_invites };
    });

    res.json(schools);
  } catch (err) {
    console.error('GET /admin/schools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/schools/:id
router.delete('/schools/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete dependent data in order before removing the school
    for (const table of ['daily_treatments', 'treatments', 'athletes', 'exercises', 'invites', 'profiles']) {
      const { error } = await supabase.from(table).delete().eq('school_id', id);
      if (error) throw error;
    }
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/schools/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
// Removes the user's profile and deletes their Supabase auth account.
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error: profileErr } = await supabase.from('profiles').delete().eq('id', id);
    if (profileErr) throw profileErr;

    const { error: authErr } = await supabase.auth.admin.deleteUser(id);
    if (authErr) throw authErr;

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/invite
// Creates an invite record and returns a shareable link (no email sending required).
router.post('/invite', async (req, res) => {
  const { school_id, redirect_origin } = req.body;
  if (!school_id || !redirect_origin) {
    return res.status(400).json({ error: 'school_id and redirect_origin are required' });
  }

  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .insert([{ email: null, school_id }])
      .select('token')
      .single();

    if (inviteErr) throw inviteErr;

    const invite_url = `${redirect_origin}/invite/${invite.token}`;
    res.status(201).json({ invite_url });
  } catch (err) {
    console.error('POST /admin/invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/invites/:id — cancel a pending invite
router.delete('/invites/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('invites').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/invites/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
