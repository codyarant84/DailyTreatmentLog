import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadToPath, deleteAtPath } from '../lib/storage.js';
import { logActivity } from '../middleware/logActivity.js';
import { checkExpiringCredentials } from '../lib/credentialAlerts.js';

const router = express.Router();
router.use(requireAuth);

const CREDENTIAL_TYPES = ['cpr_aed', 'boc', 'state_licensure', 'nata', 'npi', 'insurance', 'other'];

function keyFromUrl(url) {
  return url?.split('.amazonaws.com/')[1] ?? null;
}

async function uploadCredentialFile(userId, base64, fileName, fileType) {
  const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `credentials/${userId}/${Date.now()}-${safeName}`;
  const file_url = await uploadToPath(buffer, key, fileType || 'application/octet-stream');
  return { file_url, file_name: fileName.trim() };
}

// GET /api/credentials
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM at_credentials WHERE profile_id = $1 ORDER BY expiration_date ASC NULLS LAST, created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/credentials/expiring — credentials expiring in the next 60 days
router.get('/expiring', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM at_credentials
       WHERE profile_id = $1
       AND expiration_date IS NOT NULL
       AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
       ORDER BY expiration_date ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /credentials/expiring error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/credentials/check-alerts — manual trigger for the expiration alert sweep
router.get('/check-alerts', async (req, res) => {
  try {
    const result = await checkExpiringCredentials();
    res.json(result);
  } catch (err) {
    console.error('GET /credentials/check-alerts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/credentials
router.post('/', async (req, res) => {
  const {
    credential_type, credential_name, credential_number, issuing_state,
    issued_date, expiration_date, notes,
    base64, file_name, file_type,
  } = req.body;

  if (!credential_type || !CREDENTIAL_TYPES.includes(credential_type)) {
    return res.status(400).json({ error: 'A valid credential_type is required.' });
  }

  try {
    let file_url = null;
    let uploadedFileName = null;
    if (base64 && file_name?.trim()) {
      const uploaded = await uploadCredentialFile(req.userId, base64, file_name, file_type);
      file_url = uploaded.file_url;
      uploadedFileName = uploaded.file_name;
    }

    const { rows } = await query(
      `INSERT INTO at_credentials
         (profile_id, school_id, credential_type, credential_name, credential_number,
          issuing_state, issued_date, expiration_date, file_url, file_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.userId, req.schoolId, credential_type, credential_name || null, credential_number || null,
        issuing_state || null, issued_date || null, expiration_date || null,
        file_url, uploadedFileName, notes || null,
      ]
    );

    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'credential.created', entityType: 'at_credential', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/credentials/:id
router.put('/:id', async (req, res) => {
  const {
    credential_type, credential_name, credential_number, issuing_state,
    issued_date, expiration_date, notes,
  } = req.body;

  if (!credential_type || !CREDENTIAL_TYPES.includes(credential_type)) {
    return res.status(400).json({ error: 'A valid credential_type is required.' });
  }

  try {
    const { rows } = await query(
      `UPDATE at_credentials
       SET credential_type = $1, credential_name = $2, credential_number = $3, issuing_state = $4,
           issued_date = $5, expiration_date = $6, notes = $7, updated_at = now()
       WHERE id = $8 AND profile_id = $9
       RETURNING *`,
      [
        credential_type, credential_name || null, credential_number || null, issuing_state || null,
        issued_date || null, expiration_date || null, notes || null,
        req.params.id, req.userId,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Credential not found.' });

    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'credential.updated', entityType: 'at_credential', entityId: rows[0].id });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /credentials/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/credentials/:id/upload — upload or replace the document file
router.post('/:id/upload', async (req, res) => {
  const { base64, file_name, file_type } = req.body;
  if (!base64 || !file_name?.trim()) {
    return res.status(400).json({ error: 'base64 and file_name are required.' });
  }

  try {
    const { rows: found } = await query(
      'SELECT id, file_url FROM at_credentials WHERE id = $1 AND profile_id = $2',
      [req.params.id, req.userId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Credential not found.' });

    const { file_url, file_name: savedName } = await uploadCredentialFile(req.userId, base64, file_name, file_type);

    // Replace: remove the old file from S3 once the new one is uploaded
    const oldKey = keyFromUrl(found[0].file_url);
    if (oldKey) {
      await deleteAtPath(oldKey).catch((err) => console.error('S3 delete (replace) failed:', err.message));
    }

    const { rows } = await query(
      `UPDATE at_credentials SET file_url = $1, file_name = $2, updated_at = now()
       WHERE id = $3 AND profile_id = $4
       RETURNING *`,
      [file_url, savedName, req.params.id, req.userId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /credentials/:id/upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/credentials/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows: found } = await query(
      'SELECT file_url FROM at_credentials WHERE id = $1 AND profile_id = $2',
      [req.params.id, req.userId]
    );
    if (!found[0]) return res.status(404).json({ error: 'Credential not found.' });

    const key = keyFromUrl(found[0].file_url);
    if (key) {
      await deleteAtPath(key).catch((err) => console.error('S3 delete failed:', err.message));
    }

    await query('DELETE FROM at_credentials WHERE id = $1 AND profile_id = $2', [req.params.id, req.userId]);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'credential.deleted', entityType: 'at_credential', entityId: req.params.id });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /credentials/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
