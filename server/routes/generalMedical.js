import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logActivity } from '../middleware/logActivity.js';

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ['heat_illness', 'illness', 'skin_condition', 'cardiac', 'diabetes', 'asthma', 'other'];
const DISPOSITIONS = ['returned_to_activity', 'sent_home', 'transported_to_er', 'parent_contacted', 'physician_referral'];

// Base SELECT used by GET /, GET /:id, and GET /athlete/:athleteId
const GEN_MED_SELECT = `
  SELECT gm.*, a.name AS athlete_name, a.sport AS athlete_sport
  FROM general_medical gm
  LEFT JOIN athletes a ON a.id = gm.athlete_id
`;

// GET /api/general-medical
// ?category=string      → filter by category
// ?date_from / date_to  → filter by event_date range
router.get('/', async (req, res) => {
  try {
    const { category, date_from, date_to } = req.query;

    const conditions = ['gm.school_id = $1'];
    const params = [req.schoolId];
    let p = 2;

    if (category) {
      conditions.push(`gm.category = $${p++}`);
      params.push(category);
    }
    if (date_from) {
      conditions.push(`gm.event_date >= $${p++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`gm.event_date <= $${p++}`);
      params.push(date_to);
    }
    if (req.role === 'coach' && req.coachSport) {
      conditions.push(`a.sport = $${p++}`);
      params.push(req.coachSport);
    }

    const { rows } = await query(
      `${GEN_MED_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY gm.event_date DESC, gm.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /general-medical error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/general-medical/athlete/:athleteId
router.get('/athlete/:athleteId', async (req, res) => {
  try {
    const { rows } = await query(
      `${GEN_MED_SELECT} WHERE gm.athlete_id = $1 AND gm.school_id = $2 ORDER BY gm.event_date DESC, gm.created_at DESC`,
      [req.params.athleteId, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /general-medical/athlete/:athleteId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/general-medical/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `${GEN_MED_SELECT} WHERE gm.id = $1 AND gm.school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'General medical event not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /general-medical/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/general-medical
router.post('/', async (req, res) => {
  const {
    athlete_id, event_date, event_time, category, subcategory,
    chief_complaint, treatment_administered, disposition,
    follow_up_required, notes,
  } = req.body;

  if (!athlete_id || !category || !chief_complaint?.trim() || !disposition) {
    return res.status(400).json({ error: 'athlete_id, category, chief_complaint, and disposition are required.' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!DISPOSITIONS.includes(disposition)) {
    return res.status(400).json({ error: 'Invalid disposition.' });
  }

  try {
    // Verify athlete belongs to this school
    const { rows: athRows } = await query(
      `SELECT id FROM athletes WHERE id = $1 AND school_id = $2`,
      [athlete_id, req.schoolId]
    );
    if (!athRows[0]) return res.status(400).json({ error: 'Athlete not found.' });

    const { rows } = await query(
      `INSERT INTO general_medical
         (school_id, athlete_id, logged_by, event_date, event_time, category, subcategory,
          chief_complaint, treatment_administered, disposition, follow_up_required, notes)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.schoolId, athlete_id, req.userId, event_date || null, event_time || null,
        category, subcategory || null, chief_complaint.trim(), treatment_administered || null,
        disposition, follow_up_required ?? false, notes || null,
      ]
    );

    const { rows: full } = await query(`${GEN_MED_SELECT} WHERE gm.id = $1`, [rows[0].id]);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'general_medical.created', entityType: 'general_medical', entityId: rows[0].id });
    res.status(201).json(full[0]);
  } catch (err) {
    console.error('POST /general-medical error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/general-medical/:id
router.put('/:id', async (req, res) => {
  const {
    event_date, event_time, category, subcategory,
    chief_complaint, treatment_administered, disposition,
    follow_up_required, notes,
  } = req.body;

  if (!event_date || !category || !chief_complaint?.trim() || !disposition) {
    return res.status(400).json({ error: 'event_date, category, chief_complaint, and disposition are required.' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!DISPOSITIONS.includes(disposition)) {
    return res.status(400).json({ error: 'Invalid disposition.' });
  }

  try {
    const { rows } = await query(
      `UPDATE general_medical
       SET event_date = $1, event_time = $2, category = $3, subcategory = $4,
           chief_complaint = $5, treatment_administered = $6, disposition = $7,
           follow_up_required = $8, notes = $9
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [
        event_date, event_time || null, category, subcategory || null,
        chief_complaint.trim(), treatment_administered || null, disposition,
        follow_up_required ?? false, notes || null,
        req.params.id, req.schoolId,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'General medical event not found.' });

    const { rows: full } = await query(`${GEN_MED_SELECT} WHERE gm.id = $1`, [rows[0].id]);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'general_medical.updated', entityType: 'general_medical', entityId: rows[0].id });
    res.json(full[0]);
  } catch (err) {
    console.error('PUT /general-medical/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/general-medical/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM general_medical WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'general_medical.deleted', entityType: 'general_medical', entityId: req.params.id });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /general-medical/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
