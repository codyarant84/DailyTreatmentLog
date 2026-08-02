import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { uploadFile } from '../lib/storage.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePortalAuth } from '../middleware/requirePortalAuth.js';
import { logActivity } from '../middleware/logActivity.js';

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
    id:                  u.id,
    email:               u.email,
    name:                u.name,
    role:                u.role,
    approved:            u.approved,
    onboarding_complete: u.onboarding_complete ?? false,
    avatar_url:          u.avatar_url ?? null,
    school_id:           u.school_id ?? null,
    athlete_id:          u.athlete_id ?? null,
    school_name:         u.school_name ?? null,
  };
}

// ── Portal Auth ────────────────────────────────────────────────────────

// POST /api/portal/auth/google
// Accepts a Google Identity Services credential token, verifies it, finds or
// creates the portal_user. Athletes whose email domain matches a school's
// student_email_domain are auto-associated with that school.
router.post('/auth/google', async (req, res) => {
  const { credential, invite_token } = req.body;
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
    console.log('[portal/auth/google] token aud:', gsiData.aud);
    console.log('[portal/auth/google] env GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    if (gsiData.aud !== process.env.GOOGLE_CLIENT_ID) {
      console.error('[portal/auth/google] audience mismatch — token aud:', gsiData.aud, '| env:', process.env.GOOGLE_CLIENT_ID);
      return res.status(401).json({ error: 'Google token audience mismatch' });
    }

    const { email, name, sub: googleId, picture } = gsiData;
    if (!email) return res.status(401).json({ error: 'Google did not return an email address' });

    const normalEmail = email.trim().toLowerCase();
    const domain = normalEmail.split('@')[1];

    // Resolve invite token if provided — takes precedence over domain matching
    let invite = null;
    if (invite_token) {
      const { rows: invRows } = await query(
        `SELECT * FROM portal_invites WHERE token = $1 AND used = false AND expires_at > now()`,
        [invite_token]
      );
      console.log('[portal/auth/google] invite_token lookup:', invite_token, '→ rows:', invRows.length, invRows[0] ?? 'not found');
      invite = invRows[0] ?? null;
    }

    // If caller already picked a school, use it directly
    const { school_id: chosenSchoolId } = req.body;

    let matchedSchool = null;
    if (invite) {
      // Use the school from the invite — bypass domain matching entirely
      const { rows: direct } = await query('SELECT id, name FROM schools WHERE id = $1', [invite.school_id]);
      matchedSchool = direct[0] ?? null;
    } else if (chosenSchoolId) {
      const { rows: direct } = await query(
        'SELECT id, name FROM schools WHERE id = $1',
        [chosenSchoolId]
      );
      matchedSchool = direct[0] ?? null;
    } else {
      const { rows: schoolRows } = await query(
        'SELECT id, name FROM schools WHERE student_email_domain = $1',
        [domain]
      );
      if (schoolRows.length > 1) {
        return res.json({ school_choice_required: true, schools: schoolRows });
      }
      matchedSchool = schoolRows[0] ?? null;
    }

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
      // Resolve athlete_id for new athlete-role users before inserting portal_user
      let newAthleteId = null;
      if (matchedSchool) {
        const athleteName = name ?? normalEmail;
        const { rows: existingAthletes } = await query(
          `SELECT id FROM athletes WHERE school_id = $1 AND name = $2 LIMIT 1`,
          [matchedSchool.id, athleteName]
        );
        if (existingAthletes[0]) {
          newAthleteId = existingAthletes[0].id;
        } else {
          const { rows: createdAthlete } = await query(
            `INSERT INTO athletes (school_id, name, archived)
             VALUES ($1, $2, false) RETURNING id`,
            [matchedSchool.id, athleteName]
          );
          newAthleteId = createdAthlete[0].id;
        }
      }

      const roleToAssign = invite?.role ?? (matchedSchool ? 'athlete' : 'parent');
      const approvedOnCreate = !!invite; // invite = pre-approved; domain match = needs AT approval

      const { rows: created } = await query(
        `INSERT INTO portal_users (school_id, athlete_id, email, name, role, google_id, avatar_url, approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          matchedSchool?.id ?? null,
          newAthleteId,
          normalEmail,
          name ?? normalEmail,
          roleToAssign,
          googleId,
          picture ?? null,
          approvedOnCreate,
        ]
      );
      portalUser = created[0];

      // Consume the invite now that the account is created
      if (invite) {
        await query('UPDATE portal_invites SET used = true WHERE id = $1', [invite.id]);
      }
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
    // Debug: check what the token resolves to before filtering
    const { rows: rawRows } = await query(
      `SELECT id, used, expires_at, expires_at > now() AS not_expired FROM portal_invites WHERE token = $1`,
      [token]
    );
    console.log('[portal/auth/register] token lookup:', {
      token: token?.slice(0, 16) + '…',
      found: rawRows.length,
      row: rawRows[0] ?? null,
    });

    const { rows: inviteRows } = await query(
      `SELECT * FROM portal_invites
       WHERE token = $1 AND used = false AND expires_at > now()`,
      [token]
    );

    if (!inviteRows[0]) {
      // Surface the specific reason so the debug log makes sense
      if (!rawRows[0])          return res.status(404).json({ error: 'Invite token not found' });
      if (rawRows[0].used)      return res.status(410).json({ error: 'Invite already used' });
      if (!rawRows[0].not_expired) return res.status(410).json({ error: 'Invite has expired' });
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    const invite = inviteRows[0];

    const password_hash = await hashPassword(password);

    // Auto-create or link athlete record for athlete-role invites
    let resolvedAthleteId = invite.athlete_id ?? null;
    if (invite.role === 'athlete' && !resolvedAthleteId) {
      const { rows: existingAthletes } = await query(
        `SELECT id FROM athletes WHERE school_id = $1 AND name = $2 LIMIT 1`,
        [invite.school_id, name]
      );
      if (existingAthletes[0]) {
        resolvedAthleteId = existingAthletes[0].id;
      } else {
        const { rows: createdAthlete } = await query(
          `INSERT INTO athletes (school_id, name, archived)
           VALUES ($1, $2, false) RETURNING id`,
          [invite.school_id, name]
        );
        resolvedAthleteId = createdAthlete[0].id;
      }
    }

    const { rows } = await query(
      `INSERT INTO portal_users (school_id, athlete_id, email, name, role, password_hash, approved)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [invite.school_id, resolvedAthleteId, email.trim().toLowerCase(), name, invite.role, password_hash]
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
              a.name                AS athlete_name,
              (pfs.id IS NOT NULL)  AS completed,
              pfs.responses         AS submission_responses,
              pfs.signature_data    AS submission_signature,
              pfs.pdf_upload_url    AS submission_pdf_url,
              pfs.submitted_by_role,
              pfs.submitted_at
       FROM portal_form_assignments pfa
       LEFT JOIN athletes a ON a.id = pfa.athlete_id
       LEFT JOIN LATERAL (
         SELECT id, responses, signature_data, pdf_upload_url, submitted_by_role, submitted_at
         FROM portal_form_submissions
         WHERE assignment_id = pfa.id
         ORDER BY submitted_at DESC
         LIMIT 1
       ) pfs ON true
       WHERE pfa.form_id = $1 AND pfa.school_id = $2
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
              (pfs.id IS NOT NULL)  AS completed,
              pfs.responses         AS submission_responses,
              pfs.signature_data    AS submission_signature,
              pfs.pdf_upload_url    AS submission_pdf_url,
              pfs.submitted_by_role,
              pfs.submitted_at
       FROM portal_form_assignments pfa
       JOIN  portal_forms pf ON pf.id = pfa.form_id
       LEFT JOIN athletes  a  ON a.id = pfa.athlete_id
       LEFT JOIN LATERAL (
         SELECT id, responses, signature_data, pdf_upload_url, submitted_by_role, submitted_at
         FROM portal_form_submissions
         WHERE assignment_id = pfa.id
         ORDER BY submitted_at DESC
         LIMIT 1
       ) pfs ON true
       WHERE pfa.school_id = $1
       ORDER BY pfa.created_at DESC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/assignments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Athlete Onboarding ──────────────────────────────────────────────

// GET /api/portal/onboarding-status
router.get('/onboarding-status', requirePortalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT onboarding_complete FROM portal_users WHERE id = $1',
      [req.portalUser.portalUserId]
    );
    res.json({ onboarding_complete: rows[0]?.onboarding_complete ?? false });
  } catch (err) {
    console.error('GET /portal/onboarding-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/onboarding
router.post('/onboarding', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId } = req.portalUser;
  const { personalInfo, sportInfo, emergencyContact, insurance } = req.body;

  if (!athleteId) return res.status(400).json({ error: 'No athlete linked to this account' });

  try {
    const fullName = `${(personalInfo.firstName ?? '').trim()} ${(personalInfo.lastName ?? '').trim()}`.trim();

    await query(
      `UPDATE athletes
       SET name = $1, date_of_birth = $2, grade = $3, sport = $4,
           jersey_number = $5, gender = $6
       WHERE id = $7`,
      [
        fullName || null,
        personalInfo.dob || null,
        personalInfo.grade || null,
        (sportInfo.sports ?? []).join(', ') || null,
        sportInfo.jerseyNumber || null,
        personalInfo.gender || null,
        athleteId,
      ]
    );

    if (emergencyContact?.name?.trim()) {
      await query(
        `INSERT INTO athlete_emergency_contacts (athlete_id, name, relationship, phone, email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (athlete_id) DO UPDATE
           SET name = $2, relationship = $3, phone = $4, email = $5, updated_at = now()`,
        [
          athleteId,
          emergencyContact.name.trim(),
          emergencyContact.relationship || null,
          emergencyContact.phone || null,
          emergencyContact.email || null,
        ]
      );
    }

    if (insurance?.provider?.trim()) {
      await query(
        `INSERT INTO athlete_insurance (athlete_id, provider, policy_number, group_number, subscriber_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (athlete_id) DO UPDATE
           SET provider = $2, policy_number = $3, group_number = $4,
               subscriber_name = $5, updated_at = now()`,
        [
          athleteId,
          insurance.provider.trim(),
          insurance.policyNumber || null,
          insurance.groupNumber || null,
          insurance.subscriberName || null,
        ]
      );
    }

    await query(
      'UPDATE portal_users SET onboarding_complete = true WHERE id = $1',
      [portalUserId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /portal/onboarding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Athlete Dashboard ────────────────────────────────────────────────

const SYMPTOM_FIELDS = [
  'headache', 'pressure_in_head', 'neck_pain', 'nausea_or_vomiting', 'dizziness',
  'blurred_vision', 'balance_problems', 'sensitivity_to_light', 'sensitivity_to_noise',
  'feeling_slowed_down', 'feeling_in_fog', 'dont_feel_right', 'difficulty_concentrating',
  'difficulty_remembering', 'fatigue_or_low_energy', 'confusion', 'drowsiness',
  'more_emotional', 'irritability', 'sadness', 'nervous_or_anxious', 'visual_problems',
];

const RTP_PRIORITY = { 'Out': 3, 'Limited Participation': 2, 'Full Participation': 1 };
const RTP_LABEL    = { 'Out': 'Out', 'Limited Participation': 'Limited', 'Full Participation': 'Full Participation' };

// GET /api/portal/athlete-status
router.get('/athlete-status', requirePortalAuth, async (req, res) => {
  const { athleteId } = req.portalUser;
  if (!athleteId) return res.json({ status: 'No Active Injuries' });
  try {
    const { rows } = await query(
      `SELECT rtp_status, body_part FROM injuries
       WHERE athlete_id = $1 AND is_active = true AND rtp_status != 'Cleared'
       ORDER BY injury_date DESC`,
      [athleteId]
    );
    if (!rows.length) return res.json({ status: 'No Active Injuries' });
    rows.sort((a, b) => (RTP_PRIORITY[b.rtp_status] ?? 0) - (RTP_PRIORITY[a.rtp_status] ?? 0));
    res.json({
      status:        RTP_LABEL[rows[0].rtp_status] ?? rows[0].rtp_status,
      injury_count:  rows.length,
      injuries:      rows.map(r => ({ body_part: r.body_part, status: RTP_LABEL[r.rtp_status] ?? r.rtp_status })),
    });
  } catch (err) {
    console.error('GET /portal/athlete-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/my-rehab
router.get('/my-rehab', requirePortalAuth, async (req, res) => {
  const { athleteId, schoolId } = req.portalUser;
  if (!athleteId) return res.json([]);
  try {
    const { rows: aRows } = await query('SELECT name FROM athletes WHERE id = $1', [athleteId]);
    if (!aRows[0]) return res.json([]);
    const { rows } = await query(
      `SELECT rp.id, rp.name, rp.description, rp.created_at,
              COUNT(pe.id)::int AS exercise_count
       FROM rehab_programs rp
       LEFT JOIN program_exercises pe ON pe.program_id = rp.id
       WHERE rp.school_id = $1 AND rp.athlete_name = $2
       GROUP BY rp.id
       ORDER BY rp.created_at DESC`,
      [schoolId, aRows[0].name]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-rehab error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/concussion-status
router.get('/concussion-status', requirePortalAuth, async (req, res) => {
  const { athleteId, schoolId } = req.portalUser;
  if (!athleteId) return res.json({ active: false });
  try {
    const { rows: caseRows } = await query(
      `SELECT id, current_step, injury_date FROM concussion_cases
       WHERE athlete_id = $1 AND status = 'active'
       ORDER BY opened_at DESC LIMIT 1`,
      [athleteId]
    );
    if (!caseRows[0]) return res.json({ active: false });
    const cc = caseRows[0];
    const [{ rows: stepRows }, { rows: checkinRows }] = await Promise.all([
      query('SELECT step_name FROM rtp_protocols WHERE school_id = $1 AND step_number = $2', [schoolId, cc.current_step]),
      query('SELECT MAX(checkin_date) AS last_checkin FROM concussion_checkins WHERE case_id = $1', [cc.id]),
    ]);
    res.json({
      active:       true,
      case_id:      cc.id,
      current_step: cc.current_step,
      step_name:    stepRows[0]?.step_name ?? `Step ${cc.current_step}`,
      last_checkin: checkinRows[0]?.last_checkin ?? null,
      injury_date:  cc.injury_date,
    });
  } catch (err) {
    console.error('GET /portal/concussion-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/rehab/:programId
router.get('/rehab/:programId', requirePortalAuth, async (req, res) => {
  const { athleteId, schoolId } = req.portalUser;
  if (!athleteId) return res.status(404).json({ error: 'Not found' });
  try {
    const { rows: aRows } = await query('SELECT name FROM athletes WHERE id = $1', [athleteId]);
    if (!aRows[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: progRows } = await query(
      `SELECT id, name, description FROM rehab_programs
       WHERE id = $1 AND school_id = $2 AND athlete_name = $3`,
      [req.params.programId, schoolId, aRows[0].name]
    );
    if (!progRows[0]) return res.status(404).json({ error: 'Program not found' });
    const { rows: exercises } = await query(
      `SELECT pe.sets, pe.reps, pe.duration_seconds, pe.notes AS program_notes,
              pe.sort_order, e.name AS exercise_name, e.description AS exercise_description
       FROM program_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.program_id = $1
       ORDER BY pe.sort_order ASC, pe.id ASC`,
      [req.params.programId]
    );
    res.json({ ...progRows[0], exercises });
  } catch (err) {
    console.error('GET /portal/rehab/:programId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/concussion-checkin
router.post('/concussion-checkin', requirePortalAuth, async (req, res) => {
  const { athleteId } = req.portalUser;
  if (!athleteId) return res.status(400).json({ error: 'No athlete linked' });
  const { symptoms = {}, sleep_quality, notes } = req.body;
  try {
    const { rows: caseRows } = await query(
      `SELECT id, school_id FROM concussion_cases
       WHERE athlete_id = $1 AND status = 'active'
       ORDER BY opened_at DESC LIMIT 1`,
      [athleteId]
    );
    if (!caseRows[0]) return res.status(404).json({ error: 'No active concussion case' });
    const { rows: aRows } = await query('SELECT name FROM athletes WHERE id = $1', [athleteId]);
    const today = new Date().toISOString().split('T')[0];
    const validSymptoms = {};
    for (const field of SYMPTOM_FIELDS) {
      const val = parseInt(symptoms[field], 10);
      if (!isNaN(val) && val >= 0 && val <= 6) validSymptoms[field] = val;
    }
    const baseFields = ['case_id', 'school_id', 'checkin_date', 'submitted_by', 'sleep_quality', 'notes'];
    const baseValues = [
      caseRows[0].id, caseRows[0].school_id, today,
      aRows[0]?.name ?? 'athlete', sleep_quality ?? null, notes ?? null,
    ];
    const symKeys = Object.keys(validSymptoms);
    const allFields = [...baseFields, ...symKeys];
    const allValues = [...baseValues, ...Object.values(validSymptoms)];
    const placeholders = allValues.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await query(
      `INSERT INTO concussion_checkins (${allFields.join(', ')}) VALUES (${placeholders}) RETURNING id, checkin_date`,
      allValues
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /portal/concussion-checkin error:', err.message);
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
    logActivity({ schoolId: req.portalUser.schoolId, action: 'form.submitted', entityType: 'form_assignment', entityId: req.params.assignmentId, metadata: { role } });
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

// ── Parent Portal Routes ────────────────────────────────────────────

// GET /api/portal/my-athletes
// For parent role: returns all athletes linked to this parent account
router.get('/my-athletes', requirePortalAuth, async (req, res) => {
  const { portalUserId, role } = req.portalUser;
  if (role !== 'parent') return res.status(403).json({ error: 'Parent access only' });
  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.sport, a.grade,
              (SELECT rtp_status FROM injuries
               WHERE athlete_id = a.id AND is_active = true AND rtp_status != 'Cleared'
               ORDER BY CASE rtp_status WHEN 'Out' THEN 3 WHEN 'Limited Participation' THEN 2 ELSE 1 END DESC
               LIMIT 1) AS rtp_status,
              (SELECT COUNT(*)::int FROM injuries WHERE athlete_id = a.id AND is_active = true) AS active_injury_count,
              (SELECT COUNT(*)::int FROM portal_form_assignments pfa
               WHERE pfa.athlete_id = a.id AND pfa.assigned_to IN ('parent','both')
               AND NOT EXISTS (
                 SELECT 1 FROM portal_form_submissions pfs WHERE pfs.assignment_id = pfa.id
               )) AS pending_forms
       FROM portal_parent_athlete ppa
       JOIN athletes a ON a.id = ppa.athlete_id
       WHERE ppa.parent_id = $1
       ORDER BY a.name ASC`,
      [portalUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/athlete/:athleteId/status
// Parent view of a specific athlete's injury status (respects parent_visibility)
router.get('/athlete/:athleteId/status', requirePortalAuth, async (req, res) => {
  const { portalUserId, role } = req.portalUser;
  if (role !== 'parent') return res.status(403).json({ error: 'Parent access only' });
  try {
    const { rows: link } = await query(
      'SELECT 1 FROM portal_parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
      [portalUserId, req.params.athleteId]
    );
    if (!link[0]) return res.status(403).json({ error: 'Not authorized for this athlete' });

    const { rows } = await query(
      `SELECT i.id, i.body_part, i.rtp_status, i.injury_date, i.parent_visibility
       FROM injuries i
       WHERE i.athlete_id = $1 AND i.is_active = true AND i.rtp_status != 'Cleared'
       ORDER BY i.injury_date DESC`,
      [req.params.athleteId]
    );

    const visible = rows.map((i) => {
      const vis = i.parent_visibility ?? {};
      return {
        id:           i.id,
        rtp_status:   (vis.status !== false) ? i.rtp_status : null,
        body_part:    (vis.body_part !== false) ? i.body_part : null,
        injury_date:  i.injury_date,
      };
    });

    if (!visible.length) return res.json({ status: 'No Active Injuries', injuries: [] });

    const priority = { 'Out': 3, 'Limited Participation': 2, 'Full Participation': 1 };
    const label    = { 'Out': 'Out', 'Limited Participation': 'Limited', 'Full Participation': 'Full Participation' };
    const top = [...visible].sort((a, b) => (priority[b.rtp_status] ?? 0) - (priority[a.rtp_status] ?? 0))[0];

    res.json({
      status:   label[top.rtp_status] ?? top.rtp_status ?? 'Active Injury',
      injuries: visible,
    });
  } catch (err) {
    console.error('GET /portal/athlete/:athleteId/status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/athlete/:athleteId/forms
// Parent view of forms assigned to an athlete that target parents
router.get('/athlete/:athleteId/forms', requirePortalAuth, async (req, res) => {
  const { portalUserId, role } = req.portalUser;
  if (role !== 'parent') return res.status(403).json({ error: 'Parent access only' });
  try {
    const { rows: link } = await query(
      'SELECT 1 FROM portal_parent_athlete WHERE parent_id = $1 AND athlete_id = $2',
      [portalUserId, req.params.athleteId]
    );
    if (!link[0]) return res.status(403).json({ error: 'Not authorized for this athlete' });

    const { rows } = await query(
      `SELECT pfa.*,
              pf.title             AS form_title,
              pf.description       AS form_description,
              pf.requires_signature,
              EXISTS (
                SELECT 1 FROM portal_form_submissions pfs
                WHERE pfs.assignment_id = pfa.id
                  AND (pfs.portal_user_id = $1 OR pfs.submitted_by_role = 'parent')
              ) AS completed
       FROM portal_form_assignments pfa
       JOIN portal_forms pf ON pf.id = pfa.form_id
       WHERE pfa.athlete_id = $2 AND pfa.assigned_to IN ('parent', 'both')
       ORDER BY pfa.due_date ASC NULLS LAST, pfa.created_at DESC`,
      [portalUserId, req.params.athleteId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/athlete/:athleteId/forms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AT-side: link/unlink parent accounts ───────────────────────────

// GET /api/portal/athlete/:athleteId/parents
router.get('/athlete/:athleteId/parents', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pu.id, pu.email, pu.name, pu.avatar_url, ppa.linked_at
       FROM portal_parent_athlete ppa
       JOIN portal_users pu ON pu.id = ppa.parent_id
       WHERE ppa.athlete_id = $1 AND ppa.school_id = $2
       ORDER BY ppa.linked_at DESC`,
      [req.params.athleteId, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /portal/athlete/:athleteId/parents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/athlete/:athleteId/parents/invite
// Sends invite email to a parent and optionally links them if account exists
router.post('/athlete/:athleteId/parents/invite', requireAuth, async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'email is required' });
  try {
    const { rows: ath } = await query(
      'SELECT name FROM athletes WHERE id = $1 AND school_id = $2',
      [req.params.athleteId, req.schoolId]
    );
    if (!ath[0]) return res.status(404).json({ error: 'Athlete not found' });

    const { rows: sch } = await query('SELECT name FROM schools WHERE id = $1', [req.schoolId]);
    const schoolName   = sch[0]?.name ?? 'your school';
    const athleteName  = ath[0].name;
    const normalEmail  = email.trim().toLowerCase();

    // If portal account already exists, link directly
    const { rows: existing } = await query(
      'SELECT id FROM portal_users WHERE email = $1',
      [normalEmail]
    );

    if (existing[0]) {
      await query(
        `INSERT INTO portal_parent_athlete (parent_id, athlete_id, school_id)
         VALUES ($1, $2, $3) ON CONFLICT (parent_id, athlete_id) DO NOTHING`,
        [existing[0].id, req.params.athleteId, req.schoolId]
      );
    }

    if (resend) {
      const portalUrl = process.env.PORTAL_URL ?? 'https://app.fieldsidehealth.com/portal/login';
      await resend.emails.send({
        from:    'Fieldside <noreply@fieldsidehealth.com>',
        to:      normalEmail,
        subject: `Parent portal access — ${athleteName} at ${schoolName}`,
        html:    `<p>You've been invited to view ${athleteName}'s health updates on the Fieldside parent portal.</p>
                  <p><a href="${portalUrl}">Sign in at ${portalUrl}</a></p>
                  <p>If you don't have an account yet, sign in with Google using this email address.</p>`,
      });
    }

    res.json({ ok: true, linked: !!existing[0] });
  } catch (err) {
    console.error('POST /portal/athlete/:athleteId/parents/invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/portal/athlete/:athleteId/parents/:parentId
router.delete('/athlete/:athleteId/parents/:parentId', requireAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM portal_parent_athlete WHERE parent_id = $1 AND athlete_id = $2 AND school_id = $3',
      [req.params.parentId, req.params.athleteId, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /portal/athlete/:athleteId/parents/:parentId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

