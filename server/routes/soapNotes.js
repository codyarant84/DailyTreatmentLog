import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/soap-notes/injury/:injuryId
router.get('/injury/:injuryId', async (req, res) => {
  try {
    const { rows: notes } = await query(
      `SELECT * FROM soap_notes
       WHERE injury_id = $1 AND school_id = $2
       ORDER BY authored_at DESC`,
      [req.params.injuryId, req.schoolId]
    );

    // Batch-fetch author emails from profiles
    const authorIds = [...new Set(notes.map((n) => n.authored_by).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length > 0) {
      const { rows: profiles } = await query(
        `SELECT id, email FROM profiles WHERE id = ANY($1)`,
        [authorIds]
      );
      authorMap = Object.fromEntries(profiles.map((p) => [p.id, p.email]));
    }

    res.json(notes.map((note) => ({ ...note, author_name: authorMap[note.authored_by] ?? null })));
  } catch (err) {
    console.error('GET /soap-notes/injury/:injuryId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/soap-notes
router.post('/', async (req, res) => {
  try {
    const {
      injury_id, athlete_id, note_type,
      chief_complaint, mechanism_detail, pain_scale, symptom_description, relevant_history,
      observation, palpation, range_of_motion, special_tests, strength_testing,
      assessment, severity, differential, treatment_plan, referral,
      rtp_timeline, restrictions, followup,
    } = req.body;

    if (!injury_id || !athlete_id) {
      return res.status(400).json({ error: 'injury_id and athlete_id are required.' });
    }

    const [insertResult, profileResult] = await Promise.all([
      query(
        `INSERT INTO soap_notes (
           injury_id, athlete_id, school_id, authored_by,
           chief_complaint, mechanism_detail, pain_scale, symptom_description, relevant_history,
           observation, palpation, range_of_motion, special_tests, strength_testing,
           assessment, severity, differential, treatment_plan, referral,
           rtp_timeline, restrictions, followup, note_type, version
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19,
           $20, $21, $22, $23, 1
         ) RETURNING *`,
        [
          injury_id, athlete_id, req.schoolId, req.userId,
          chief_complaint || null, mechanism_detail || null, pain_scale ?? null,
          symptom_description || null, relevant_history || null,
          observation || null, palpation || null, range_of_motion || null,
          special_tests || null, strength_testing || null,
          assessment || null, severity || null, differential || null,
          treatment_plan || null, referral || null,
          rtp_timeline || null, restrictions || null, followup || null,
          note_type || 'simple',
        ]
      ),
      query(`SELECT email FROM profiles WHERE id = $1`, [req.userId]),
    ]);

    const author_name = profileResult.rows[0]?.email ?? null;
    res.status(201).json({ ...insertResult.rows[0], author_name });
  } catch (err) {
    console.error('POST /soap-notes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/soap-notes/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      note_type,
      chief_complaint, mechanism_detail, pain_scale, symptom_description, relevant_history,
      observation, palpation, range_of_motion, special_tests, strength_testing,
      assessment, severity, differential, treatment_plan, referral,
      rtp_timeline, restrictions, followup,
    } = req.body;

    // Fetch current version to increment
    const { rows: existing } = await query(
      `SELECT version, note_type FROM soap_notes WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'SOAP note not found.' });

    const { rows } = await query(
      `UPDATE soap_notes SET
         chief_complaint = $1, mechanism_detail = $2, pain_scale = $3,
         symptom_description = $4, relevant_history = $5,
         observation = $6, palpation = $7, range_of_motion = $8,
         special_tests = $9, strength_testing = $10,
         assessment = $11, severity = $12, differential = $13,
         treatment_plan = $14, referral = $15, rtp_timeline = $16,
         restrictions = $17, followup = $18,
         note_type = $19, version = $20, updated_at = NOW()
       WHERE id = $21 AND school_id = $22
       RETURNING *`,
      [
        chief_complaint || null, mechanism_detail || null, pain_scale ?? null,
        symptom_description || null, relevant_history || null,
        observation || null, palpation || null, range_of_motion || null,
        special_tests || null, strength_testing || null,
        assessment || null, severity || null, differential || null,
        treatment_plan || null, referral || null, rtp_timeline || null,
        restrictions || null, followup || null,
        note_type || existing[0].note_type || 'simple',
        (existing[0].version ?? 1) + 1,
        req.params.id, req.schoolId,
      ]
    );

    const { rows: profile } = await query(`SELECT email FROM profiles WHERE id = $1`, [rows[0].authored_by]);
    res.json({ ...rows[0], author_name: profile[0]?.email ?? null });
  } catch (err) {
    console.error('PUT /soap-notes/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/soap-notes/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM soap_notes WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /soap-notes/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
