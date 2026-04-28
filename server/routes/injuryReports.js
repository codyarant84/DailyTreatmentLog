import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendSMS } from '../lib/sms.js';

const router = express.Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────

async function buildMessage(schoolId, userId, notes) {
  const [schoolRes, profileRes, injuryRes] = await Promise.all([
    query(`SELECT name FROM schools WHERE id = $1`, [schoolId]),
    query(`SELECT email FROM profiles WHERE id = $1`, [userId]),
    query(
      `SELECT i.body_part, i.injury_type, i.rtp_status, a.name AS athlete_name
       FROM injuries i JOIN athletes a ON a.id = i.athlete_id
       WHERE i.school_id = $1 AND i.is_active = true
       ORDER BY a.name`,
      [schoolId]
    ),
  ]);

  const schoolName = schoolRes.rows[0]?.name ?? 'Unknown School';
  const atEmail    = profileRes.rows[0]?.email ?? 'Athletic Trainer';
  const injuries   = injuryRes.rows;
  const today      = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  let msg = `FIELDSIDE INJURY REPORT — ${schoolName}\n${today}\n`;

  if (injuries.length === 0) {
    msg += `\nACTIVE INJURIES: None`;
  } else {
    msg += `\nACTIVE INJURIES (${injuries.length}):\n`;
    for (const i of injuries) {
      const diagnosis = i.injury_type ? ` (${i.injury_type})` : '';
      const status    = i.rtp_status ?? 'No status';
      msg += `• ${i.athlete_name} — ${i.body_part ?? 'Unknown'}${diagnosis}\n  Status: ${status}\n`;
    }
  }

  if (notes?.trim()) {
    msg += `\nNotes: ${notes.trim()}`;
  }

  msg += `\n\nSent by ${atEmail}, ATC`;
  return { message: msg, schoolName };
}

async function getRecipientsForLists(listIds, schoolId) {
  if (!listIds?.length) return [];
  const { rows } = await query(
    `SELECT DISTINCT rr.id, rr.name, rr.phone, rr.role
     FROM report_recipients rr
     JOIN recipient_list_members rlm ON rlm.recipient_id = rr.id
     JOIN recipient_lists rl ON rl.id = rlm.list_id
     WHERE rl.id = ANY($1) AND rr.school_id = $2
     ORDER BY rr.name`,
    [listIds, schoolId]
  );
  return rows;
}

// ── Recipients ────────────────────────────────────────────────────────

router.get('/recipients', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM report_recipients WHERE school_id = $1 ORDER BY name`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injury-reports/recipients error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/recipients', async (req, res) => {
  const { name, phone, role } = req.body;
  if (!name?.trim() || !phone?.trim() || !role?.trim()) {
    return res.status(400).json({ error: 'name, phone, and role are required.' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO report_recipients (school_id, name, phone, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.schoolId, name.trim(), phone.trim(), role.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /injury-reports/recipients error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/recipients/:id', async (req, res) => {
  const { name, phone, role } = req.body;
  try {
    const { rows } = await query(
      `UPDATE report_recipients SET name = $1, phone = $2, role = $3
       WHERE id = $4 AND school_id = $5 RETURNING *`,
      [name?.trim(), phone?.trim(), role?.trim(), req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Recipient not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /injury-reports/recipients/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/recipients/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM report_recipients WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injury-reports/recipients/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Lists ─────────────────────────────────────────────────────────────

router.get('/lists', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT rl.*,
         COALESCE(json_agg(
           json_build_object('id', rr.id, 'name', rr.name, 'phone', rr.phone, 'role', rr.role)
           ORDER BY rr.name
         ) FILTER (WHERE rr.id IS NOT NULL), '[]') AS members
       FROM recipient_lists rl
       LEFT JOIN recipient_list_members rlm ON rlm.list_id = rl.id
       LEFT JOIN report_recipients rr ON rr.id = rlm.recipient_id
       WHERE rl.school_id = $1
       GROUP BY rl.id
       ORDER BY rl.name`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injury-reports/lists error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/lists', async (req, res) => {
  const { name, recipientIds = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
  try {
    const { rows } = await query(
      `INSERT INTO recipient_lists (school_id, name) VALUES ($1, $2) RETURNING *`,
      [req.schoolId, name.trim()]
    );
    const list = rows[0];
    if (recipientIds.length) {
      const vals = recipientIds.map((rid, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO recipient_list_members (list_id, recipient_id) VALUES ${vals}`,
        [list.id, ...recipientIds]
      );
    }
    list.members = [];
    res.status(201).json(list);
  } catch (err) {
    console.error('POST /injury-reports/lists error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/lists/:id', async (req, res) => {
  const { name, recipientIds = [] } = req.body;
  try {
    const { rows } = await query(
      `UPDATE recipient_lists SET name = $1 WHERE id = $2 AND school_id = $3 RETURNING *`,
      [name?.trim(), req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'List not found.' });

    await query(`DELETE FROM recipient_list_members WHERE list_id = $1`, [req.params.id]);
    if (recipientIds.length) {
      const vals = recipientIds.map((rid, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO recipient_list_members (list_id, recipient_id) VALUES ${vals}`,
        [req.params.id, ...recipientIds]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /injury-reports/lists/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lists/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM recipient_lists WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injury-reports/lists/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Schedules ─────────────────────────────────────────────────────────

router.get('/schedules', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM scheduled_reports WHERE school_id = $1 ORDER BY name`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /injury-reports/schedules error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/schedules', async (req, res) => {
  const { name, frequency, day_of_week, send_time, list_ids, include_notes, active } = req.body;
  if (!name?.trim() || !frequency || !send_time || !list_ids?.length) {
    return res.status(400).json({ error: 'name, frequency, send_time, and list_ids are required.' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO scheduled_reports (school_id, name, frequency, day_of_week, send_time, list_ids, include_notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.schoolId, name.trim(), frequency, day_of_week ?? null, send_time,
       list_ids, include_notes ?? true, active ?? true]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /injury-reports/schedules error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/schedules/:id', async (req, res) => {
  const { name, frequency, day_of_week, send_time, list_ids, include_notes, active } = req.body;
  try {
    const { rows } = await query(
      `UPDATE scheduled_reports
       SET name = $1, frequency = $2, day_of_week = $3, send_time = $4,
           list_ids = $5, include_notes = $6, active = $7
       WHERE id = $8 AND school_id = $9 RETURNING *`,
      [name?.trim(), frequency, day_of_week ?? null, send_time,
       list_ids, include_notes ?? true, active ?? true,
       req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Schedule not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /injury-reports/schedules/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM scheduled_reports WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /injury-reports/schedules/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Preview ───────────────────────────────────────────────────────────

router.post('/preview', async (req, res) => {
  const { listIds = [], notes } = req.body;
  try {
    const [{ message }, recipients] = await Promise.all([
      buildMessage(req.schoolId, req.userId, notes),
      getRecipientsForLists(listIds, req.schoolId),
    ]);
    res.json({ message, recipients });
  } catch (err) {
    console.error('POST /injury-reports/preview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Send ──────────────────────────────────────────────────────────────

router.post('/send', async (req, res) => {
  const { listIds = [], notes } = req.body;
  if (!listIds.length) return res.status(400).json({ error: 'Select at least one recipient list.' });

  try {
    const [{ message }, recipients] = await Promise.all([
      buildMessage(req.schoolId, req.userId, notes),
      getRecipientsForLists(listIds, req.schoolId),
    ]);

    if (!recipients.length) {
      return res.status(400).json({ error: 'Selected lists have no recipients.' });
    }

    const results = await Promise.allSettled(
      recipients.map(r => sendSMS(r.phone, message))
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const errors = results
      .map((r, i) => r.status === 'rejected' ? `${recipients[i].name}: ${r.reason?.message}` : null)
      .filter(Boolean);

    res.json({ sent, failed, errors, total: recipients.length });
  } catch (err) {
    console.error('POST /injury-reports/send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
