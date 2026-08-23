import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadToPath, deleteAtPath } from '../lib/storage.js';
import { logActivity } from '../middleware/logActivity.js';

const router = express.Router();
router.use(requireAuth);

const BOC_HOURS_REQUIRED = 50;
const BOC_PERIOD_YEARS = 2;

function requireSuperAdmin(req, res, next) {
  if (req.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  next();
}

function keyFromUrl(url) {
  return url?.split('.amazonaws.com/')[1] ?? null;
}

// ── Library ──────────────────────────────────────────────────────────

// GET /api/ceu/library
router.get('/library', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM ceu_library WHERE approved = true ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /ceu/library error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ceu/library/search?q=
router.get('/library/search', async (req, res) => {
  const q = (req.query.q ?? '').trim();
  if (!q) return res.json([]);
  try {
    const { rows } = await query(
      `SELECT * FROM ceu_library
       WHERE approved = true AND (title ILIKE $1 OR provider ILIKE $1)
       ORDER BY created_at DESC`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /ceu/library/search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ceu/library/pending (super_admin only)
router.get('/library/pending', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cl.*, p.email AS submitted_by_email
       FROM ceu_library cl
       LEFT JOIN profiles p ON p.id = cl.submitted_by
       WHERE cl.approved = false
       ORDER BY cl.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /ceu/library/pending error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ceu/library — submit a new CEU for approval
router.post('/library', async (req, res) => {
  const { title, provider, credit_hours, url, description, is_free, cost, expiration_date } = req.body;

  if (!title?.trim() || !provider?.trim() || !credit_hours || !url?.trim()) {
    return res.status(400).json({ error: 'title, provider, credit_hours, and url are required.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO ceu_library
         (title, provider, credit_hours, url, description, is_free, cost, expiration_date, submitted_by, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING *`,
      [
        title.trim(), provider.trim(), credit_hours, url.trim(), description || null,
        is_free ?? true, (is_free ?? true) ? null : (cost || null), expiration_date || null,
        req.userId,
      ]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'ceu.submitted', entityType: 'ceu_library', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /ceu/library error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ceu/library/:id/approve (super_admin only)
router.post('/library/:id/approve', requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE ceu_library SET approved = true WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'CEU not found.' });
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'ceu.approved', entityType: 'ceu_library', entityId: rows[0].id });
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /ceu/library/:id/approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ceu/library/:id (super_admin only)
router.delete('/library/:id', requireSuperAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM ceu_library WHERE id = $1`, [req.params.id]);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'ceu.deleted', entityType: 'ceu_library', entityId: req.params.id });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /ceu/library/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Discovery ─────────────────────────────────────────────────────

function parseCeuSuggestions(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// POST /api/ceu/discover — asks Claude (with web search) for free CEU opportunities
router.post('/discover', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI discovery is not configured on this server.' });
  }

  const prompt = 'Search the web and find 10 currently available free continuing education ' +
    'opportunities for certified athletic trainers (ATC). For each one provide: title, provider ' +
    'name, credit hours, URL, and a brief description. Only include opportunities that are ' +
    'genuinely free with no paywall. Format as JSON array.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('POST /ceu/discover Anthropic error:', response.status, JSON.stringify(data));
      return res.status(502).json({ error: 'AI discovery request failed.' });
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ suggestions: parseCeuSuggestions(text) });
  } catch (err) {
    console.error('POST /ceu/discover error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Completion tracking ──────────────────────────────────────────────

// GET /api/ceu/completions
router.get('/completions', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM ceu_completions WHERE profile_id = $1 ORDER BY completed_date DESC, created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /ceu/completions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ceu/completions
router.post('/completions', async (req, res) => {
  const { ceu_id, title, provider, credit_hours, completed_date, notes } = req.body;

  if (!title?.trim() || !credit_hours || !completed_date) {
    return res.status(400).json({ error: 'title, credit_hours, and completed_date are required.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO ceu_completions (profile_id, ceu_id, title, provider, credit_hours, completed_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.userId, ceu_id || null, title.trim(), provider || null, credit_hours, completed_date, notes || null]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'ceu.completed', entityType: 'ceu_completion', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /ceu/completions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ceu/completions/:id/upload — upload/replace completion certificate
router.post('/completions/:id/upload', async (req, res) => {
  const { base64, file_name, file_type } = req.body;
  if (!base64 || !file_name?.trim()) {
    return res.status(400).json({ error: 'base64 and file_name are required.' });
  }

  try {
    const { rows: found } = await query(
      'SELECT id, certificate_url FROM ceu_completions WHERE id = $1 AND profile_id = $2',
      [req.params.id, req.userId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Completion not found.' });

    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const safeName = file_name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `ceu-certificates/${req.userId}/${Date.now()}-${safeName}`;
    const certificate_url = await uploadToPath(buffer, key, file_type || 'application/octet-stream');

    const oldKey = keyFromUrl(found[0].certificate_url);
    if (oldKey) {
      await deleteAtPath(oldKey).catch((err) => console.error('S3 delete (replace) failed:', err.message));
    }

    const { rows } = await query(
      `UPDATE ceu_completions SET certificate_url = $1 WHERE id = $2 AND profile_id = $3 RETURNING *`,
      [certificate_url, req.params.id, req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /ceu/completions/:id/upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ceu/completions/:id
router.delete('/completions/:id', async (req, res) => {
  try {
    const { rows: found } = await query(
      'SELECT certificate_url FROM ceu_completions WHERE id = $1 AND profile_id = $2',
      [req.params.id, req.userId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Completion not found.' });

    const key = keyFromUrl(found[0].certificate_url);
    if (key) {
      await deleteAtPath(key).catch((err) => console.error('S3 delete failed:', err.message));
    }

    await query('DELETE FROM ceu_completions WHERE id = $1 AND profile_id = $2', [req.params.id, req.userId]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /ceu/completions/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ceu/progress — BOC recertification progress for the logged-in AT
router.get('/progress', async (req, res) => {
  try {
    const { rows: bocRows } = await query(
      `SELECT issued_date, expiration_date FROM at_credentials
       WHERE profile_id = $1 AND credential_type = 'boc'
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    const boc = bocRows[0];

    if (!boc?.expiration_date) {
      const { rows: allTime } = await query(
        `SELECT COALESCE(SUM(credit_hours), 0) AS hours FROM ceu_completions WHERE profile_id = $1`,
        [req.userId]
      );
      return res.json({
        has_boc_credential: false,
        period_start: null,
        period_end: null,
        hours_completed: Number(allTime[0].hours),
        hours_required: BOC_HOURS_REQUIRED,
        hours_remaining: null,
        status: null,
      });
    }

    const periodEnd = new Date(boc.expiration_date);
    const periodStart = new Date(periodEnd);
    periodStart.setFullYear(periodStart.getFullYear() - BOC_PERIOD_YEARS);

    const { rows: periodRows } = await query(
      `SELECT COALESCE(SUM(credit_hours), 0) AS hours FROM ceu_completions
       WHERE profile_id = $1 AND completed_date BETWEEN $2 AND $3`,
      [req.userId, periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]]
    );
    const hoursCompleted = Number(periodRows[0].hours);
    const hoursRemaining = Math.max(0, BOC_HOURS_REQUIRED - hoursCompleted);

    const now = new Date();
    const totalMs = periodEnd - periodStart;
    const elapsedPct = totalMs > 0 ? Math.min(1, Math.max(0, (now - periodStart) / totalMs)) : 1;
    const completedPct = Math.min(1, hoursCompleted / BOC_HOURS_REQUIRED);
    const deficit = elapsedPct - completedPct;

    const status = deficit <= 0.1 ? 'on_track' : deficit <= 0.25 ? 'behind' : 'critical';

    res.json({
      has_boc_credential: true,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      hours_completed: hoursCompleted,
      hours_required: BOC_HOURS_REQUIRED,
      hours_remaining: hoursRemaining,
      status,
    });
  } catch (err) {
    console.error('GET /ceu/progress error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
