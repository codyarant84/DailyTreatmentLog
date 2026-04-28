import express from 'express';
import { Resend } from 'resend';

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, school, role, email, phone, message } = req.body;
  if (!name?.trim() || !school?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'name, school, and email are required.' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Fieldside <noreply@fieldsidehealth.com>',
      to: 'cody@fieldsidehealth.com',
      subject: `Demo Request — ${name} at ${school}`,
      html: `
        <h2>New Demo Request</h2>
        <table cellpadding="6" cellspacing="0">
          <tr><td><strong>Name</strong></td><td>${name}</td></tr>
          <tr><td><strong>School / Org</strong></td><td>${school}</td></tr>
          <tr><td><strong>Role</strong></td><td>${role || '—'}</td></tr>
          <tr><td><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
          ${message ? `<tr><td><strong>Message</strong></td><td>${message}</td></tr>` : ''}
        </table>
      `,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/demo-request error:', err.message);
    res.status(500).json({ error: 'Failed to send demo request. Please try again.' });
  }
});

export default router;
