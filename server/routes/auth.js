import express from 'express';
import crypto from 'crypto';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireJwt } from '../middleware/requireJwt.js';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// OLD: Supabase client (kept for reference)
// import { supabase } from '../lib/supabase.js';

const router = express.Router();

// ── Helper ─────────────────────────────────────────────────────────
// Builds the standard auth response shape returned by login, register, and me.
function buildAuthResponse(profile) {
  const token = signToken({
    userId:   profile.id,
    schoolId: profile.school_id,
    role:     profile.role     ?? 'trainer',
    isAdmin:  profile.is_admin ?? false,
  });

  return {
    token,
    user_id:       profile.id,
    email:         profile.email         ?? null,
    school_id:     profile.school_id,
    role:          profile.role          ?? 'trainer',
    is_admin:      profile.is_admin      ?? false,
    primary_color: profile.primary_color ?? null,
    logo_url:      profile.logo_url      ?? null,
    cost_per_visit: profile.cost_per_visit ?? 50,
  };
}

// ── POST /api/auth/login ───────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    // Verify credentials via Supabase Auth (temporary — while on Supabase)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch profile + school for our custom JWT
    const { rows } = await query(
      `SELECT p.id, p.email, p.school_id, p.role, p.is_admin,
              s.primary_color, s.logo_url, s.cost_per_visit
       FROM   profiles p
       JOIN   schools  s ON s.id = p.school_id
       WHERE  p.id = $1`,
      [authData.user.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: 'No profile found for this user' });
    }

    res.json(buildAuthResponse(rows[0]));
  } catch (err) {
    console.error('POST /auth/login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/register (internal/admin use only) ─────────────
router.post('/register', async (req, res) => {
  const { email, password, school_id, role } = req.body;
  if (!email || !password || !school_id) {
    return res.status(400).json({ error: 'email, password, and school_id are required' });
  }

  try {
    const password_hash = await hashPassword(password);

    const { rows: profileRows } = await query(
      `INSERT INTO profiles (email, password_hash, school_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, school_id, role, is_admin`,
      [email.trim().toLowerCase(), password_hash, school_id, role ?? 'trainer']
    );

    const profile = profileRows[0];

    const { rows: schoolRows } = await query(
      'SELECT primary_color, logo_url, cost_per_visit FROM schools WHERE id = $1',
      [school_id]
    );

    res.status(201).json(buildAuthResponse({ ...profile, ...schoolRows[0] }));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('POST /auth/register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────
// OLD Supabase implementation:
// router.get('/me', requireJwt, async (req, res) => {
//   const [profileResult, userResult] = await Promise.all([
//     supabase.from('profiles').select('school_id, is_admin, role').eq('id', req.userId).single(),
//     supabase.auth.admin.getUserById(req.userId),
//   ]);
//   const { data: school } = await supabase.from('schools').select('primary_color, logo_url, cost_per_visit').eq('id', profileResult.data.school_id).single();
//   res.json({ user_id: req.userId, email: userResult.data.user?.email ?? null, ... });
// });

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.email, p.school_id, p.role, p.is_admin,
              s.primary_color, s.logo_url, s.cost_per_visit
       FROM   profiles p
       JOIN   schools  s ON s.id = p.school_id
       WHERE  p.id = $1`,
      [req.userId]
    );

    if (!rows[0]) {
      return res.status(403).json({ error: 'User profile not found' });
    }

    // Return without a new token — client keeps the one it already has
    const p = rows[0];
    res.json({
      user_id:       p.id,
      email:         p.email         ?? null,
      school_id:     p.school_id,
      role:          p.role          ?? 'trainer',
      is_admin:      p.is_admin      ?? false,
      primary_color: p.primary_color ?? null,
      logo_url:      p.logo_url      ?? null,
      cost_per_visit: p.cost_per_visit ?? 50,
    });
  } catch (err) {
    console.error('GET /auth/me error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const { rows } = await query(
      'SELECT id FROM profiles WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    // Always return the same message — don't reveal whether the email exists
    if (rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [rows[0].id, token, expiresAt]
    );

    const resetUrl = `https://fieldsidehealth.com/reset-password?token=${token}`;

    if (resend) {
      await resend.emails.send({
        from: 'Fieldside Health <noreply@fieldsidehealth.com>',
        to: email.trim().toLowerCase(),
        subject: 'Reset your Fieldside Health password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin-bottom: 8px;">Reset your password</h2>
            <p style="color: #555; margin-bottom: 24px;">
              Click the button below to set a new password for your Fieldside Health account.
              This link expires in <strong>1 hour</strong>.
            </p>
            <a href="${resetUrl}"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none;
                      padding: 12px 24px; border-radius: 6px; font-weight: 600;">
              Reset Password
            </a>
            <p style="color: #888; font-size: 13px; margin-top: 24px;">
              If you didn't request this, you can safely ignore this email.
              Your password won't change until you click the link above.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #aaa; font-size: 12px;">
              Or copy this link into your browser:<br />
              <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
            </p>
          </div>
        `,
      });
    } else {
      console.warn('RESEND_API_KEY not set — reset token (dev only):', token);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }

  try {
    const { rows } = await query(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (new Date() > new Date(rows[0].expires_at)) {
      await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const password_hash = await hashPassword(newPassword);

    await query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [password_hash, rows[0].user_id]);
    await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('POST /auth/reset-password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/invite-info/:token ──────────────────────────────
// INTENTIONAL: invite-info, accept-invite-signup, setup-profile, and accept-invite
// still use Supabase because the `invites` table has not yet been migrated to RDS.
// Once the invites table is moved to RDS, replace these with pg queries and
// remove this import and server/lib/supabase.js entirely.
import { supabase } from '../lib/supabase.js';

router.get('/invite-info/:token', async (req, res) => {
  try {
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, used, schools(name)')
      .eq('token', req.params.token)
      .single();

    if (error || !invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used)       return res.status(409).json({ error: 'This invite link has already been used' });

    res.json({ school_name: invite.schools.name });
  } catch (err) {
    console.error('GET /auth/invite-info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/accept-invite-signup ───────────────────────────
// OLD: called supabase.auth.admin.createUser() then inserted profile via Supabase client
// NEW: insert directly into profiles with hashed password via pg
// OLD code (kept for reference):
// const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
//   email: email.trim().toLowerCase(),
//   password,
//   email_confirm: true,
// });
// supabase.from('profiles').insert([{ id: user.id, school_id: invite.school_id, role: invite.role ?? 'trainer' }])

router.post('/accept-invite-signup', async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    return res.status(400).json({ error: 'token, email, and password are required' });
  }

  try {
    // Invite lookup still uses Supabase DB until invites table is on RDS
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .select('id, school_id, used, role')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used)          return res.status(409).json({ error: 'This invite link has already been used' });

    const password_hash = await hashPassword(password);

    // Insert profile directly into RDS with email + password_hash
    await query(
      `INSERT INTO profiles (email, password_hash, school_id, role)
       VALUES ($1, $2, $3, $4)`,
      [email.trim().toLowerCase(), password_hash, invite.school_id, invite.role ?? 'trainer']
    );

    // Mark invite used
    await supabase.from('invites').update({ used: true }).eq('id', invite.id);

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('POST /auth/accept-invite-signup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/setup-profile ──────────────────────────────────
// Unchanged — still uses Supabase DB until schools/profiles fully on RDS
router.post('/setup-profile', requireJwt, async (req, res) => {
  const { school_name } = req.body;
  if (!school_name?.trim()) {
    return res.status(400).json({ error: 'school_name is required' });
  }

  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', req.userId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

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

// ── POST /api/auth/accept-invite ──────────────────────────────────
// Unchanged — still uses Supabase DB
router.post('/accept-invite', requireJwt, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .select('id, school_id, used')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used)          return res.status(409).json({ error: 'Invite has already been used' });

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', req.userId)
      .single();

    if (existing) return res.status(409).json({ error: 'Profile already exists' });

    const [profileResult, usedResult] = await Promise.all([
      supabase.from('profiles').insert([{ id: req.userId, school_id: invite.school_id }]),
      supabase.from('invites').update({ used: true }).eq('id', invite.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (usedResult.error)    throw usedResult.error;

    res.status(201).json({ school_id: invite.school_id });
  } catch (err) {
    console.error('POST /auth/accept-invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
