import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePortalAuth } from '../middleware/requirePortalAuth.js';

const router = express.Router();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// ── Helpers ────────────────────────────────────────────────────────────

function signPortalToken(payload) {
  return jwt.sign(
    { sub: 'portal', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function sanitizeUser(u) {
  return {
    id:          u.id,
    email:       u.email,
    name:        u.name,
    role:        u.role,
    approved:    u.approved,
    avatar_url:  u.avatar_url ?? null,
    school_id:   u.school_id ?? null,
    athlete_id:  u.athlete_id ?? null,
    school_name: u.school_name ?? null,
  };
}

// ── Portal Auth ────────────────────────────────────────────────────────

// POST /api/portal/auth/google
// Accepts a Google Identity Services credential token, verifies it, finds or
// creates the portal_user. Athletes whose email domain matches a school's
// student_email_domain are auto-associated with that school.
router.post('/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'credential is required' });

  try {
    const gsiRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    const gsiData = await gsiRes.json();

    if (!gsiRes.ok || gsiData.error_description) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    // Verify the token was issued for this app
    if (gsiData.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google token audience mismatch' });
    }

    const { email, name, sub: googleId, picture } = gsiData;
    if (!email) return res.status(401).json({ error: 'Google did not return an email address' });

    const normalEmail = email.trim().toLowerCase();
    const domain = normalEmail.split('@')[1];

    // Check if email domain matches any school
    const { rows: schoolRows } = await query(
      'SELECT id, name FROM schools WHERE student_email_domain = $1',
      [domain]
    );
    const matchedSchool = schoolRows[0] ?? null;

    // Find existing portal_user by email or google_id
    const { rows: existing } = await query(
      'SELECT * FROM portal_users WHERE email = $1 OR google_id = $2',
      [normalEmail, googleId]
    );

    let portalUser;

    if (existing[0]) {
      const { rows: updated } = await query(
        `UPDATE portal_users
         SET google_id = $1, avatar_url = COALESCE($2, avatar_url)
         WHERE id = $3 RETURNING *`,
        [googleId, picture ?? null, existing[0].id]
      );
      portalUser = updated[0];
    } else {
      const { rows: created } = await query(
        `INSERT INTO portal_users (school_id, email, name, role, google_id, avatar_url, approved)
         VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING *`,
        [
          matchedSchool?.id ?? null,
          normalEmail,
          name ?? normalEmail,
          matchedSchool ? 'athlete' : 'parent',
          googleId,
          picture ?? null,
        ]
      );
      portalUser = created[0];
    }

    // Fetch school name for response
    let schoolName = null;
    if (portalUser.school_id) {
      const { rows: sRows } = await query('SELECT name FROM schools WHERE id = $1', [portalUser.school_id]);
      schoolName = sRows[0]?.name ?? null;
    }

    const token = signPortalToken({
      portalUserId: portalUser.id,
      role:         portalUser.role,
      schoolId:     portalUser.school_id,
      athleteId:    portalUser.athlete_id,
      approved:     portalUser.approved,
    });

    res.json({ token, portalUser: sanitizeUser({ ...portalUser, school_name: schoolName }) });
  } catch (err) {
    console.error('POST /portal/auth/google error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/auth/login — email/password for parents
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const { rows } = await query(
      `SELECT pu.*, s.name AS school_name
       FROM portal_users pu
       LEFT JOIN schools s ON s.id = pu.school_id
       WHERE pu.email = $1`,
      [email.trim().toLowerCase()]
    );

    const u = rows[0];
    if (!u || !u.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signPortalToken({
      portalUserId: u.id,
      role:         u.role,
      schoolId:     u.school_id,
      athleteId:    u.athlete_id,
      approved:     u.approved,
    });

    res.json({ token, portalUser: sanitizeUser(u) });
  } catch (err) {
    console.error('POST /portal/auth/login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/auth/register — invite-based signup
router.post('/auth/register', async (req, res) => {
  const { token, email, password, name } = req.body;
  if (!token || !email || !password || !name) {
    return res.status(400).json({ error: 'token, email, password, and name are required' });
  }

  try {
    const { rows: inviteRows } = await query(
      `SELECT * FROM portal_invites
       WHERE token = $1 AND used = false AND expires_at > now()`,
      [token]
    );

    if (!inviteRows[0]) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    const invite = inviteRows[0];

    const password_hash = await hashPassword(password);

    const { rows } = await query(
      `INSERT INTO portal_users (school_id, athlete_id, email, name, role, password_hash, approved)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [invite.school_id, invite.athlete_id ?? null, email.trim().toLowerCase(), name, invite.role, password_hash]
    );

    await query('UPDATE portal_invites SET used = true WHERE id = $1', [invite.id]);

    const u = rows[0];
    const { rows: sRows } = await query('SELECT name FROM schools WHERE id = $1', [u.school_id]);

    const jwtToken = signPortalToken({
      portalUserId: u.id,
      role:         u.role,
      schoolId:     u.school_id,
      athleteId:    u.athlete_id,
      approved:     u.approved,
    });

    res.status(201).json({ token: jwtToken, portalUser: sanitizeUser({ ...u, school_name: sRows[0]?.name ?? null }) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('POST /portal/auth/register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/auth/me
router.get('/auth/me', requirePortalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pu.*, s.name AS school_name
       FROM portal_users pu
       LEFT JOIN schools s ON s.id = pu.school_id
       WHERE pu.id = $1`,
      [req.portalUser.portalUserId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Portal user not found' });
    res.json(sanitizeUser(rows[0]));
  } catch (err) {
    console.error('GET /portal/auth/me error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AT Management (requireAuth = existing AT middleware) ───────────────

// GET /api/portal/pending — unapproved portal users for this school
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pu.id, pu.email, pu.name, pu.role, pu.approved, pu.avatar_url, pu.created_at,
              a.name AS linked_athlete_name
       FROM portal_users pu
       LEFT JOIN athletes a ON a.id = pu.athlete_id
       WHERE pu.school_id = $1 AND pu.approved = false
       ORDER BY pu.created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/pending error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/approve/:id — approve and optionally link to athlete
router.post('/approve/:id', requireAuth, async (req, res) => {
  const { athlete_id } = req.body;
  try {
    const params = athlete_id
      ? [req.params.id, req.schoolId, athlete_id]
      : [req.params.id, req.schoolId];

    const sql = athlete_id
      ? `UPDATE portal_users SET approved = true, athlete_id = $3 WHERE id = $1 AND school_id = $2 RETURNING *`
      : `UPDATE portal_users SET approved = true WHERE id = $1 AND school_id = $2 RETURNING *`;

    const { rows } = await query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Portal user not found' });
    res.json(sanitizeUser(rows[0]));
  } catch (err) {
    console.error('POST /portal/approve/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/invite — send invite email to parent/athlete
router.post('/invite', requireAuth, async (req, res) => {
  const { email, role, athlete_id } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'email and role are required' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO portal_invites (school_id, email, role, athlete_id, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.schoolId, email.trim().toLowerCase(), role, athlete_id ?? null, token, expiresAt]
    );

    const inviteUrl = `https://fieldsidehealth.com/portal/invite?token=${token}`;

    if (resend) {
      await resend.emails.send({
        from: 'Fieldside Health <noreply@fieldsidehealth.com>',
        to: email.trim().toLowerCase(),
        subject: "You've been invited to the Fieldside Health portal",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="margin-bottom:8px;">You're invited to Fieldside Health</h2>
            <p style="color:#555;margin-bottom:24px;">
              Your athletic trainer has invited you to access the Fieldside Health
              athlete portal — a secure place to view injury updates and health status.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:#1d6fa5;color:#fff;text-decoration:none;
                      padding:12px 24px;border-radius:6px;font-weight:600;">
              Accept Invitation
            </a>
            <p style="color:#888;font-size:13px;margin-top:24px;">
              This link expires in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
          </div>
        `,
      });
    }

    res.json({ ok: true, inviteUrl });
  } catch (err) {
    console.error('POST /portal/invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/users — all portal users for the school
router.get('/users', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pu.id, pu.email, pu.name, pu.role, pu.approved, pu.avatar_url, pu.created_at,
              a.name AS linked_athlete_name
       FROM portal_users pu
       LEFT JOIN athletes a ON a.id = pu.athlete_id
       WHERE pu.school_id = $1
       ORDER BY pu.created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
