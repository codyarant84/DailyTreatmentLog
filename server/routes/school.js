import express from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/school/branding
router.get('/branding', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, primary_color, logo_url, cost_per_visit')
      .eq('id', req.schoolId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /school/branding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/school/branding — update primary color and/or cost_per_visit
router.put('/branding', async (req, res) => {
  const { primary_color, cost_per_visit } = req.body;
  if (!primary_color || !/^#[0-9a-fA-F]{6}$/.test(primary_color)) {
    return res.status(400).json({ error: 'primary_color must be a valid hex color (e.g. #1d6fa5)' });
  }

  const updates = { primary_color };
  if (cost_per_visit !== undefined) {
    const rate = Number(cost_per_visit);
    if (isNaN(rate) || rate < 0) return res.status(400).json({ error: 'cost_per_visit must be a positive number.' });
    updates.cost_per_visit = rate;
  }

  try {
    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', req.schoolId)
      .select('primary_color, logo_url, cost_per_visit')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PUT /school/branding error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/school/logo — accepts base64-encoded image, uploads to Supabase Storage
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
  const path = `${req.schoolId}/logo.${ext}`;

  try {
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');

    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(path, buffer, { contentType: mime_type, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(path);
    const logo_url = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('schools')
      .update({ logo_url })
      .eq('id', req.schoolId);

    if (updateError) throw updateError;

    res.json({ logo_url });
  } catch (err) {
    console.error('POST /school/logo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/school/logo — remove logo
router.delete('/logo', async (req, res) => {
  try {
    // Try to remove any existing logo files
    const exts = ['png', 'jpg', 'webp', 'svg'];
    await Promise.allSettled(
      exts.map((ext) =>
        supabase.storage.from('school-logos').remove([`${req.schoolId}/logo.${ext}`])
      )
    );

    const { error } = await supabase
      .from('schools')
      .update({ logo_url: null })
      .eq('id', req.schoolId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /school/logo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
