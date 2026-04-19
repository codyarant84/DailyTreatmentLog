import express from 'express';
import { query } from '../lib/db.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { uploadFile } from '../lib/storage.js';

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/schools — all schools with their users and pending invites
router.get('/schools', async (req, res) => {
  try {
    const [schoolsResult, profilesResult, invitesResult] = await Promise.all([
      query(`SELECT id, name FROM schools ORDER BY name`),
      query(`SELECT id, school_id, is_admin, role, email, created_at FROM profiles`),
      query(`SELECT id, email, school_id, role, created_at FROM invites WHERE used = false`),
    ]);

    const schools = schoolsResult.rows.map((school) => {
      const users = profilesResult.rows
        .filter((p) => p.school_id === school.id)
        .map((p) => ({
          id:         p.id,
          email:      p.email ?? '(unknown)',
          created_at: p.created_at ?? null,
          is_admin:   p.is_admin,
          role:       p.role ?? 'trainer',
        }));

      const pending_invites = invitesResult.rows.filter((inv) => inv.school_id === school.id);

      return { ...school, users, pending_invites };
    });

    res.json(schools);
  } catch (err) {
    console.error('GET /admin/schools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/schools/:id
router.delete('/schools/:id', async (req, res) => {
  const { id } = req.params;
  try {
    for (const table of ['daily_treatments', 'treatments', 'athletes', 'exercises', 'invites', 'profiles']) {
      await query(`DELETE FROM ${table} WHERE school_id = $1`, [id]);
    }
    await query(`DELETE FROM schools WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/schools/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — removes the user's profile row
// OLD: also called supabase.auth.admin.deleteUser(id) — removed, no Supabase auth
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM profiles WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/schools — create a new school (super_admin only)
router.post('/schools', async (req, res) => {
  if (req.role !== 'super_admin') {
    return res.status(403).json({ error: 'super_admin role required' });
  }
  const { name, primary_color = '#cc0000', cost_per_visit = 50 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await query(
      `INSERT INTO schools (name, primary_color, cost_per_visit) VALUES ($1, $2, $3) RETURNING id, name`,
      [name.trim(), primary_color, cost_per_visit]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /admin/schools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/schools/:id/logo — upload logo for any school (super_admin only)
router.post('/schools/:id/logo', async (req, res) => {
  if (req.role !== 'super_admin') {
    return res.status(403).json({ error: 'super_admin role required' });
  }
  const { base64, mime_type } = req.body;
  if (!base64 || !mime_type) return res.status(400).json({ error: 'base64 and mime_type are required' });

  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(mime_type)) {
    return res.status(400).json({ error: 'Unsupported image type. Use PNG, JPG, WebP, or SVG.' });
  }

  const ext = mime_type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const filename = `${req.params.id}/logo.${ext}`;

  try {
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const logo_url = await uploadFile(buffer, filename, mime_type);
    await query(`UPDATE schools SET logo_url = $1 WHERE id = $2`, [logo_url, req.params.id]);
    res.json({ logo_url });
  } catch (err) {
    console.error('POST /admin/schools/:id/logo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/schools/:id/branding (super_admin only)
router.put('/schools/:id/branding', async (req, res) => {
  if (req.role !== 'super_admin') {
    return res.status(403).json({ error: 'super_admin role required' });
  }
  const { primary_color, cost_per_visit } = req.body;
  if (!primary_color || !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
    return res.status(400).json({ error: 'primary_color must be a valid hex color' });
  }

  try {
    const params = [primary_color, req.params.id];
    let sql = `UPDATE schools SET primary_color = $1`;

    if (cost_per_visit !== undefined) {
      const rate = Number(cost_per_visit);
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ error: 'cost_per_visit must be a positive number' });
      }
      sql = `UPDATE schools SET primary_color = $1, cost_per_visit = $2 WHERE id = $3 RETURNING primary_color, logo_url, cost_per_visit`;
      params.splice(1, 0, rate);
    } else {
      sql = `UPDATE schools SET primary_color = $1 WHERE id = $2 RETURNING primary_color, logo_url, cost_per_visit`;
    }

    const { rows } = await query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /admin/schools/:id/branding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/invite — creates invite record and returns shareable link
router.post('/invite', async (req, res) => {
  const { school_id, role = 'trainer' } = req.body;
  if (!school_id) return res.status(400).json({ error: 'school_id is required' });

  const appOrigin = process.env.APP_URL || 'https://fieldsidehealth.com';

  try {
    const { rows } = await query(
      `INSERT INTO invites (email, school_id, role) VALUES (NULL, $1, $2) RETURNING token`,
      [school_id, role]
    );
    res.status(201).json({ invite_url: `${appOrigin}/invite/${rows[0].token}` });
  } catch (err) {
    console.error('POST /admin/invite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });
  if (role === 'super_admin') return res.status(403).json({ error: 'Cannot assign super_admin role' });

  try {
    await query(`UPDATE profiles SET role = $1 WHERE id = $2`, [role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /admin/users/:id/role error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/invites/:id
router.delete('/invites/:id', async (req, res) => {
  try {
    await query(`DELETE FROM invites WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /admin/invites/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
