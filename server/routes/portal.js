import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { uploadFile } from '../lib/storage.js';
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

// ── Form Management (requireAuth = AT) ─────────────────────────────

// GET /api/portal/forms
router.get('/forms', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pf.*,
              COUNT(DISTINCT pff.id)::int AS field_count,
              COUNT(DISTINCT pfa.id)::int AS assignment_count
       FROM portal_forms pf
       LEFT JOIN portal_form_fields      pff ON pff.form_id = pf.id
       LEFT JOIN portal_form_assignments pfa ON pfa.form_id = pf.id
       WHERE pf.school_id = $1
       GROUP BY pf.id
       ORDER BY pf.created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/forms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/forms
router.post('/forms', requireAuth, async (req, res) => {
  const { title, description, requires_signature = true, requires_parent = false, requires_athlete = false } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await query(
      `INSERT INTO portal_forms (school_id, title, description, requires_signature, requires_parent, requires_athlete, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.schoolId, title.trim(), description ?? null, requires_signature, requires_parent, requires_athlete, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /portal/forms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/forms/:id
router.get('/forms/:id', requireAuth, async (req, res) => {
  try {
    const { rows: formRows } = await query(
      `SELECT * FROM portal_forms WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!formRows[0]) return res.status(404).json({ error: 'Form not found' });
    const { rows: fields } = await query(
      `SELECT * FROM portal_form_fields WHERE form_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [req.params.id]
    );
    res.json({ ...formRows[0], fields });
  } catch (err) {
    console.error('GET /portal/forms/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/portal/forms/:id
router.put('/forms/:id', requireAuth, async (req, res) => {
  const { title, description, requires_signature, requires_parent, requires_athlete } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const { rows } = await query(
      `UPDATE portal_forms
       SET title = $1, description = $2,
           requires_signature = $3, requires_parent = $4, requires_athlete = $5,
           updated_at = now()
       WHERE id = $6 AND school_id = $7 RETURNING *`,
      [title.trim(), description ?? null, requires_signature ?? true, requires_parent ?? false, requires_athlete ?? false, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Form not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /portal/forms/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portal/forms/:id
router.delete('/forms/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM portal_forms WHERE id = $1 AND school_id = $2 RETURNING id`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Form not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /portal/forms/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/forms/:id/fields
router.post('/forms/:id/fields', requireAuth, async (req, res) => {
  const { field_type, label, placeholder, options, required = false, sort_order = 0 } = req.body;
  const validTypes = ['text', 'textarea', 'checkbox', 'date', 'select', 'heading', 'paragraph'];
  if (!validTypes.includes(field_type)) return res.status(400).json({ error: 'Invalid field_type' });
  if (!label?.trim()) return res.status(400).json({ error: 'label is required' });
  try {
    const { rows: fc } = await query('SELECT id FROM portal_forms WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
    if (!fc[0]) return res.status(404).json({ error: 'Form not found' });
    const { rows } = await query(
      `INSERT INTO portal_form_fields (form_id, field_type, label, placeholder, options, required, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, field_type, label.trim(), placeholder ?? null, options ? JSON.stringify(options) : null, required, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /portal/forms/:id/fields error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/portal/forms/:id/fields/reorder  — must be before /:fieldId
router.put('/forms/:id/fields/reorder', requireAuth, async (req, res) => {
  const { order } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  try {
    await Promise.all(
      order.map(({ id, sort_order }) =>
        query('UPDATE portal_form_fields SET sort_order = $1 WHERE id = $2 AND form_id = $3', [sort_order, id, req.params.id])
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /portal/forms/:id/fields/reorder error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/portal/forms/:id/fields/:fieldId
router.put('/forms/:id/fields/:fieldId', requireAuth, async (req, res) => {
  const { label, placeholder, options, required, sort_order } = req.body;
  try {
    const { rows } = await query(
      `UPDATE portal_form_fields
       SET label = $1, placeholder = $2, options = $3, required = $4, sort_order = $5
       WHERE id = $6 AND form_id = $7 RETURNING *`,
      [label, placeholder ?? null, options ? JSON.stringify(options) : null, required ?? false, sort_order ?? 0, req.params.fieldId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Field not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /portal/forms/:id/fields/:fieldId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portal/forms/:id/fields/:fieldId
router.delete('/forms/:id/fields/:fieldId', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM portal_form_fields WHERE id = $1 AND form_id = $2 RETURNING id`,
      [req.params.fieldId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Field not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /portal/forms/:id/fields/:fieldId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/forms/:id/assign
router.post('/forms/:id/assign', requireAuth, async (req, res) => {
  const { athleteIds, assignedTo, dueDate } = req.body;
  if (!Array.isArray(athleteIds) || !athleteIds.length) return res.status(400).json({ error: 'athleteIds must be a non-empty array' });
  if (!['athlete', 'parent', 'both'].includes(assignedTo)) return res.status(400).json({ error: 'assignedTo must be athlete, parent, or both' });
  try {
    const { rows: fc } = await query('SELECT id FROM portal_forms WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
    if (!fc[0]) return res.status(404).json({ error: 'Form not found' });
    const created = await Promise.all(
      athleteIds.map((athleteId) =>
        query(
          `INSERT INTO portal_form_assignments (form_id, school_id, athlete_id, assigned_to, due_date)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [req.params.id, req.schoolId, athleteId, assignedTo, dueDate ?? null]
        ).then((r) => r.rows[0])
      )
    );
    res.status(201).json(created);
  } catch (err) {
    console.error('POST /portal/forms/:id/assign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/forms/:id/assignments
router.get('/forms/:id/assignments', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pfa.*,
              a.name AS athlete_name,
              (COUNT(pfs.id) > 0)    AS completed,
              MAX(pfs.submitted_at)  AS submitted_at
       FROM portal_form_assignments pfa
       LEFT JOIN athletes                a   ON a.id   = pfa.athlete_id
       LEFT JOIN portal_form_submissions pfs ON pfs.assignment_id = pfa.id
       WHERE pfa.form_id = $1 AND pfa.school_id = $2
       GROUP BY pfa.id, a.name
       ORDER BY pfa.created_at DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/forms/:id/assignments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/assignments
router.get('/assignments', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pfa.*,
              pf.title              AS form_title,
              a.name                AS athlete_name,
              (COUNT(pfs.id) > 0)   AS completed,
              MAX(pfs.submitted_at) AS submitted_at
       FROM portal_form_assignments pfa
       JOIN  portal_forms           pf  ON pf.id  = pfa.form_id
       LEFT JOIN athletes           a   ON a.id   = pfa.athlete_id
       LEFT JOIN portal_form_submissions pfs ON pfs.assignment_id = pfa.id
       WHERE pfa.school_id = $1
       GROUP BY pfa.id, pf.title, a.name
       ORDER BY pfa.created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/assignments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Portal User Form Routes ─────────────────────────────────────────

// GET /api/portal/my-forms
router.get('/my-forms', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId, role } = req.portalUser;
  if (!athleteId) return res.json([]);
  const roleFilter = role === 'athlete'
    ? `pfa.assigned_to IN ('athlete', 'both')`
    : `pfa.assigned_to IN ('parent', 'both')`;
  try {
    const { rows } = await query(
      `SELECT pfa.*,
              pf.title             AS form_title,
              pf.description       AS form_description,
              pf.requires_signature,
              a.name               AS athlete_name,
              EXISTS (
                SELECT 1 FROM portal_form_submissions pfs
                WHERE pfs.assignment_id = pfa.id
                  AND (pfs.portal_user_id = $1 OR pfs.submitted_by_role = $2)
              ) AS completed
       FROM portal_form_assignments pfa
       JOIN  portal_forms pf ON pf.id = pfa.form_id
       LEFT JOIN athletes  a  ON a.id = pfa.athlete_id
       WHERE pfa.athlete_id = $3 AND ${roleFilter}
       ORDER BY pfa.due_date ASC NULLS LAST, pfa.created_at DESC`,
      [portalUserId, role, athleteId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-forms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/my-forms/:assignmentId
router.get('/my-forms/:assignmentId', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId } = req.portalUser;
  try {
    const { rows: aRows } = await query(
      `SELECT pfa.*, pf.title AS form_title, pf.description AS form_description,
              pf.requires_signature, pf.id AS form_id
       FROM portal_form_assignments pfa
       JOIN portal_forms pf ON pf.id = pfa.form_id
       WHERE pfa.id = $1 AND pfa.athlete_id = $2`,
      [req.params.assignmentId, athleteId]
    );
    if (!aRows[0]) return res.status(404).json({ error: 'Assignment not found' });
    const { rows: fields } = await query(
      `SELECT * FROM portal_form_fields WHERE form_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [aRows[0].form_id]
    );
    const { rows: subs } = await query(
      `SELECT * FROM portal_form_submissions WHERE assignment_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [req.params.assignmentId]
    );
    res.json({ assignment: aRows[0], fields, submission: subs[0] ?? null });
  } catch (err) {
    console.error('GET /portal/my-forms/:assignmentId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/my-forms/:assignmentId/submit
router.post('/my-forms/:assignmentId/submit', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId, role } = req.portalUser;
  const { responses, signature_data } = req.body;
  try {
    const { rows: aRows } = await query(
      `SELECT id FROM portal_form_assignments WHERE id = $1 AND athlete_id = $2`,
      [req.params.assignmentId, athleteId]
    );
    if (!aRows[0]) return res.status(404).json({ error: 'Assignment not found' });
    const { rows } = await query(
      `INSERT INTO portal_form_submissions (assignment_id, portal_user_id, submitted_by_role, responses, signature_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.assignmentId, portalUserId, role, JSON.stringify(responses ?? {}), signature_data ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /portal/my-forms/:assignmentId/submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/my-forms/:assignmentId/upload-pdf
router.post('/my-forms/:assignmentId/upload-pdf', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId, role } = req.portalUser;
  const { base64, mime_type } = req.body;
  if (!base64 || mime_type !== 'application/pdf') {
    return res.status(400).json({ error: 'base64 PDF is required' });
  }
  try {
    const { rows: aRows } = await query(
      `SELECT id, school_id FROM portal_form_assignments WHERE id = $1 AND athlete_id = $2`,
      [req.params.assignmentId, athleteId]
    );
    if (!aRows[0]) return res.status(404).json({ error: 'Assignment not found' });
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const pdfUrl = await uploadFile(buffer, `portal-forms/${aRows[0].school_id}/${req.params.assignmentId}.pdf`, 'application/pdf');
    const { rows } = await query(
      `INSERT INTO portal_form_submissions (assignment_id, portal_user_id, submitted_by_role, responses, pdf_upload_url)
       VALUES ($1, $2, $3, '{}', $4) RETURNING *`,
      [req.params.assignmentId, portalUserId, role, pdfUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /portal/my-forms/:assignmentId/upload-pdf error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
