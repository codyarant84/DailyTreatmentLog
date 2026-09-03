import express from 'express';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePortalAuth } from '../middleware/requirePortalAuth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = express.Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const BOOKED_STATUSES = ['pending', 'approved'];

// ── Time helpers (pg `time` columns come back as plain "HH:MM:SS" strings —
// no timezone concerns since there's no date component at all) ────────────
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}:00`;
}

function generateSlotTimes(startTime, endTime, durationMinutes) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots = [];
  for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
    slots.push(minutesToTimeStr(t));
  }
  return slots;
}

function dayOfWeekFor(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay(); // 0 = Sunday .. 6 = Saturday, local time
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Builds the full slot list for one school/date, merging the recurring weekly
// template with that date's one-off overrides (blocking or additive), and
// attaches current bookings. `bookings` includes athlete names — callers that
// expose this to the portal (other athletes) must strip that field.
async function buildSlotsForDate(schoolId, dateStr) {
  const dayOfWeek = dayOfWeekFor(dateStr);

  const { rows: recurring } = await query(
    `SELECT * FROM schedule_availability
     WHERE school_id = $1 AND is_recurring = true AND day_of_week = $2 AND is_available = true`,
    [schoolId, dayOfWeek]
  );
  const { rows: overrides } = await query(
    `SELECT * FROM schedule_availability WHERE school_id = $1 AND specific_date = $2`,
    [schoolId, dateStr]
  );

  const blockRanges = overrides
    .filter((o) => !o.is_available)
    .map((o) => ({ start: timeToMinutes(o.start_time), end: timeToMinutes(o.end_time) }));
  const isBlocked = (startMin, endMin) => blockRanges.some((b) => startMin < b.end && endMin > b.start);

  const byTime = new Map(); // time string -> max capacity
  for (const block of recurring) {
    for (const t of generateSlotTimes(block.start_time, block.end_time, block.slot_duration_minutes)) {
      const tMin = timeToMinutes(t);
      if (isBlocked(tMin, tMin + block.slot_duration_minutes)) continue;
      if (!byTime.has(t) || byTime.get(t) < block.max_athletes_per_slot) byTime.set(t, block.max_athletes_per_slot);
    }
  }
  for (const block of overrides.filter((o) => o.is_available)) {
    for (const t of generateSlotTimes(block.start_time, block.end_time, block.slot_duration_minutes)) {
      if (!byTime.has(t) || byTime.get(t) < block.max_athletes_per_slot) byTime.set(t, block.max_athletes_per_slot);
    }
  }

  if (byTime.size === 0) return [];

  const { rows: bookings } = await query(
    `SELECT tr.id, tr.requested_time, tr.status, tr.reason, tr.body_part, tr.notes, a.name AS athlete_name
     FROM treatment_requests tr
     JOIN athletes a ON a.id = tr.athlete_id
     WHERE tr.school_id = $1 AND tr.requested_date = $2 AND tr.status = ANY($3)
     ORDER BY tr.requested_time ASC`,
    [schoolId, dateStr, BOOKED_STATUSES]
  );

  return [...byTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, max]) => {
      const slotBookings = bookings.filter((b) => b.requested_time === time);
      const bookedCount = slotBookings.length;
      return {
        time,
        max_athletes_per_slot: max,
        booked: bookedCount,
        remaining: Math.max(0, max - bookedCount),
        is_full: bookedCount >= max,
        bookings: slotBookings,
      };
    });
}

async function sendRequestStatusEmail(request, status, reason) {
  if (!resend || !request.portal_user_id) return;
  try {
    const { rows } = await query('SELECT email FROM portal_users WHERE id = $1', [request.portal_user_id]);
    const email = rows[0]?.email;
    if (!email) return;

    const dateLabel = new Date(`${request.requested_date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const [h, m] = request.requested_time.split(':').map(Number);
    const timeLabel = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const portalUrl = process.env.PORTAL_URL ?? 'https://app.fieldsidehealth.com/portal/login';

    const subject = status === 'approved'
      ? 'Your treatment request has been approved'
      : 'Your treatment request was not approved';
    const html = status === 'approved'
      ? `<p>Your treatment request for <strong>${dateLabel} at ${timeLabel}</strong> has been approved.</p>
         <p><a href="${portalUrl}">View in the Fieldside portal</a></p>`
      : `<p>Your treatment request for <strong>${dateLabel} at ${timeLabel}</strong> was not approved.</p>
         ${reason ? `<p>Reason: ${reason}</p>` : ''}
         <p><a href="${portalUrl}">View in the Fieldside portal</a></p>`;

    await resend.emails.send({ from: 'Fieldside <noreply@fieldsidehealth.com>', to: email, subject, html });
  } catch (err) {
    console.error('[schedule] status email failed:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// AT-side routes
// ══════════════════════════════════════════════════════════════════════

// GET /api/schedule/availability
router.get('/availability', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM schedule_availability WHERE school_id = $1
       ORDER BY is_recurring DESC, day_of_week ASC NULLS LAST, specific_date ASC NULLS LAST, start_time ASC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /schedule/availability error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/availability
router.post('/availability', requireAuth, async (req, res) => {
  const {
    day_of_week, specific_date, start_time, end_time,
    slot_duration_minutes, max_athletes_per_slot, is_recurring, is_available,
  } = req.body;

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'start_time and end_time are required.' });
  }
  const hasDayOfWeek = day_of_week !== undefined && day_of_week !== null && day_of_week !== '';
  if (!hasDayOfWeek && !specific_date) {
    return res.status(400).json({ error: 'Provide either day_of_week or specific_date.' });
  }
  if (hasDayOfWeek && specific_date) {
    return res.status(400).json({ error: 'Provide only one of day_of_week or specific_date, not both.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO schedule_availability
         (school_id, profile_id, day_of_week, specific_date, start_time, end_time,
          slot_duration_minutes, max_athletes_per_slot, is_recurring, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.schoolId, req.userId,
        hasDayOfWeek ? day_of_week : null, specific_date || null,
        start_time, end_time,
        slot_duration_minutes || 15, max_athletes_per_slot || 3,
        is_recurring ?? hasDayOfWeek,
        is_available ?? true,
      ]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'schedule.availability_created', entityType: 'schedule_availability', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /schedule/availability error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/availability/:id
router.put('/availability/:id', requireAuth, async (req, res) => {
  const {
    day_of_week, specific_date, start_time, end_time,
    slot_duration_minutes, max_athletes_per_slot, is_recurring, is_available,
  } = req.body;

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'start_time and end_time are required.' });
  }
  const hasDayOfWeek = day_of_week !== undefined && day_of_week !== null && day_of_week !== '';
  if (!hasDayOfWeek && !specific_date) {
    return res.status(400).json({ error: 'Provide either day_of_week or specific_date.' });
  }
  if (hasDayOfWeek && specific_date) {
    return res.status(400).json({ error: 'Provide only one of day_of_week or specific_date, not both.' });
  }

  try {
    const { rows } = await query(
      `UPDATE schedule_availability
       SET day_of_week = $1, specific_date = $2, start_time = $3, end_time = $4,
           slot_duration_minutes = $5, max_athletes_per_slot = $6, is_recurring = $7, is_available = $8
       WHERE id = $9 AND school_id = $10
       RETURNING *`,
      [
        hasDayOfWeek ? day_of_week : null, specific_date || null,
        start_time, end_time,
        slot_duration_minutes || 15, max_athletes_per_slot || 3,
        is_recurring ?? hasDayOfWeek, is_available ?? true,
        req.params.id, req.schoolId,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Availability block not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /schedule/availability/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule/availability/:id
router.delete('/availability/:id', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM schedule_availability WHERE id = $1 AND school_id = $2', [req.params.id, req.schoolId]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /schedule/availability/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/requests?date=&status=
router.get('/requests', requireAuth, async (req, res) => {
  const { date, status } = req.query;
  const conditions = ['tr.school_id = $1'];
  const params = [req.schoolId];
  let p = 2;
  if (date) { conditions.push(`tr.requested_date = $${p++}`); params.push(date); }
  if (status) { conditions.push(`tr.status = $${p++}`); params.push(status); }

  try {
    const { rows } = await query(
      `SELECT tr.*, a.name AS athlete_name, a.sport AS athlete_sport, rp.email AS reviewed_by_email
       FROM treatment_requests tr
       JOIN athletes a ON a.id = tr.athlete_id
       LEFT JOIN profiles rp ON rp.id = tr.reviewed_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY tr.requested_date DESC, tr.requested_time DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /schedule/requests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/requests/:id/approve
router.put('/requests/:id/approve', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE treatment_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = now()
       WHERE id = $2 AND school_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.userId, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pending request not found.' });

    await sendRequestStatusEmail(rows[0], 'approved');
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'schedule.request_approved', entityType: 'treatment_request', entityId: rows[0].id });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /schedule/requests/:id/approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/requests/:id/deny
router.put('/requests/:id/deny', requireAuth, async (req, res) => {
  const { reason } = req.body;
  try {
    const { rows } = await query(
      `UPDATE treatment_requests
       SET status = 'denied', reviewed_by = $1, reviewed_at = now()
       WHERE id = $2 AND school_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.userId, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pending request not found.' });

    await sendRequestStatusEmail(rows[0], 'denied', reason);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'schedule.request_denied', entityType: 'treatment_request', entityId: rows[0].id, metadata: reason ? { reason } : null });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /schedule/requests/:id/deny error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/calendar?start_date=
router.get('/calendar', requireAuth, async (req, res) => {
  const { start_date } = req.query;
  if (!start_date) return res.status(400).json({ error: 'start_date is required.' });

  try {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = addDays(start_date, i);
      const slots = await buildSlotsForDate(req.schoolId, dateStr);
      days.push({ date: dateStr, day_of_week: dayOfWeekFor(dateStr), slots });
    }
    res.json(days);
  } catch (err) {
    console.error('GET /schedule/calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// Portal-side routes
// ══════════════════════════════════════════════════════════════════════

// GET /api/schedule/available-slots?date=
router.get('/available-slots', requirePortalAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required.' });

  const today = todayStr();
  const maxDate = addDays(today, 7);
  if (date < today || date > maxDate) {
    return res.status(400).json({ error: 'Date must be within the next 7 days.' });
  }

  try {
    const slots = await buildSlotsForDate(req.portalUser.schoolId, date);
    // Strip other athletes' booking details before exposing to the portal
    res.json(slots.map(({ bookings, ...rest }) => rest));
  } catch (err) {
    console.error('GET /schedule/available-slots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/request
router.post('/request', requirePortalAuth, async (req, res) => {
  const { portalUserId, athleteId, schoolId, role } = req.portalUser;
  if (role !== 'athlete') {
    return res.status(403).json({ error: 'Only athletes can submit treatment requests.' });
  }
  if (!athleteId) {
    return res.status(400).json({ error: 'No athlete linked to this account.' });
  }

  const { requested_date, requested_time, reason, body_part, notes } = req.body;
  if (!requested_date || !requested_time || !reason?.trim()) {
    return res.status(400).json({ error: 'requested_date, requested_time, and reason are required.' });
  }

  const today = todayStr();
  const maxDate = addDays(today, 7);
  if (requested_date < today || requested_date > maxDate) {
    return res.status(400).json({ error: 'Requested date must be within the next 7 days.' });
  }

  try {
    const slots = await buildSlotsForDate(schoolId, requested_date);
    const slot = slots.find((s) => s.time === requested_time);
    if (!slot) return res.status(400).json({ error: 'That time is not available.' });

    const autoApprove = !slot.is_full;
    const { rows } = await query(
      `INSERT INTO treatment_requests
         (school_id, athlete_id, portal_user_id, requested_date, requested_time,
          reason, body_part, notes, status, auto_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        schoolId, athleteId, portalUserId, requested_date, requested_time,
        reason.trim(), body_part || null, notes || null,
        autoApprove ? 'approved' : 'pending', autoApprove,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /schedule/request error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/my-requests
router.get('/my-requests', requirePortalAuth, async (req, res) => {
  const { athleteId } = req.portalUser;
  if (!athleteId) return res.json([]);
  try {
    const { rows } = await query(
      `SELECT * FROM treatment_requests
       WHERE athlete_id = $1 AND requested_date >= CURRENT_DATE
       ORDER BY requested_date ASC, requested_time ASC`,
      [athleteId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /schedule/my-requests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule/my-requests/:id
router.delete('/my-requests/:id', requirePortalAuth, async (req, res) => {
  const { athleteId } = req.portalUser;
  try {
    const { rows } = await query(
      `UPDATE treatment_requests
       SET status = 'cancelled'
       WHERE id = $1 AND athlete_id = $2 AND status IN ('pending', 'approved')
       RETURNING *`,
      [req.params.id, athleteId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or cannot be cancelled.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('DELETE /schedule/my-requests/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
