import express from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logActivity } from '../middleware/logActivity.js';
import { checkInventoryAlerts } from '../lib/inventoryAlerts.js';

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ['consumable', 'non_consumable', 'medication', 'equipment'];

// Read is open to every authenticated role; writes are AT/admin only —
// coaches can view inventory but not change it.
function requireStaff(req, res, next) {
  if (req.role === 'coach') return res.status(403).json({ error: 'Not authorized.' });
  next();
}

const CHECKOUT_SELECT = `
  SELECT t.*, a.name AS athlete_name, i.name AS item_name, i.unit, i.category
  FROM inventory_transactions t
  JOIN inventory_items i ON i.id = t.item_id
  LEFT JOIN athletes a ON a.id = t.athlete_id
`;

// ── Items (list / alerts / checkouts — static routes before /:id) ───────

// GET /api/inventory — ?category=, ?low_stock=true
router.get('/', async (req, res) => {
  const { category, low_stock } = req.query;
  const conditions = ['school_id = $1'];
  const params = [req.schoolId];
  let p = 2;

  if (category) {
    conditions.push(`category = $${p++}`);
    params.push(category);
  }
  if (low_stock === 'true') {
    conditions.push(`low_stock_threshold IS NOT NULL AND quantity_on_hand <= low_stock_threshold`);
  }

  try {
    const { rows } = await query(
      `SELECT * FROM inventory_items WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/alerts — low stock, overdue checkouts, expiring meds
router.get('/alerts', async (req, res) => {
  try {
    const [lowStockRes, overdueRes, expiringRes] = await Promise.all([
      query(
        `SELECT * FROM inventory_items
         WHERE school_id = $1 AND low_stock_threshold IS NOT NULL AND quantity_on_hand <= low_stock_threshold
         ORDER BY name`,
        [req.schoolId]
      ),
      query(
        `${CHECKOUT_SELECT}
         WHERE t.school_id = $1 AND t.transaction_type = 'checkout' AND t.returned_at IS NULL AND t.due_date < CURRENT_DATE
         ORDER BY t.due_date ASC`,
        [req.schoolId]
      ),
      query(
        `SELECT * FROM inventory_items
         WHERE school_id = $1 AND category = 'medication' AND expiration_date IS NOT NULL
           AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
         ORDER BY expiration_date ASC`,
        [req.schoolId]
      ),
    ]);
    res.json({
      low_stock: lowStockRes.rows,
      overdue_checkouts: overdueRes.rows,
      expiring_medications: expiringRes.rows,
    });
  } catch (err) {
    console.error('GET /inventory/alerts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/check-alerts — sweep + email, like credential alerts
router.post('/check-alerts', async (req, res) => {
  try {
    const result = await checkInventoryAlerts();
    res.json(result);
  } catch (err) {
    console.error('POST /inventory/check-alerts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/checkouts/active — ?athlete_id= optional filter
router.get('/checkouts/active', async (req, res) => {
  const { athlete_id } = req.query;
  const conditions = [`t.school_id = $1`, `t.transaction_type = 'checkout'`, `t.returned_at IS NULL`];
  const params = [req.schoolId];
  let p = 2;
  if (athlete_id) {
    conditions.push(`t.athlete_id = $${p++}`);
    params.push(athlete_id);
  }

  try {
    const { rows } = await query(
      `${CHECKOUT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/checkouts/active error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/checkouts/overdue
router.get('/checkouts/overdue', async (req, res) => {
  try {
    const { rows } = await query(
      `${CHECKOUT_SELECT}
       WHERE t.school_id = $1 AND t.transaction_type = 'checkout' AND t.returned_at IS NULL AND t.due_date < CURRENT_DATE
       ORDER BY t.due_date ASC`,
      [req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/checkouts/overdue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory — create item
router.post('/', requireStaff, async (req, res) => {
  const {
    name, category, subcategory, description, quantity_on_hand, unit,
    low_stock_threshold, location, brand, sku, cost_per_unit,
    is_controlled_substance, requires_prescription, expiration_date, lot_number, notes,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });

  try {
    const { rows } = await query(
      `INSERT INTO inventory_items
         (school_id, name, category, subcategory, description, quantity_on_hand, unit,
          low_stock_threshold, location, brand, sku, cost_per_unit, is_controlled_substance,
          requires_prescription, expiration_date, lot_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.schoolId, name.trim(), category, subcategory?.trim() || null, description?.trim() || null,
       Number(quantity_on_hand) || 0, unit?.trim() || 'each',
       low_stock_threshold != null && low_stock_threshold !== '' ? Number(low_stock_threshold) : null,
       location?.trim() || null, brand?.trim() || null, sku?.trim() || null,
       cost_per_unit != null && cost_per_unit !== '' ? Number(cost_per_unit) : null,
       !!is_controlled_substance, !!requires_prescription,
       expiration_date || null, lot_number?.trim() || null, notes?.trim() || null]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'inventory.item_created', entityType: 'inventory_item', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /inventory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Single item ──────────────────────────────────────────────────────

// GET /api/inventory/:id — item + full transaction history
router.get('/:id', async (req, res) => {
  try {
    const { rows: itemRows } = await query(
      `SELECT * FROM inventory_items WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    if (!itemRows[0]) return res.status(404).json({ error: 'Item not found.' });

    const { rows: transactions } = await query(
      `SELECT t.*, a.name AS athlete_name, p.email AS performed_by_email
       FROM inventory_transactions t
       LEFT JOIN athletes a ON a.id = t.athlete_id
       LEFT JOIN profiles p ON p.id = t.performed_by
       WHERE t.item_id = $1 AND t.school_id = $2
       ORDER BY t.created_at DESC`,
      [req.params.id, req.schoolId]
    );

    res.json({ ...itemRows[0], transactions });
  } catch (err) {
    console.error('GET /inventory/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inventory/:id — update descriptive fields (quantity changes only via transactions)
router.put('/:id', requireStaff, async (req, res) => {
  const {
    name, category, subcategory, description, unit, low_stock_threshold,
    location, brand, sku, cost_per_unit, is_controlled_substance,
    requires_prescription, expiration_date, lot_number, notes,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });

  try {
    const { rows } = await query(
      `UPDATE inventory_items SET
         name = $1, category = $2, subcategory = $3, description = $4, unit = $5,
         low_stock_threshold = $6, location = $7, brand = $8, sku = $9, cost_per_unit = $10,
         is_controlled_substance = $11, requires_prescription = $12, expiration_date = $13,
         lot_number = $14, notes = $15, updated_at = now()
       WHERE id = $16 AND school_id = $17
       RETURNING *`,
      [name.trim(), category, subcategory?.trim() || null, description?.trim() || null, unit?.trim() || 'each',
       low_stock_threshold != null && low_stock_threshold !== '' ? Number(low_stock_threshold) : null,
       location?.trim() || null, brand?.trim() || null, sku?.trim() || null,
       cost_per_unit != null && cost_per_unit !== '' ? Number(cost_per_unit) : null,
       !!is_controlled_substance, !!requires_prescription, expiration_date || null, lot_number?.trim() || null,
       notes?.trim() || null, req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /inventory/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/:id — only if no active checkouts
router.delete('/:id', requireStaff, async (req, res) => {
  try {
    const { rows: active } = await query(
      `SELECT COUNT(*)::int AS cnt FROM inventory_transactions
       WHERE item_id = $1 AND school_id = $2 AND transaction_type = 'checkout' AND returned_at IS NULL`,
      [req.params.id, req.schoolId]
    );
    if (active[0].cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete an item with active checkouts.' });
    }

    const { rows } = await query(
      `DELETE FROM inventory_items WHERE id = $1 AND school_id = $2 RETURNING id`,
      [req.params.id, req.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found.' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /inventory/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Transactions ─────────────────────────────────────────────────────

async function getItemForUpdate(id, schoolId) {
  const { rows } = await query('SELECT * FROM inventory_items WHERE id = $1 AND school_id = $2', [id, schoolId]);
  return rows[0] ?? null;
}

async function applyQuantityChange(item, newQty) {
  const { rows } = await query(
    `UPDATE inventory_items SET quantity_on_hand = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [newQty, item.id]
  );
  return rows[0];
}

// POST /api/inventory/:id/restock
router.post('/:id/restock', requireStaff, async (req, res) => {
  const { quantity, notes, cost_per_unit } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });

  try {
    const item = await getItemForUpdate(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const newQty = Number(item.quantity_on_hand) + qty;
    const { rows: txRows } = await query(
      `INSERT INTO inventory_transactions
         (school_id, item_id, transaction_type, quantity, previous_quantity, new_quantity, performed_by, notes)
       VALUES ($1,$2,'restock',$3,$4,$5,$6,$7) RETURNING *`,
      [req.schoolId, item.id, qty, item.quantity_on_hand, newQty, req.userId, notes?.trim() || null]
    );

    const fields = ['quantity_on_hand = $1', 'updated_at = now()'];
    const params = [newQty];
    let p = 2;
    if (cost_per_unit != null && cost_per_unit !== '') {
      fields.push(`cost_per_unit = $${p++}`);
      params.push(Number(cost_per_unit));
    }
    params.push(item.id);
    const { rows: updated } = await query(
      `UPDATE inventory_items SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );

    res.json({ item: updated[0], transaction: txRows[0] });
  } catch (err) {
    console.error('POST /inventory/:id/restock error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/use
router.post('/:id/use', requireStaff, async (req, res) => {
  const { quantity, notes } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });

  try {
    const item = await getItemForUpdate(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const newQty = Number(item.quantity_on_hand) - qty;
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient quantity on hand.' });

    const { rows: txRows } = await query(
      `INSERT INTO inventory_transactions
         (school_id, item_id, transaction_type, quantity, previous_quantity, new_quantity, performed_by, notes)
       VALUES ($1,$2,'use',$3,$4,$5,$6,$7) RETURNING *`,
      [req.schoolId, item.id, qty, item.quantity_on_hand, newQty, req.userId, notes?.trim() || null]
    );
    const updated = await applyQuantityChange(item, newQty);
    res.json({ item: updated, transaction: txRows[0] });
  } catch (err) {
    console.error('POST /inventory/:id/use error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/adjust
router.post('/:id/adjust', requireStaff, async (req, res) => {
  const { new_quantity, reason } = req.body;
  const newQty = Number(new_quantity);
  if (new_quantity === undefined || new_quantity === null || new_quantity === '' || isNaN(newQty) || newQty < 0) {
    return res.status(400).json({ error: 'new_quantity must be a non-negative number.' });
  }
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });

  try {
    const item = await getItemForUpdate(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const delta = newQty - Number(item.quantity_on_hand);
    const { rows: txRows } = await query(
      `INSERT INTO inventory_transactions
         (school_id, item_id, transaction_type, quantity, previous_quantity, new_quantity, performed_by, notes)
       VALUES ($1,$2,'adjust',$3,$4,$5,$6,$7) RETURNING *`,
      [req.schoolId, item.id, delta, item.quantity_on_hand, newQty, req.userId, reason.trim()]
    );
    const updated = await applyQuantityChange(item, newQty);
    res.json({ item: updated, transaction: txRows[0] });
  } catch (err) {
    console.error('POST /inventory/:id/adjust error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/checkout
router.post('/:id/checkout', requireStaff, async (req, res) => {
  const { athlete_id, quantity, due_date, notes } = req.body;
  const qty = Number(quantity);
  if (!athlete_id) return res.status(400).json({ error: 'athlete_id is required.' });
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });

  try {
    const { rows: athRows } = await query('SELECT id FROM athletes WHERE id = $1 AND school_id = $2', [athlete_id, req.schoolId]);
    if (!athRows[0]) return res.status(400).json({ error: 'Athlete not found.' });

    const item = await getItemForUpdate(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const newQty = Number(item.quantity_on_hand) - qty;
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient quantity on hand.' });

    const { rows: txRows } = await query(
      `INSERT INTO inventory_transactions
         (school_id, item_id, transaction_type, quantity, previous_quantity, new_quantity, athlete_id, performed_by, notes, due_date)
       VALUES ($1,$2,'checkout',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.schoolId, item.id, qty, item.quantity_on_hand, newQty, athlete_id, req.userId, notes?.trim() || null, due_date || null]
    );
    const updated = await applyQuantityChange(item, newQty);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'inventory.checkout', entityType: 'inventory_transaction', entityId: txRows[0].id });
    res.status(201).json({ item: updated, transaction: txRows[0] });
  } catch (err) {
    console.error('POST /inventory/:id/checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/return — closes the referenced checkout in full and
// credits quantity_returned back to stock via a separate 'return' transaction.
router.post('/:id/return', requireStaff, async (req, res) => {
  const { transaction_id, quantity_returned, notes } = req.body;
  const qty = Number(quantity_returned);
  if (!transaction_id) return res.status(400).json({ error: 'transaction_id is required.' });
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity_returned must be a positive number.' });

  try {
    const { rows: checkoutRows } = await query(
      `SELECT * FROM inventory_transactions
       WHERE id = $1 AND item_id = $2 AND school_id = $3 AND transaction_type = 'checkout'`,
      [transaction_id, req.params.id, req.schoolId]
    );
    const checkout = checkoutRows[0];
    if (!checkout) return res.status(404).json({ error: 'Checkout transaction not found.' });
    if (checkout.returned_at) return res.status(400).json({ error: 'This checkout has already been returned.' });

    const item = await getItemForUpdate(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const newQty = Number(item.quantity_on_hand) + qty;
    const { rows: txRows } = await query(
      `INSERT INTO inventory_transactions
         (school_id, item_id, transaction_type, quantity, previous_quantity, new_quantity, athlete_id, performed_by, notes, returned_at)
       VALUES ($1,$2,'return',$3,$4,$5,$6,$7,$8,now()) RETURNING *`,
      [req.schoolId, item.id, qty, item.quantity_on_hand, newQty, checkout.athlete_id, req.userId, notes?.trim() || null]
    );

    await query(`UPDATE inventory_transactions SET returned_at = now() WHERE id = $1`, [checkout.id]);
    const updated = await applyQuantityChange(item, newQty);

    res.json({ item: updated, transaction: txRows[0] });
  } catch (err) {
    console.error('POST /inventory/:id/return error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Controlled substances (AT/admin only) ───────────────────────────

async function getControlledItem(id, schoolId) {
  const { rows } = await query(
    `SELECT * FROM inventory_items WHERE id = $1 AND school_id = $2 AND is_controlled_substance = true`,
    [id, schoolId]
  );
  return rows[0] ?? null;
}

// POST /api/inventory/:id/controlled/administer
router.post('/:id/controlled/administer', requireStaff, async (req, res) => {
  const { athlete_id, quantity, witness, physician_order, lot_number, reason } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });

  try {
    const item = await getControlledItem(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Controlled substance item not found.' });

    const newQty = Number(item.quantity_on_hand) - qty;
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient quantity on hand.' });

    const { rows: logRows } = await query(
      `INSERT INTO controlled_substance_log
         (school_id, item_id, transaction_type, quantity, athlete_id, administered_by, witness, physician_order, lot_number, reason)
       VALUES ($1,$2,'administered',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.schoolId, item.id, qty, athlete_id || null, req.userId, witness || null,
       physician_order?.trim() || null, lot_number?.trim() || null, reason.trim()]
    );
    await applyQuantityChange(item, newQty);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'inventory.controlled_administered', entityType: 'inventory_item', entityId: item.id });
    res.status(201).json(logRows[0]);
  } catch (err) {
    console.error('POST /inventory/:id/controlled/administer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/controlled/waste
router.post('/:id/controlled/waste', requireStaff, async (req, res) => {
  const { quantity, witness, reason } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });

  try {
    const item = await getControlledItem(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Controlled substance item not found.' });

    const newQty = Number(item.quantity_on_hand) - qty;
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient quantity on hand.' });

    const { rows: logRows } = await query(
      `INSERT INTO controlled_substance_log
         (school_id, item_id, transaction_type, quantity, administered_by, witness, reason)
       VALUES ($1,$2,'wasted',$3,$4,$5,$6) RETURNING *`,
      [req.schoolId, item.id, qty, req.userId, witness || null, reason.trim()]
    );
    await applyQuantityChange(item, newQty);
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'inventory.controlled_wasted', entityType: 'inventory_item', entityId: item.id });
    res.status(201).json(logRows[0]);
  } catch (err) {
    console.error('POST /inventory/:id/controlled/waste error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/controlled/receive
router.post('/:id/controlled/receive', requireStaff, async (req, res) => {
  const { quantity, lot_number, expiration_date, notes } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number.' });

  try {
    const item = await getControlledItem(req.params.id, req.schoolId);
    if (!item) return res.status(404).json({ error: 'Controlled substance item not found.' });

    const newQty = Number(item.quantity_on_hand) + qty;
    const { rows: logRows } = await query(
      `INSERT INTO controlled_substance_log
         (school_id, item_id, transaction_type, quantity, administered_by, lot_number, expiration_date, reason, notes)
       VALUES ($1,$2,'received',$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.schoolId, item.id, qty, req.userId, lot_number?.trim() || null, expiration_date || null,
       'Shipment received', notes?.trim() || null]
    );
    await query(
      `UPDATE inventory_items SET quantity_on_hand = $1, updated_at = now(),
         lot_number = COALESCE($2, lot_number), expiration_date = COALESCE($3, expiration_date)
       WHERE id = $4`,
      [newQty, lot_number?.trim() || null, expiration_date || null, item.id]
    );
    logActivity({ schoolId: req.schoolId, profileId: req.userId, action: 'inventory.controlled_received', entityType: 'inventory_item', entityId: item.id });
    res.status(201).json(logRows[0]);
  } catch (err) {
    console.error('POST /inventory/:id/controlled/receive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/:id/controlled/log
router.get('/:id/controlled/log', requireStaff, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT l.*, a.name AS athlete_name, p1.email AS administered_by_email, p2.email AS witness_email
       FROM controlled_substance_log l
       LEFT JOIN athletes a ON a.id = l.athlete_id
       LEFT JOIN profiles p1 ON p1.id = l.administered_by
       LEFT JOIN profiles p2 ON p2.id = l.witness
       WHERE l.item_id = $1 AND l.school_id = $2
       ORDER BY l.created_at DESC`,
      [req.params.id, req.schoolId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/:id/controlled/log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
