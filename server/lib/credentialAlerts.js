import { Resend } from 'resend';
import { query } from './db.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildEmailHtml(credentials) {
  const rows = credentials.map((c) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${c.credential_name || c.credential_type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${c.credential_number || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${formatDate(c.expiration_date)}</td>
    </tr>`).join('');

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:4px;color:#111">Your credentials are expiring soon</h2>
      <p style="color:#777;margin-top:0;font-size:14px">
        The following credentials in your Fieldside Document Vault are expiring within 60 days.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Credential</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Number</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">Expires</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px">
        <a href="https://fieldsidehealth.com/vault" style="background:#1d6fa5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
          Update your credentials
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="color:#aaa;font-size:12px">Sent by Fieldside Health — fieldsidehealth.com</p>
    </div>`;
}

// Finds credentials expiring within 60 days that haven't been alerted on in the
// last 30 days, emails each AT a summary via Resend, and records the alert.
export async function checkExpiringCredentials() {
  const { rows: expiring } = await query(
    `SELECT c.*, p.email AS at_email
     FROM at_credentials c
     JOIN profiles p ON p.id = c.profile_id
     WHERE c.expiration_date IS NOT NULL
       AND c.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
       AND NOT EXISTS (
         SELECT 1 FROM at_credential_alerts a
         WHERE a.credential_id = c.id
         AND a.alert_sent_at >= now() - INTERVAL '30 days'
       )
     ORDER BY p.email, c.expiration_date ASC`,
    []
  );

  if (expiring.length === 0) {
    return { emailsSent: 0, credentialsFlagged: 0 };
  }

  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping credential expiration emails');
    return { emailsSent: 0, credentialsFlagged: expiring.length, skipped: 'Email service not configured.' };
  }

  // Group by AT so each trainer gets one email listing all their expiring credentials
  const byTrainer = new Map();
  for (const c of expiring) {
    if (!byTrainer.has(c.at_email)) byTrainer.set(c.at_email, []);
    byTrainer.get(c.at_email).push(c);
  }

  let emailsSent = 0;
  for (const [email, credentials] of byTrainer) {
    try {
      await resend.emails.send({
        from: 'Fieldside <noreply@fieldsidehealth.com>',
        to: email,
        subject: 'Fieldside — Your credentials are expiring soon',
        html: buildEmailHtml(credentials),
      });
      emailsSent++;

      await Promise.all(credentials.map((c) =>
        query(
          `INSERT INTO at_credential_alerts (credential_id, alert_sent_at) VALUES ($1, now())`,
          [c.id]
        )
      ));
    } catch (err) {
      console.error('[credentialAlerts] send failed for', email, err.message);
    }
  }

  return { emailsSent, credentialsFlagged: expiring.length };
}
