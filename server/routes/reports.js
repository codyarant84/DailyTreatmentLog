import express from 'express';
import { Resend } from 'resend';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logActivity } from '../middleware/logActivity.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const router = express.Router();
router.use(requireAuth);

router.post('/generate', async (req, res) => {
  const {
    athleteIds, teamId, dateFrom, dateTo,
    sections, recipientName, recipientRole, notes,
  } = req.body;

  if (!sections?.length) {
    return res.status(400).json({ error: 'At least one section is required.' });
  }
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'dateFrom and dateTo are required.' });
  }

  try {
    // School name + AT email
    const { rows: metaRows } = await query(
      `SELECT s.name AS school_name, p.email AS at_email
       FROM schools s JOIN profiles p ON p.school_id = s.id
       WHERE s.id = $1 AND p.id = $2`,
      [req.schoolId, req.userId]
    );
    const meta = metaRows[0] ?? {};

    // Resolve athlete IDs
    let resolvedIds = Array.isArray(athleteIds) ? athleteIds.filter(Boolean) : [];
    if (teamId && resolvedIds.length === 0) {
      const { rows: ta } = await query(
        `SELECT athlete_id FROM team_athletes WHERE team_id = $1`,
        [teamId]
      );
      resolvedIds = ta.map(r => r.athlete_id);
    }
    if (resolvedIds.length === 0) {
      return res.status(400).json({ error: 'No athletes selected.' });
    }

    // Fetch athlete profiles
    const { rows: athletes } = await query(
      `SELECT id, name, sport, grade, date_of_birth,
              emergency_contact_name, emergency_contact_phone
       FROM athletes WHERE id = ANY($1) AND school_id = $2 ORDER BY name`,
      [resolvedIds, req.schoolId]
    );
    if (athletes.length === 0) {
      return res.status(400).json({ error: 'No matching athletes found.' });
    }

    const athleteNames = athletes.map(a => a.name);
    const needsInjuries = sections.some(s => ['injury_summary', 'rtp_status', 'soap_notes'].includes(s));

    // Parallel data fetches
    const [injuriesRes, treatmentsRes, concussionsRes] = await Promise.all([
      needsInjuries
        ? query(
            `SELECT * FROM injuries
             WHERE athlete_id = ANY($1) AND school_id = $2
             AND (is_active = true OR injury_date BETWEEN $3 AND $4)
             ORDER BY injury_date DESC`,
            [resolvedIds, req.schoolId, dateFrom, dateTo]
          )
        : { rows: [] },
      sections.includes('treatment_log')
        ? query(
            `SELECT * FROM treatments
             WHERE athlete_name = ANY($1) AND school_id = $2
             AND date BETWEEN $3 AND $4
             ORDER BY date DESC`,
            [athleteNames, req.schoolId, dateFrom, dateTo]
          )
        : { rows: [] },
      sections.includes('concussion_history')
        ? query(
            `SELECT * FROM concussion_cases
             WHERE athlete_id = ANY($1) AND school_id = $2
             AND (status = 'active' OR DATE(opened_at) BETWEEN $3 AND $4)
             ORDER BY opened_at DESC`,
            [resolvedIds, req.schoolId, dateFrom, dateTo]
          )
        : { rows: [] },
    ]);

    // SOAP notes (requires injury IDs)
    let soapRows = [];
    if (sections.includes('soap_notes') && injuriesRes.rows.length > 0) {
      const injuryIds = injuriesRes.rows.map(i => i.id);
      const { rows } = await query(
        `SELECT * FROM soap_notes
         WHERE injury_id = ANY($1) AND school_id = $2
         AND DATE(authored_at) BETWEEN $3 AND $4
         ORDER BY authored_at DESC`,
        [injuryIds, req.schoolId, dateFrom, dateTo]
      );
      soapRows = rows;
    }

    // Build per-athlete payload
    const athleteData = athletes.map(ath => {
      const injuries   = injuriesRes.rows.filter(i => i.athlete_id === ath.id);
      const treatments = treatmentsRes.rows.filter(t => t.athlete_name === ath.name);
      const concussions = concussionsRes.rows.filter(c => c.athlete_id === ath.id);
      const injuryIds  = injuries.map(i => i.id);
      const soap_notes = soapRows.filter(s => injuryIds.includes(s.injury_id));
      return { profile: ath, injuries, treatments, concussions, soap_notes };
    });

    res.json({
      school_name:    meta.school_name    ?? '',
      at_email:       meta.at_email       ?? '',
      generated_at:   new Date().toISOString(),
      date_from:      dateFrom,
      date_to:        dateTo,
      recipient_name: recipientName ?? null,
      recipient_role: recipientRole ?? null,
      notes:          notes         ?? null,
      sections,
      athletes:       athleteData,
    });
  } catch (err) {
    console.error('POST /reports/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/auto-settings
router.get('/auto-settings', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT enabled, to_char(send_time, 'HH24:MI') AS send_time, recipients
       FROM auto_report_settings WHERE school_id = $1`,
      [req.schoolId]
    );
    res.json(rows[0] ?? { enabled: false, send_time: '17:00', recipients: [] });
  } catch (err) {
    console.error('GET /reports/auto-settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reports/auto-settings
router.put('/auto-settings', async (req, res) => {
  const { enabled, send_time, recipients } = req.body;
  if (!Array.isArray(recipients)) return res.status(400).json({ error: 'recipients must be an array.' });
  if (recipients.length > 5) return res.status(400).json({ error: 'Maximum 5 recipients allowed.' });

  try {
    const { rows } = await query(
      `INSERT INTO auto_report_settings (school_id, enabled, send_time, recipients, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (school_id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           send_time = EXCLUDED.send_time,
           recipients = EXCLUDED.recipients,
           updated_at = now()
       RETURNING enabled, to_char(send_time, 'HH24:MI') AS send_time, recipients`,
      [req.schoolId, enabled ?? false, send_time || '17:00', recipients]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /reports/auto-settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/send-daily
router.post('/send-daily', async (req, res) => {
  try {
    const { rows: settingsRows } = await query(
      `SELECT recipients FROM auto_report_settings WHERE school_id = $1`,
      [req.schoolId]
    );
    const recipients = req.body.recipients ?? settingsRows[0]?.recipients ?? [];
    if (!recipients.length) return res.status(400).json({ error: 'No recipients configured. Add recipients in the Auto Report settings.' });

    const { rows: metaRows } = await query(
      `SELECT s.name AS school_name, p.email AS at_email
       FROM schools s JOIN profiles p ON p.school_id = s.id
       WHERE s.id = $1 AND p.id = $2`,
      [req.schoolId, req.userId]
    );
    const { school_name = '', at_email = '' } = metaRows[0] ?? {};

    const { rows: injuries } = await query(
      `SELECT i.body_part, i.injury_type, i.rtp_status, a.name AS athlete_name, a.sport AS athlete_sport
       FROM injuries i LEFT JOIN athletes a ON a.id = i.athlete_id
       WHERE i.school_id = $1 AND i.is_active = true
       ORDER BY a.name`,
      [req.schoolId]
    );

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const injuryRows = injuries.map((inj) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${inj.athlete_name ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${inj.athlete_sport ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${inj.body_part}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${inj.injury_type}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${inj.rtp_status}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:4px;color:#111">Daily Injury Report</h2>
        <p style="color:#777;margin-top:0;font-size:14px">${today} · ${school_name}</p>
        ${injuries.length === 0
          ? '<p style="color:#555;margin-top:16px">No active injuries at this time.</p>'
          : `<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
               <thead>
                 <tr style="background:#f3f4f6">
                   <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Athlete</th>
                   <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Sport</th>
                   <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Body Part</th>
                   <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Diagnosis</th>
                   <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Status</th>
                 </tr>
               </thead>
               <tbody>${injuryRows}</tbody>
             </table>`}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#aaa;font-size:12px">Sent by ${at_email} via Fieldside Health</p>
      </div>`;

    if (!resend) {
      console.warn('RESEND_API_KEY not set — skipping email send');
      return res.json({ sent: false, message: 'Email service not configured.', injuries: injuries.length });
    }

    await resend.emails.send({
      from: 'Fieldside Health <reports@fieldsidehealth.com>',
      to: recipients,
      subject: `Daily Injury Report — ${school_name} — ${today}`,
      html,
    });

    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'report.generated', metadata: { recipients: recipients.length, injuries: injuries.length } });
    res.json({ sent: true, recipients: recipients.length, injuries: injuries.length });
  } catch (err) {
    console.error('POST /reports/send-daily error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
