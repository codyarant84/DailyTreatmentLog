import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

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

export default router;
