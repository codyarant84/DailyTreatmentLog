import { Resend } from 'resend';
import { query } from './db.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ALERT_SUPPRESS_HOURS = 24;

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function tableSection(title, rowsHtml, cols) {
  if (rowsHtml.length === 0) return '';
  return `
    <h3 style="margin:20px 0 8px;color:#111">${title}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="background:#f3f4f6">
          ${cols.map((c) => `<th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555">${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${rowsHtml.join('')}</tbody>
    </table>`;
}

function buildEmailHtml({ lowStock, overdueCheckouts, expiringMeds }) {
  const lowStockRows = lowStock.map((i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.quantity_on_hand} ${i.unit || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.low_stock_threshold}</td>
    </tr>`);

  const overdueRows = overdueCheckouts.map((c) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${c.item_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${c.athlete_name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${fmtDate(c.due_date)}</td>
    </tr>`);

  const expiringRows = expiringMeds.map((i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${fmtDate(i.expiration_date)}</td>
    </tr>`);

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:4px;color:#111">Fieldside Inventory Alerts</h2>
      <p style="color:#777;margin-top:0;font-size:14px">The following items need attention.</p>
      ${tableSection('Low Stock', lowStockRows, ['Item', 'On Hand', 'Threshold'])}
      ${tableSection('Overdue Checkouts', overdueRows, ['Item', 'Athlete', 'Due Date'])}
      ${tableSection('Expiring Medications', expiringRows, ['Item', 'Expires'])}
      <p style="margin-top:24px">
        <a href="https://fieldsidehealth.com/inventory" style="background:#1d6fa5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
          Review Inventory
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="color:#aaa;font-size:12px">Sent by Fieldside Health — fieldsidehealth.com</p>
    </div>`;
}

// Sweeps every school for low-stock items, overdue checkouts, and expiring
// medications; emails each school's trainer/admin staff a summary and
// records what was sent so repeated sweeps (e.g. a daily cron calling
// POST /api/inventory/check-alerts) don't re-alert on the same condition
// within ALERT_SUPPRESS_HOURS. Mirrors credentialAlerts.js's shape.
export async function checkInventoryAlerts() {
  const { rows: schools } = await query('SELECT id FROM schools', []);

  let emailsSent = 0;
  let itemsFlagged = 0;

  for (const school of schools) {
    const schoolId = school.id;

    const [lowStockRes, overdueRes, expiringRes, recentAlertsRes] = await Promise.all([
      query(
        `SELECT * FROM inventory_items
         WHERE school_id = $1 AND low_stock_threshold IS NOT NULL AND quantity_on_hand <= low_stock_threshold`,
        [schoolId]
      ),
      query(
        `SELECT t.*, a.name AS athlete_name, i.name AS item_name
         FROM inventory_transactions t
         JOIN inventory_items i ON i.id = t.item_id
         LEFT JOIN athletes a ON a.id = t.athlete_id
         WHERE t.school_id = $1 AND t.transaction_type = 'checkout' AND t.returned_at IS NULL AND t.due_date < CURRENT_DATE`,
        [schoolId]
      ),
      query(
        `SELECT * FROM inventory_items
         WHERE school_id = $1 AND category = 'medication' AND expiration_date IS NOT NULL
           AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`,
        [schoolId]
      ),
      query(
        `SELECT alert_type, item_id, transaction_id FROM inventory_alert_log
         WHERE school_id = $1 AND sent_at >= now() - ($2 || ' hours')::interval`,
        [schoolId, ALERT_SUPPRESS_HOURS]
      ),
    ]);

    const alerted = {
      low_stock: new Set(recentAlertsRes.rows.filter((a) => a.alert_type === 'low_stock').map((a) => a.item_id)),
      overdue_checkout: new Set(recentAlertsRes.rows.filter((a) => a.alert_type === 'overdue_checkout').map((a) => a.transaction_id)),
      expiring_medication: new Set(recentAlertsRes.rows.filter((a) => a.alert_type === 'expiring_medication').map((a) => a.item_id)),
    };

    const lowStock = lowStockRes.rows.filter((i) => !alerted.low_stock.has(i.id));
    const overdueCheckouts = overdueRes.rows.filter((c) => !alerted.overdue_checkout.has(c.id));
    const expiringMeds = expiringRes.rows.filter((i) => !alerted.expiring_medication.has(i.id));

    itemsFlagged += lowStock.length + overdueCheckouts.length + expiringMeds.length;
    if (lowStock.length === 0 && overdueCheckouts.length === 0 && expiringMeds.length === 0) continue;

    const { rows: staff } = await query(
      `SELECT email FROM profiles WHERE school_id = $1 AND role IN ('trainer', 'admin')`,
      [schoolId]
    );
    if (staff.length === 0) continue;

    if (resend) {
      try {
        await Promise.all(staff.map((s) =>
          resend.emails.send({
            from: 'Fieldside <noreply@fieldsidehealth.com>',
            to: s.email,
            subject: 'Fieldside — Inventory alerts',
            html: buildEmailHtml({ lowStock, overdueCheckouts, expiringMeds }),
          })
        ));
        emailsSent += staff.length;
      } catch (err) {
        console.error('[inventoryAlerts] send failed for school', schoolId, err.message);
        continue;
      }
    } else {
      console.warn('RESEND_API_KEY not set — skipping inventory alert emails');
    }

    await Promise.all([
      ...lowStock.map((i) =>
        query(`INSERT INTO inventory_alert_log (school_id, alert_type, item_id) VALUES ($1, 'low_stock', $2)`, [schoolId, i.id])),
      ...overdueCheckouts.map((c) =>
        query(`INSERT INTO inventory_alert_log (school_id, alert_type, transaction_id) VALUES ($1, 'overdue_checkout', $2)`, [schoolId, c.id])),
      ...expiringMeds.map((i) =>
        query(`INSERT INTO inventory_alert_log (school_id, alert_type, item_id) VALUES ($1, 'expiring_medication', $2)`, [schoolId, i.id])),
    ]);
  }

  return { emailsSent, itemsFlagged };
}
