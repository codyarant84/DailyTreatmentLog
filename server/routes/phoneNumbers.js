import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendSMS, toE164 } from '../lib/sms.js';

const router = express.Router();
router.use(requireAuth);

const CODE_EXPIRES_MINUTES = 10;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// GET /api/phone-numbers — the logged-in AT's own registered numbers
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, phone_number, verified, created_at
       FROM at_phone_numbers WHERE profile_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /phone-numbers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/phone-numbers — register a number and text a verification code
router.post('/', async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number?.trim()) return res.status(400).json({ error: 'phone_number is required.' });

  const phone = toE164(phone_number.trim());
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);

  try {
    const { rows: existing } = await query(
      `SELECT id, profile_id, verified FROM at_phone_numbers WHERE phone_number = $1`,
      [phone]
    );

    if (existing[0] && (existing[0].verified || existing[0].profile_id !== req.userId)) {
      return res.status(409).json({ error: 'This phone number is already registered.' });
    }

    let row;
    if (existing[0]) {
      const { rows } = await query(
        `UPDATE at_phone_numbers
         SET verification_code = $1, verification_code_expires_at = $2
         WHERE id = $3
         RETURNING id, phone_number, verified`,
        [code, expiresAt, existing[0].id]
      );
      row = rows[0];
    } else {
      const { rows } = await query(
        `INSERT INTO at_phone_numbers (profile_id, school_id, phone_number, verification_code, verification_code_expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, phone_number, verified`,
        [req.userId, req.schoolId, phone, code, expiresAt]
      );
      row = rows[0];
    }

    await sendSMS(phone, `Your Fieldside verification code is: ${code}`);
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /phone-numbers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/phone-numbers/verify — confirm the code sent to a pending number
router.post('/verify', async (req, res) => {
  const { phone_number, code } = req.body;
  if (!phone_number?.trim() || !code?.trim()) {
    return res.status(400).json({ error: 'phone_number and code are required.' });
  }

  const phone = toE164(phone_number.trim());

  try {
    const { rows } = await query(
      `SELECT id, verification_code, verification_code_expires_at
       FROM at_phone_numbers WHERE phone_number = $1 AND profile_id = $2`,
      [phone, req.userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Phone number not found.' });

    if (row.verification_code !== code.trim()) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }
    if (!row.verification_code_expires_at || new Date() > new Date(row.verification_code_expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Request a new one.' });
    }

    const { rows: updated } = await query(
      `UPDATE at_phone_numbers
       SET verified = true, verification_code = NULL, verification_code_expires_at = NULL
       WHERE id = $1
       RETURNING id, phone_number, verified`,
      [row.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('POST /phone-numbers/verify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/phone-numbers/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(
      `DELETE FROM at_phone_numbers WHERE id = $1 AND profile_id = $2`,
      [req.params.id, req.userId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /phone-numbers/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
