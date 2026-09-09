import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logActivity } from '../middleware/logActivity.js';
import { uploadFile, deleteFile } from '../lib/storage.js';

const router = express.Router();
router.use(requireAuth);

const ORG_TYPES = ['high_school', 'college', 'semi_pro', 'club'];
const RETENTION_YEARS = [1, 2, 3, 5, 7];

// GET /api/school/branding
router.get('/branding', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, primary_color, logo_url, cost_per_visit, student_email_domain,
              organization_type, max_years, archive_retention_years
       FROM schools WHERE id = $1`,
      [req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /school/branding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/school/settings — organization type, max years (college), archive retention
router.put('/settings', async (req, res) => {
  const { organization_type, max_years, archive_retention_years } = req.body;

  if (organization_type !== undefined && !ORG_TYPES.includes(organization_type)) {
    return res.status(400).json({ error: `organization_type must be one of: ${ORG_TYPES.join(', ')}` });
  }

  let maxYears;
  if (max_years !== undefined) {
    maxYears = Number(max_years);
    if (!Number.isInteger(maxYears) || maxYears < 4 || maxYears > 6) {
      return res.status(400).json({ error: 'max_years must be an integer between 4 and 6.' });
    }
  }

  let retentionYears;
  if (archive_retention_years !== undefined) {
    retentionYears = archive_retention_years === null ? null : Number(archive_retention_years);
    if (retentionYears !== null && !RETENTION_YEARS.includes(retentionYears)) {
      return res.status(400).json({ error: `archive_retention_years must be one of: ${RETENTION_YEARS.join(', ')}, or null for Forever.` });
    }
  }

  const fields = [];
  const params = [];
  let p = 1;
  if (organization_type !== undefined)       { fields.push(`organization_type = $${p++}`);       params.push(organization_type); }
  if (maxYears !== undefined)                { fields.push(`max_years = $${p++}`);                params.push(maxYears); }
  if (archive_retention_years !== undefined) { fields.push(`archive_retention_years = $${p++}`);  params.push(retentionYears); }

  if (fields.length === 0) return res.status(400).json({ error: 'No settings provided.' });
  params.push(req.schoolId);

  try {
    const { rows } = await query(
      `UPDATE schools SET ${fields.join(', ')} WHERE id = $${p}
       RETURNING organization_type, max_years, archive_retention_years`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /school/settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/school/advance-year — advance all athletes one grade/year level
router.post('/advance-year', async (req, res) => {
  try {
    const { rows: schoolRows } = await query('SELECT organization_type FROM schools WHERE id = $1', [req.schoolId]);
    if (!schoolRows[0]) return res.status(404).json({ error: 'School not found' });
    const orgType = schoolRows[0].organization_type ?? 'high_school';

    if (orgType === 'semi_pro' || orgType === 'club') {
      return res.status(400).json({ error: 'Year advancement is not applicable for this organization type.' });
    }

    if (orgType === 'high_school') {
      const { rows: advanced } = await query(
        `UPDATE athletes SET grade = CASE grade
            WHEN '6th'  THEN '7th'
            WHEN '7th'  THEN '8th'
            WHEN '8th'  THEN '9th'
            WHEN '9th'  THEN '10th'
            WHEN '10th' THEN '11th'
            WHEN '11th' THEN '12th'
          END
         WHERE school_id = $1 AND (archived = false OR archived IS NULL)
           AND grade IN ('6th', '7th', '8th', '9th', '10th', '11th')
         RETURNING id`,
        [req.schoolId]
      );

      // Graduates auto-archive unless eligibility_override is set (e.g. a
      // medical redshirt held back a year) — mirrors the college override.
      const { rows: archived } = await query(
        `UPDATE athletes
         SET archived = true, archived_reason = 'graduated', archived_at = now()
         WHERE school_id = $1 AND (archived = false OR archived IS NULL)
           AND grade = '12th' AND (eligibility_override = false OR eligibility_override IS NULL)
         RETURNING id`,
        [req.schoolId]
      );

      logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'school.advance_year', metadata: { advanced: advanced.length, archived: archived.length } });
      return res.json({ advanced: advanced.length, archived: archived.length });
    }

    // College: advance up to "Year 6+", then hold there. Never auto-archive —
    // the AT manually archives athletes once they've exhausted eligibility.
    const { rows: advanced } = await query(
      `UPDATE athletes SET grade = CASE grade
          WHEN 'Year 1' THEN 'Year 2'
          WHEN 'Year 2' THEN 'Year 3'
          WHEN 'Year 3' THEN 'Year 4'
          WHEN 'Year 4' THEN 'Year 5'
          WHEN 'Year 5' THEN 'Year 6+'
        END
       WHERE school_id = $1 AND (archived = false OR archived IS NULL)
         AND grade IN ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5')
       RETURNING id`,
      [req.schoolId]
    );

    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'school.advance_year', metadata: { advanced: advanced.length, archived: 0 } });
    res.json({ advanced: advanced.length, archived: 0 });
  } catch (err) {
    console.error('POST /school/advance-year error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/school/archive-candidates — athletes past the retention window
router.get('/archive-candidates', async (req, res) => {
  try {
    const { rows: schoolRows } = await query('SELECT archive_retention_years FROM schools WHERE id = $1', [req.schoolId]);
    if (!schoolRows[0]) return res.status(404).json({ error: 'School not found' });
    const retentionYears = schoolRows[0].archive_retention_years;

    if (retentionYears === null) {
      return res.json({ count: 0, retention_years: null });
    }

    const { rows } = await query(
      `SELECT COUNT(*)::int AS cnt FROM athletes
       WHERE school_id = $1 AND archived = true AND archived_at IS NOT NULL
         AND archived_at < now() - ($2 || ' years')::interval`,
      [req.schoolId, retentionYears]
    );
    res.json({ count: rows[0].cnt, retention_years: retentionYears });
  } catch (err) {
    console.error('GET /school/archive-candidates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/school/branding
router.put('/branding', async (req, res) => {
  const { primary_color, cost_per_visit } = req.body;
  if (!primary_color || !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
    return res.status(400).json({ error: 'primary_color must be a valid hex color (e.g. #1d6fa5)' });
  }

  const params = [primary_color, req.schoolId];
  let sql = `UPDATE schools SET primary_color = $1`;

  if (cost_per_visit !== undefined) {
    const rate = Number(cost_per_visit);
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ error: 'cost_per_visit must be a positive number.' });
    }
    sql += `, cost_per_visit = $3`;
    params.splice(1, 0, rate); // insert before schoolId
    // reorder: primary_color=$1, cost_per_visit=$2, school_id=$3
    params[0] = primary_color;
    params[1] = rate;
    params[2] = req.schoolId;
    sql = `UPDATE schools SET primary_color = $1, cost_per_visit = $2 WHERE id = $3 RETURNING primary_color, logo_url, cost_per_visit`;
  } else {
    sql = `UPDATE schools SET primary_color = $1 WHERE id = $2 RETURNING primary_color, logo_url, cost_per_visit`;
  }

  try {
    const { rows } = await query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /school/branding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/school/logo
router.post('/logo', async (req, res) => {
  const { base64, mime_type } = req.body;
  if (!base64 || !mime_type) {
    return res.status(400).json({ error: 'base64 and mime_type are required' });
  }

  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(mime_type)) {
    return res.status(400).json({ error: 'Unsupported image type. Use PNG, JPG, WebP, or SVG.' });
  }

  const ext = mime_type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const filename = `${req.schoolId}/logo.${ext}`;

  try {
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const logo_url = await uploadFile(buffer, filename, mime_type);
    await query(`UPDATE schools SET logo_url = $1 WHERE id = $2`, [logo_url, req.schoolId]);
    res.json({ logo_url });
  } catch (err) {
    console.error('POST /school/logo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/school/logo
router.delete('/logo', async (req, res) => {
  try {
    const exts = ['png', 'jpg', 'webp', 'svg'];
    await Promise.allSettled(
      exts.map((ext) => deleteFile(`${req.schoolId}/logo.${ext}`))
    );
    await query(`UPDATE schools SET logo_url = NULL WHERE id = $1`, [req.schoolId]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /school/logo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/school/portal-domain
router.put('/portal-domain', async (req, res) => {
  const { student_email_domain } = req.body;
  const domain = student_email_domain?.trim().toLowerCase() || null;

  try {
    const { rows } = await query(
      `UPDATE schools SET student_email_domain = $1 WHERE id = $2 RETURNING student_email_domain`,
      [domain, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /school/portal-domain error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/school/coaches
router.get('/coaches', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, role, sport FROM profiles
       WHERE school_id = $1 AND role = 'coach'
       ORDER BY email`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /school/coaches error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/school/staff — AT/admin profiles at this school (not coaches),
// used for e.g. controlled-substance witness selection.
router.get('/staff', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, role FROM profiles
       WHERE school_id = $1 AND role IN ('trainer', 'admin', 'super_admin')
       ORDER BY email`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /school/staff error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/school/coaches/:id/sport
router.put('/coaches/:id/sport', async (req, res) => {
  const { sport } = req.body;
  try {
    const { rows } = await query(
      `UPDATE profiles SET sport = $1
       WHERE id = $2 AND school_id = $3 AND role = 'coach'
       RETURNING id, email, role, sport`,
      [sport || null, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Coach not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /school/coaches/:id/sport error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
