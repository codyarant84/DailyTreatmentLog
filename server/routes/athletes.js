import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
const TABLE = 'athletes';

router.use(requireAuth);

// GET /api/athletes — full roster for the school, sorted by name
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at')
      .eq('school_id', req.schoolId)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes — create a single athlete
router.post('/', async (req, res) => {
  const { first_name, last_name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone } = req.body;

  if (!first_name?.trim()) return res.status(400).json({ error: 'First name is required.' });
  if (!last_name?.trim())  return res.status(400).json({ error: 'Last name is required.' });
  if (!sport?.trim())      return res.status(400).json({ error: 'Sport is required.' });
  if (!grade?.trim())      return res.status(400).json({ error: 'Grade is required.' });

  const name = `${first_name.trim()} ${last_name.trim()}`;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        school_id:               req.schoolId,
        name,
        sport:                   sport.trim(),
        grade:                   grade.trim(),
        date_of_birth:           date_of_birth || null,
        emergency_contact_name:  emergency_contact_name?.trim() || null,
        emergency_contact_phone: emergency_contact_phone?.trim() || null,
      })
      .select('id, name, sport, grade, date_of_birth, emergency_contact_name, emergency_contact_phone, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: `An athlete named "${name}" already exists.` });
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('POST /athletes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/athletes/import
// Body: { rows: [{ name, sport, grade, date_of_birth }] }
// Uses upsert with ignoreDuplicates so the DB unique constraint handles dedup atomically.
// Returns: { imported, skipped, total }
router.post('/import', async (req, res) => {
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided.' });
  }

  const MAX_ROWS = 500;
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ error: `Maximum ${MAX_ROWS} rows per import.` });
  }

  // Validate — every row must have a non-empty name
  const invalid = rows.filter((r) => !r.name?.trim());
  if (invalid.length > 0) {
    return res.status(400).json({
      error: `${invalid.length} row(s) are missing the athlete name field.`,
    });
  }

  try {
    const records = rows.map((r) => ({
      school_id:     req.schoolId,
      name:          r.name.trim(),
      sport:         r.sport?.trim()  || null,
      grade:         r.grade?.trim()  || null,
      date_of_birth: r.date_of_birth  || null,
    }));

    // upsert with ignoreDuplicates: true → INSERT ... ON CONFLICT DO NOTHING
    // Only the actually-inserted rows come back in `data`.
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(records, { onConflict: 'school_id,name', ignoreDuplicates: true })
      .select('id');

    if (error) throw error;

    const imported = data.length;
    const skipped  = records.length - imported;

    res.json({ imported, skipped, total: records.length });
  } catch (err) {
    console.error('POST /athletes/import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
