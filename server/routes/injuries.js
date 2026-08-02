import express from 'express';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadToPath } from '../lib/storage.js';
import { logActivity } from '../middleware/logActivity.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const router = express.Router();
router.use(requireAuth);

// Base SELECT used by GET / and GET /:id
const INJURY_SELECT = `
  SELECT i.*, a.name AS athlete_name, a.sport AS athlete_sport
  FROM injuries i
  LEFT JOIN athletes a ON a.id = i.athlete_id
`;

// GET /api/injuries
// ?active=true          → only is_active injuries
// ?athlete_name=string  → injuries for a specific athlete (lookup by name)
router.get('/', async (req, res) => {
  try {
    const { active, athlete_name } = req.query;

    const conditions = ['i.school_id = $1'];
    const params = [req.schoolId];
    let p = 2;

    if (active === 'true') {
      conditions.push(`i.is_active = true`);
    }

    if (athlete_name) {
      conditions.push(`a.name = $${p++}`);
      params.push(decodeURIComponent(athlete_name));
    }

    if (req.role === 'coach' && req.coachSport) {
      conditions.push(`a.sport = $${p++}`);
      params.push(req.coachSport);
    }

    const { rows } = await query(
      `${INJURY_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY i.injury_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/injuries/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `${INJURY_SELECT} WHERE i.id = $1 AND i.school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Injury not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/injuries
router.post('/', async (req, res) => {
  const { athlete_id, injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes } = req.body;

  if (!athlete_id || !injury_date || !body_part || !injury_type) {
    return res.status(400).json({ error: 'athlete_id, injury_date, body_part, and injury_type are required.' });
  }

  try {
    // Verify athlete belongs to this school
    const { rows: athRows } = await query(
      `SELECT id FROM athletes WHERE id = $1 AND school_id = $2`,
      [athlete_id, req.schoolId]
    );
    if (!athRows[0]) return res.status(400).json({ error: 'Athlete not found.' });

    const { rows } = await query(
      `INSERT INTO injuries
         (athlete_id, school_id, logged_by, injury_date, body_part, injury_type,
          mechanism, severity, rtp_status, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING *`,
      [athlete_id, req.schoolId, req.userId, injury_date, body_part, injury_type,
       mechanism || null, severity || null, rtp_status || 'Out', notes || null]
    );

    // Fetch with athlete join for response shape
    const { rows: full } = await query(
      `${INJURY_SELECT} WHERE i.id = $1`,
      [rows[0].id]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'injury.created', entityType: 'injury', entityId: rows[0].id });
    res.status(201).json(full[0]);
  } catch (err) {
    console.error('POST /injuries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/injuries/:id
router.put('/:id', async (req, res) => {
  const { injury_date, body_part, injury_type, mechanism, severity, rtp_status, notes, is_active } = req.body;

  if (!injury_date || !body_part || !injury_type) {
    return res.status(400).json({ error: 'injury_date, body_part, and injury_type are required.' });
  }

  try {
    const wasActive = is_active ?? true;
    const isNowInactive = wasActive === false;

    // Capture old rtp_status before update for notification comparison
    const { rows: before } = await query(
      'SELECT rtp_status, athlete_id FROM injuries WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );

    const { rows } = await query(
      `UPDATE injuries
       SET injury_date = $1, body_part = $2, injury_type = $3, mechanism = $4,
           severity = $5, rtp_status = $6, notes = $7, is_active = $8,
           cleared_at = CASE WHEN $9 THEN NOW() ELSE cleared_at END
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [injury_date, body_part, injury_type, mechanism || null, severity || null,
       rtp_status || 'Out', notes || null, wasActive, isNowInactive,
       req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Injury not found.' });

    const { rows: full } = await query(`${INJURY_SELECT} WHERE i.id = $1`, [rows[0].id]);

    // Notify linked parents when RTP status changes
    if (resend && before[0] && before[0].rtp_status !== rtp_status && before[0].athlete_id) {
      sendRtpChangeNotification(before[0].athlete_id, body_part, rtp_status).catch(() => {});
    }

    res.json(full[0]);
  } catch (err) {
    console.error('PUT /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/injuries/:id/visibility
router.put('/:id/visibility', async (req, res) => {
  const { parent_visibility } = req.body;
  if (!parent_visibility || typeof parent_visibility !== 'object') {
    return res.status(400).json({ error: 'parent_visibility object is required' });
  }
  try {
    const { rows } = await query(
      'UPDATE injuries SET parent_visibility = $1 WHERE id = $2 AND school_id = $3 RETURNING id, parent_visibility',
      [JSON.stringify(parent_visibility), req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Injury not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /injuries/:id/visibility error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function sendRtpChangeNotification(athleteId, bodyPart, newStatus) {
  const { rows: parents } = await query(
    `SELECT pu.email, pu.name, a.name AS athlete_name
     FROM portal_parent_athlete ppa
     JOIN portal_users pu ON pu.id = ppa.parent_id
     JOIN athletes a ON a.id = ppa.athlete_id
     WHERE ppa.athlete_id = $1`,
    [athleteId]
  );
  if (!parents.length) return;
  await Promise.all(parents.map((p) =>
    resend.emails.send({
      from:    'Fieldside <noreply@fieldsidehealth.com>',
      to:      p.email,
      subject: `Status update for ${p.athlete_name}`,
      html:    `<p>Hi ${p.name},</p>
                <p>${p.athlete_name}'s return-to-play status for <strong>${bodyPart}</strong> has been updated to <strong>${newStatus}</strong>.</p>
                <p>Log in to the Fieldside parent portal for more details.</p>`,
    })
  ));
}

// DELETE /api/injuries/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM injuries WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injuries/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Attachments ────────────────────────────────────────────────────

// GET /api/injuries/:id/attachments
router.get('/:id/attachments', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ia.*, p.email AS uploaded_by_email
       FROM injury_attachments ia
       LEFT JOIN profiles p ON p.id = ia.uploaded_by
       WHERE ia.injury_id = $1 AND ia.school_id = $2
       ORDER BY ia.uploaded_at DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injuries/:id/attachments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/injuries/:id/attachments
router.post('/:id/attachments', async (req, res) => {
  const { base64, file_name, file_type } = req.body;
  if (!base64 || !file_name?.trim()) {
    return res.status(400).json({ error: 'base64 and file_name are required.' });
  }

  try {
    const { rows: found } = await query(
      'SELECT id FROM injuries WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Injury not found.' });

    const buffer  = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const safeName = file_name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const key     = `injury-attachments/${req.schoolId}/${req.params.id}/${Date.now()}-${safeName}`;
    const file_url = await uploadToPath(buffer, key, file_type || 'application/octet-stream');

    const { rows } = await query(
      `INSERT INTO injury_attachments (injury_id, school_id, file_name, file_url, file_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, req.schoolId, file_name.trim(), file_url, file_type || null, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /injuries/:id/attachments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/injuries/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    await query(
      'DELETE FROM injury_attachments WHERE id = $1 AND injury_id = $2 AND school_id = $3',
      [req.params.attachmentId, req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injuries/:id/attachments/:attachmentId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
