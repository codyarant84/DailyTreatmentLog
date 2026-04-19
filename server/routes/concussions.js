import express from 'express';
import crypto from 'crypto';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────

const SYMPTOM_FIELDS = [
  'headache', 'pressure_in_head', 'neck_pain', 'nausea_or_vomiting',
  'dizziness', 'blurred_vision', 'balance_problems', 'sensitivity_to_light',
  'sensitivity_to_noise', 'feeling_slowed_down', 'feeling_in_fog',
  'dont_feel_right', 'difficulty_concentrating', 'difficulty_remembering',
  'fatigue_or_low_energy', 'confusion', 'drowsiness', 'more_emotional',
  'irritability', 'sadness', 'nervous_or_anxious', 'visual_problems',
];

// Collect symptom fields present in a request body as { field: value } pairs
function pickSymptoms(body) {
  const out = {};
  for (const f of SYMPTOM_FIELDS) {
    if (f in body) out[f] = body[f] != null ? Number(body[f]) : null;
  }
  return out;
}

// Batch-fetch opener emails from profiles (replaces supabase.auth.admin.getUserById loop)
async function lookupOpenerEmails(rows) {
  const ids = [...new Set(rows.map((r) => r.opened_by).filter(Boolean))];
  if (!ids.length) return {};
  const { rows: profiles } = await query(
    `SELECT id, email FROM profiles WHERE id = ANY($1)`,
    [ids]
  );
  return Object.fromEntries(profiles.map((p) => [p.id, p.email]));
}

async function getRtpStep(schoolId, stepNumber) {
  if (!schoolId || !stepNumber) return null;
  const { rows } = await query(
    `SELECT step_name, description FROM rtp_protocols WHERE school_id = $1 AND step_number = $2`,
    [schoolId, stepNumber]
  );
  return rows[0] ?? null;
}

function flattenCase(row, emailMap = {}) {
  const { athlete_name, athlete_sport, ...c } = row;
  return {
    ...c,
    athlete_name:    athlete_name  ?? null,
    athlete_sport:   athlete_sport ?? null,
    opened_by_email: emailMap[row.opened_by] ?? null,
  };
}

// ── Public check-in routes (no auth) ─────────────────────────────────

// GET /api/concussions/checkin/:token
router.get('/checkin/:token', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cl.*,
              cc.id AS case_id, cc.school_id AS case_school_id,
              cc.current_step, cc.injury_date, cc.status,
              a.name AS athlete_name
       FROM concussion_links cl
       JOIN concussion_cases cc ON cc.id = cl.case_id
       JOIN athletes a ON a.id = cc.athlete_id
       WHERE cl.token = $1 AND cl.is_active = true`,
      [req.params.token]
    );

    const link = rows[0];
    if (!link) return res.status(404).json({ error: 'Link not found or expired.' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired.' });
    }

    const athleteFirstName = link.athlete_name?.split(' ')[0] ?? 'Athlete';
    const days = link.injury_date
      ? Math.floor((Date.now() - new Date(link.injury_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const stepInfo = await getRtpStep(link.case_school_id, link.current_step);

    const today = new Date().toISOString().split('T')[0];
    const { rows: existing } = await query(
      `SELECT id FROM concussion_checkins WHERE case_id = $1 AND checkin_date = $2`,
      [link.case_id, today]
    );

    res.json({
      athlete_first_name:          athleteFirstName,
      current_step:                link.current_step ?? 1,
      current_step_name:           stepInfo?.step_name ?? null,
      current_step_description:    stepInfo?.description ?? null,
      days_since_injury:           days,
      already_checked_in_today:    existing.length > 0,
      link_type:                   link.link_type,
      recipient_name:              link.recipient_name,
      status:                      link.status ?? null,
    });
  } catch (err) {
    console.error('GET /concussions/checkin/:token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concussions/checkin/:token
router.post('/checkin/:token', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cl.*,
              cc.id AS case_id, cc.school_id AS case_school_id,
              cc.current_step, cc.injury_date,
              a.name AS athlete_name
       FROM concussion_links cl
       JOIN concussion_cases cc ON cc.id = cl.case_id
       JOIN athletes a ON a.id = cc.athlete_id
       WHERE cl.token = $1 AND cl.is_active = true`,
      [req.params.token]
    );

    const link = rows[0];
    if (!link) return res.status(404).json({ error: 'Link not found or expired.' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired.' });
    }

    const { sleep_quality, notes, submitted_by } = req.body;
    const symptoms = pickSymptoms(req.body);
    const today = new Date().toISOString().split('T')[0];

    const baseFields = ['case_id', 'school_id', 'checkin_date', 'submitted_by', 'sleep_quality', 'notes'];
    const baseValues = [
      link.case_id, link.case_school_id, today,
      submitted_by || link.recipient_name || null,
      sleep_quality ?? null, notes || null,
    ];

    const symFields = Object.keys(symptoms);
    const allFields = [...baseFields, ...symFields];
    const allValues = [...baseValues, ...Object.values(symptoms)];
    const placeholders = allValues.map((_, i) => `$${i + 1}`).join(', ');

    const { rows: inserted } = await query(
      `INSERT INTO concussion_checkins (${allFields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      allValues
    );

    const stepInfo = await getRtpStep(link.case_school_id, link.current_step);

    res.status(201).json({
      ...inserted[0],
      current_step:             link.current_step,
      current_step_name:        stepInfo?.step_name ?? null,
      current_step_description: stepInfo?.description ?? null,
    });
  } catch (err) {
    console.error('POST /concussions/checkin/:token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Authenticated routes ──────────────────────────────────────────────

// GET /api/concussions
router.get('/', requireAuth, async (req, res) => {
  try {
    const conditions = ['cc.school_id = $1'];
    const params = [req.schoolId];

    if (req.query.status) {
      conditions.push(`cc.status = $2`);
      params.push(req.query.status);
    }

    const { rows } = await query(
      `SELECT cc.*, a.name AS athlete_name, a.sport AS athlete_sport
       FROM concussion_cases cc
       LEFT JOIN athletes a ON a.id = cc.athlete_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cc.opened_at DESC`,
      params
    );

    const emailMap = await lookupOpenerEmails(rows);
    res.json(rows.map((row) => flattenCase(row, emailMap)));
  } catch (err) {
    console.error('GET /concussions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concussions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cc.*, a.name AS athlete_name, a.sport AS athlete_sport
       FROM concussion_cases cc
       LEFT JOIN athletes a ON a.id = cc.athlete_id
       WHERE cc.id = $1 AND cc.school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Concussion case not found.' });

    const row = rows[0];
    let opened_by_email = null;
    if (row.opened_by) {
      const { rows: profile } = await query(`SELECT email FROM profiles WHERE id = $1`, [row.opened_by]);
      opened_by_email = profile[0]?.email ?? null;
    }

    const stepInfo = await getRtpStep(req.schoolId, row.current_step);
    const { athlete_name, athlete_sport, ...c } = row;

    res.json({
      ...c,
      athlete_name,
      athlete_sport,
      opened_by_email,
      current_step_name:        stepInfo?.step_name ?? null,
      current_step_description: stepInfo?.description ?? null,
    });
  } catch (err) {
    console.error('GET /concussions/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concussions
router.post('/', requireAuth, async (req, res) => {
  const {
    athlete_id, injury_date, mechanism, loss_of_consciousness,
    loc_duration_seconds, physician_name, notes, injury_id,
  } = req.body;

  if (!athlete_id || !injury_date) {
    return res.status(400).json({ error: 'athlete_id and injury_date are required.' });
  }

  try {
    const { rows: ath } = await query(
      `SELECT id FROM athletes WHERE id = $1 AND school_id = $2`,
      [athlete_id, req.schoolId]
    );
    if (!ath[0]) return res.status(400).json({ error: 'Athlete not found.' });

    const { rows } = await query(
      `INSERT INTO concussion_cases
         (athlete_id, school_id, opened_by, injury_date, mechanism, loss_of_consciousness,
          loc_duration_seconds, physician_name, notes, injury_id, status, current_step)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 1)
       RETURNING *`,
      [athlete_id, req.schoolId, req.userId, injury_date,
       mechanism || null, loss_of_consciousness ?? null, loc_duration_seconds ?? null,
       physician_name || null, notes || null, injury_id || null]
    );

    const { rows: full } = await query(
      `SELECT cc.*, a.name AS athlete_name, a.sport AS athlete_sport
       FROM concussion_cases cc LEFT JOIN athletes a ON a.id = cc.athlete_id WHERE cc.id = $1`,
      [rows[0].id]
    );
    const { athlete_name, athlete_sport, ...c } = full[0];
    res.status(201).json({ ...c, athlete_name, athlete_sport });
  } catch (err) {
    console.error('POST /concussions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concussions/:id
router.put('/:id', requireAuth, async (req, res) => {
  const {
    mechanism, loss_of_consciousness, loc_duration_seconds,
    physician_name, notes, current_step, status, physician_cleared_at,
  } = req.body;

  try {
    const setClauses = [];
    const params = [];
    let p = 1;

    if (mechanism             !== undefined) { setClauses.push(`mechanism = $${p++}`);             params.push(mechanism || null); }
    if (loss_of_consciousness !== undefined) { setClauses.push(`loss_of_consciousness = $${p++}`); params.push(loss_of_consciousness); }
    if (loc_duration_seconds  !== undefined) { setClauses.push(`loc_duration_seconds = $${p++}`);  params.push(loc_duration_seconds); }
    if (physician_name        !== undefined) { setClauses.push(`physician_name = $${p++}`);        params.push(physician_name || null); }
    if (notes                 !== undefined) { setClauses.push(`notes = $${p++}`);                 params.push(notes || null); }
    if (current_step          !== undefined) { setClauses.push(`current_step = $${p++}`);          params.push(current_step); }
    if (status                !== undefined) { setClauses.push(`status = $${p++}`);                params.push(status); }
    if (physician_cleared_at  !== undefined) { setClauses.push(`physician_cleared_at = $${p++}`);  params.push(physician_cleared_at); }
    if (status === 'cleared')                { setClauses.push(`cleared_at = $${p++}`);            params.push(new Date().toISOString()); }

    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id, req.schoolId);

    const { rows } = await query(
      `UPDATE concussion_cases SET ${setClauses.join(', ')}
       WHERE id = $${p++} AND school_id = $${p}
       RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Concussion case not found.' });

    const { rows: full } = await query(
      `SELECT cc.*, a.name AS athlete_name, a.sport AS athlete_sport
       FROM concussion_cases cc LEFT JOIN athletes a ON a.id = cc.athlete_id WHERE cc.id = $1`,
      [rows[0].id]
    );
    const { athlete_name, athlete_sport, ...c } = full[0];
    res.json({ ...c, athlete_name, athlete_sport });
  } catch (err) {
    console.error('PUT /concussions/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/concussions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query(
      `DELETE FROM concussion_cases WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /concussions/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concussions/:id/assessments
router.get('/:id/assessments', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM concussion_assessments
       WHERE case_id = $1 AND school_id = $2
       ORDER BY assessed_at DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /concussions/:id/assessments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concussions/:id/assessments
router.post('/:id/assessments', requireAuth, async (req, res) => {
  try {
    const {
      assessment_type, is_baseline,
      bess_firm_double, bess_firm_single, bess_firm_tandem,
      bess_foam_double, bess_foam_single, bess_foam_tandem,
      sleep_quality, notes, submitted_by_athlete,
    } = req.body;

    const symptoms = pickSymptoms(req.body);

    const baseFields = [
      'case_id', 'school_id', 'assessed_by', 'assessment_type', 'is_baseline',
      'bess_firm_double', 'bess_firm_single', 'bess_firm_tandem',
      'bess_foam_double', 'bess_foam_single', 'bess_foam_tandem',
      'sleep_quality', 'notes', 'submitted_by_athlete',
    ];
    const baseValues = [
      req.params.id, req.schoolId, req.userId,
      assessment_type || null, is_baseline ?? false,
      bess_firm_double ?? null, bess_firm_single ?? null, bess_firm_tandem ?? null,
      bess_foam_double ?? null, bess_foam_single ?? null, bess_foam_tandem ?? null,
      sleep_quality ?? null, notes || null, submitted_by_athlete ?? false,
    ];

    const symFields = Object.keys(symptoms);
    const allFields = [...baseFields, ...symFields];
    const allValues = [...baseValues, ...Object.values(symptoms)];
    const placeholders = allValues.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await query(
      `INSERT INTO concussion_assessments (${allFields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      allValues
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /concussions/:id/assessments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concussions/:id/checkins
router.get('/:id/checkins', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM concussion_checkins
       WHERE case_id = $1 AND school_id = $2
       ORDER BY checkin_date DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /concussions/:id/checkins error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concussions/:id/links
router.post('/:id/links', requireAuth, async (req, res) => {
  const { link_type, recipient_name, recipient_email } = req.body;

  if (!link_type || !['athlete', 'parent'].includes(link_type)) {
    return res.status(400).json({ error: "link_type must be 'athlete' or 'parent'." });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { rows } = await query(
      `INSERT INTO concussion_links
         (case_id, school_id, created_by, token, link_type, recipient_name, recipient_email, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING *`,
      [req.params.id, req.schoolId, req.userId, token, link_type,
       recipient_name || null, recipient_email || null, expiresAt]
    );

    const origin = req.headers.origin || process.env.APP_URL || 'https://fieldsidehealth.com';
    res.status(201).json({ ...rows[0], url: `${origin}/concussion-checkin/${token}` });
  } catch (err) {
    console.error('POST /concussions/:id/links error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── RTP Protocols router (registered at /api/rtp-protocols) ──────────

const rtpRouter = express.Router();
rtpRouter.use(requireAuth);

// GET /api/rtp-protocols
rtpRouter.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM rtp_protocols WHERE school_id = $1 ORDER BY step_number ASC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /rtp-protocols error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rtp-protocols/:stepId
rtpRouter.put('/:stepId', async (req, res) => {
  const { step_name, description } = req.body;

  try {
    const setClauses = [];
    const params = [];
    let p = 1;

    if (step_name   !== undefined) { setClauses.push(`step_name = $${p++}`);   params.push(step_name); }
    if (description !== undefined) { setClauses.push(`description = $${p++}`); params.push(description); }

    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.stepId, req.schoolId);

    const { rows } = await query(
      `UPDATE rtp_protocols SET ${setClauses.join(', ')}
       WHERE id = $${p++} AND school_id = $${p}
       RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Protocol step not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /rtp-protocols/:stepId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { rtpRouter };
