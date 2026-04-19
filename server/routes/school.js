import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadFile, deleteFile } from '../lib/storage.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/school/branding
router.get('/branding', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, primary_color, logo_url, cost_per_visit FROM schools WHERE id = $1`,
      [req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /school/branding error:', err.message);
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

export default router;
