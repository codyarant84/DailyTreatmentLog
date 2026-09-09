import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../lib/dateUtils.js';
import { WarningIcon } from '../components/Icons.jsx';
import './Inventory.css';

const CATEGORY_LABELS = {
  consumable: 'Consumable',
  non_consumable: 'Non-Consumable',
  medication: 'Medication',
  equipment: 'Equipment',
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);
const UNITS = ['each', 'box', 'bottle', 'roll', 'pair', 'pack', 'case', 'tube', 'vial'];

const CATEGORY_COLORS = {
  consumable:     { bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  non_consumable: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  medication:     { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
  equipment:      { bg: '#dcfce7', color: '#166534', border: '#86efac' },
};

const QTY_STATUS_COLORS = {
  ok:       { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  low:      { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  critical: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};
const QTY_STATUS_LABELS = { ok: 'OK', low: 'Low', critical: 'Critical' };

function quantityStatus(item) {
  if (item.low_stock_threshold == null) return 'ok';
  const qty = Number(item.quantity_on_hand);
  const threshold = Number(item.low_stock_threshold);
  if (qty <= 0 || qty <= threshold / 2) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

function daysOverdue(dueDate) {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / (1000 * 60 * 60 * 24));
}

function Badge({ label, colors }) {
  return (
    <span className="inv-badge" style={{ background: colors.bg, color: colors.color, borderColor: colors.border }}>
      {label}
    </span>
  );
}

function money(n) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
}

// ── Add / Edit item modal ────────────────────────────────────────────

const EMPTY_ITEM_FORM = {
  name: '', category: 'consumable', subcategory: '', description: '',
  quantity_on_hand: '0', unit: 'each', low_stock_threshold: '', location: '',
  brand: '', sku: '', cost_per_unit: '', is_controlled_substance: false,
  requires_prescription: false, expiration_date: '', lot_number: '', notes: '',
};

function ItemFormModal({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: item.name, category: item.category, subcategory: item.subcategory ?? '',
          description: item.description ?? '', quantity_on_hand: String(item.quantity_on_hand),
          unit: item.unit ?? 'each', low_stock_threshold: item.low_stock_threshold != null ? String(item.low_stock_threshold) : '',
          location: item.location ?? '', brand: item.brand ?? '', sku: item.sku ?? '',
          cost_per_unit: item.cost_per_unit != null ? String(item.cost_per_unit) : '',
          is_controlled_substance: !!item.is_controlled_substance, requires_prescription: !!item.requires_prescription,
          expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
          lot_number: item.lot_number ?? '', notes: item.notes ?? '',
        }
      : EMPTY_ITEM_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        subcategory: form.subcategory || null,
        description: form.description || null,
        low_stock_threshold: form.low_stock_threshold === '' ? null : form.low_stock_threshold,
        cost_per_unit: form.cost_per_unit === '' ? null : form.cost_per_unit,
        expiration_date: form.expiration_date || null,
        lot_number: form.lot_number || null,
        notes: form.notes || null,
      };
      const { data } = isEdit
        ? await api.put(`/api/inventory/${item.id}`, payload)
        : await api.post('/api/inventory', payload);
      onSaved(data, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  const isMedication = form.category === 'medication';

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Category <span className="required">*</span></label>
              <select className="form-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Name <span className="required">*</span></label>
              <input type="text" className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
            </div>
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Brand</label>
              <input type="text" className="form-input" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input type="text" className="form-input" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </div>
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input type="text" className="form-input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Cabinet A, Shelf 2" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {!isEdit && (
            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">Initial Quantity</label>
                <input type="number" min="0" step="0.01" className="form-input" value={form.quantity_on_hand} onChange={(e) => set('quantity_on_hand', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Low Stock Threshold</label>
                <input type="number" min="0" step="0.01" className="form-input" value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}
          {isEdit && (
            <div className="form-group">
              <label className="form-label">Low Stock Threshold</label>
              <input type="number" min="0" step="0.01" className="form-input" value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} placeholder="Optional" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Cost Per Unit ($)</label>
            <input type="number" min="0" step="0.01" className="form-input" value={form.cost_per_unit} onChange={(e) => set('cost_per_unit', e.target.value)} />
          </div>

          {isMedication && (
            <>
              <div className="modal-row">
                <div className="form-group">
                  <label className="form-label">Expiration Date</label>
                  <input type="date" className="form-input" value={form.expiration_date} onChange={(e) => set('expiration_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Lot Number</label>
                  <input type="text" className="form-input" value={form.lot_number} onChange={(e) => set('lot_number', e.target.value)} />
                </div>
              </div>
              <div className="modal-row">
                <label className="inv-checkbox-label">
                  <input type="checkbox" checked={form.is_controlled_substance} onChange={(e) => set('is_controlled_substance', e.target.checked)} />
                  Controlled substance
                </label>
                <label className="inv-checkbox-label">
                  <input type="checkbox" checked={form.requires_prescription} onChange={(e) => set('requires_prescription', e.target.checked)} />
                  Requires prescription
                </label>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Restock / Use / Adjust / Checkout modal ─────────────────────────

function TransactionModal({ mode, item, athletes, onClose, onDone }) {
  const [quantity, setQuantity] = useState(mode === 'adjust' ? String(item.quantity_on_hand) : '');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const titles = { restock: 'Restock', use: 'Use', adjust: 'Adjust Quantity', checkout: 'Check Out' };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === 'adjust') {
      if (quantity === '' || Number(quantity) < 0) { setError('Enter a valid quantity.'); return; }
      if (!reason.trim()) { setError('Reason is required.'); return; }
    } else {
      if (!quantity || Number(quantity) <= 0) { setError('Enter a quantity greater than 0.'); return; }
      if (mode === 'checkout' && !athleteId) { setError('Select an athlete.'); return; }
    }

    setSaving(true);
    try {
      let payload;
      let url;
      if (mode === 'restock') {
        url = `/api/inventory/${item.id}/restock`;
        payload = { quantity: Number(quantity), notes: notes || null, cost_per_unit: costPerUnit === '' ? null : Number(costPerUnit) };
      } else if (mode === 'use') {
        url = `/api/inventory/${item.id}/use`;
        payload = { quantity: Number(quantity), notes: notes || null };
      } else if (mode === 'adjust') {
        url = `/api/inventory/${item.id}/adjust`;
        payload = { new_quantity: Number(quantity), reason: reason.trim() };
      } else {
        url = `/api/inventory/${item.id}/checkout`;
        payload = { athlete_id: athleteId, quantity: Number(quantity), due_date: dueDate || null, notes: notes || null };
      }
      const { data } = await api.post(url, payload);
      onDone(data.item);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">{titles[mode]} — {item.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          <p className="settings-hint" style={{ margin: 0 }}>
            Current quantity: <strong>{item.quantity_on_hand} {item.unit}</strong>
          </p>

          {mode === 'checkout' && (
            <div className="form-group">
              <label className="form-label">Athlete <span className="required">*</span></label>
              <select className="form-input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} required>
                <option value="">Select athlete…</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{mode === 'adjust' ? 'New Quantity' : 'Quantity'} <span className="required">*</span></label>
            <input type="number" min="0" step="0.01" className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus required />
          </div>

          {mode === 'checkout' && (
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}

          {mode === 'restock' && (
            <div className="form-group">
              <label className="form-label">Cost Per Unit ($)</label>
              <input type="number" min="0" step="0.01" className="form-input" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="Optional — updates item cost" />
            </div>
          )}

          {mode === 'adjust' ? (
            <div className="form-group">
              <label className="form-label">Reason <span className="required">*</span></label>
              <input type="text" className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Physical count correction" required />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : titles[mode]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Return modal ─────────────────────────────────────────────────────

function ReturnModal({ checkout, onClose, onDone }) {
  const [quantityReturned, setQuantityReturned] = useState(String(checkout.quantity));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!quantityReturned || Number(quantityReturned) <= 0) { setError('Enter a quantity greater than 0.'); return; }
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post(`/api/inventory/${checkout.item_id}/return`, {
        transaction_id: checkout.id,
        quantity_returned: Number(quantityReturned),
        notes: notes || null,
      });
      onDone(data.item);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Return — {checkout.item_name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}
          <p className="settings-hint" style={{ margin: 0 }}>
            Checked out to <strong>{checkout.athlete_name ?? 'Unknown'}</strong> on {formatDate(checkout.created_at?.split('T')[0])}
          </p>
          <div className="form-group">
            <label className="form-label">Quantity Returned <span className="required">*</span></label>
            <input type="number" min="0" step="0.01" className="form-input" value={quantityReturned} onChange={(e) => setQuantityReturned(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Condition on return" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Return'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Controlled substance action modal ───────────────────────────────

function ControlledActionModal({ mode, item, athletes, staff, onClose, onDone }) {
  const [athleteId, setAthleteId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [witness, setWitness] = useState('');
  const [physicianOrder, setPhysicianOrder] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const titles = { administer: 'Administer', waste: 'Waste', receive: 'Receive Shipment' };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) { setError('Enter a quantity greater than 0.'); return; }
    if (mode !== 'receive' && !reason.trim()) { setError('Reason is required.'); return; }
    setError(null);
    setSaving(true);
    try {
      let url;
      let payload;
      if (mode === 'administer') {
        url = `/api/inventory/${item.id}/controlled/administer`;
        payload = { athlete_id: athleteId || null, quantity: Number(quantity), witness: witness || null, physician_order: physicianOrder || null, reason: reason.trim() };
      } else if (mode === 'waste') {
        url = `/api/inventory/${item.id}/controlled/waste`;
        payload = { quantity: Number(quantity), witness: witness || null, reason: reason.trim() };
      } else {
        url = `/api/inventory/${item.id}/controlled/receive`;
        payload = { quantity: Number(quantity), lot_number: lotNumber || null, expiration_date: expirationDate || null, notes: notes || null };
      }
      await api.post(url, payload);
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">{titles[mode]} — {item.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          {mode === 'administer' && (
            <div className="form-group">
              <label className="form-label">Athlete</label>
              <select className="form-input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
                <option value="">Select athlete…</option>
                {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Quantity <span className="required">*</span></label>
            <input type="number" min="0" step="0.01" className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus required />
          </div>

          {(mode === 'administer' || mode === 'waste') && (
            <div className="form-group">
              <label className="form-label">Witness</label>
              <select className="form-input" value={witness} onChange={(e) => setWitness(e.target.value)}>
                <option value="">None</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
              </select>
            </div>
          )}

          {mode === 'administer' && (
            <div className="form-group">
              <label className="form-label">Physician Order</label>
              <input type="text" className="form-input" value={physicianOrder} onChange={(e) => setPhysicianOrder(e.target.value)} />
            </div>
          )}

          {mode === 'receive' && (
            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">Lot Number</label>
                <input type="text" className="form-input" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Expiration Date</label>
                <input type="date" className="form-input" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
              </div>
            </div>
          )}

          {mode === 'receive' ? (
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Reason <span className="required">*</span></label>
              <input type="text" className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : titles[mode]}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────

function OverviewTab({ items, alerts, activeCheckoutCount, onGoTo }) {
  const totalValue = (cat) => items
    .filter((i) => i.category === cat)
    .reduce((sum, i) => sum + Number(i.quantity_on_hand) * Number(i.cost_per_unit || 0), 0);

  const catCount = (cat) => items.filter((i) => i.category === cat).length;

  return (
    <div className="inv-overview">
      {(alerts.low_stock.length > 0 || alerts.overdue_checkouts.length > 0 || alerts.expiring_medications.length > 0) && (
        <div className="inv-alert-banner">
          <span className="inv-alert-banner-icon"><WarningIcon /></span>
          <div className="inv-alert-banner-rows">
            {alerts.low_stock.length > 0 && (
              <button className="inv-alert-row" onClick={() => onGoTo('items')}>
                {alerts.low_stock.length} item{alerts.low_stock.length !== 1 ? 's' : ''} low on stock
              </button>
            )}
            {alerts.overdue_checkouts.length > 0 && (
              <button className="inv-alert-row" onClick={() => onGoTo('checkouts')}>
                {alerts.overdue_checkouts.length} checkout{alerts.overdue_checkouts.length !== 1 ? 's' : ''} overdue
              </button>
            )}
            {alerts.expiring_medications.length > 0 && (
              <button className="inv-alert-row" onClick={() => onGoTo('items')}>
                {alerts.expiring_medications.length} medication{alerts.expiring_medications.length !== 1 ? 's' : ''} expiring within 30 days
              </button>
            )}
          </div>
        </div>
      )}

      <div className="inv-summary-cards">
        <div className="inv-summary-card">
          <span className="inv-summary-value">{items.length}</span>
          <span className="inv-summary-label">Total Items</span>
        </div>
        <div className="inv-summary-card">
          <span className="inv-summary-value inv-summary-value--alert">{alerts.low_stock.length}</span>
          <span className="inv-summary-label">Low Stock</span>
        </div>
        <div className="inv-summary-card">
          <span className="inv-summary-value">{activeCheckoutCount}</span>
          <span className="inv-summary-label">Active Checkouts</span>
        </div>
        <div className="inv-summary-card">
          <span className="inv-summary-value inv-summary-value--alert">{alerts.expiring_medications.length}</span>
          <span className="inv-summary-label">Expiring Soon</span>
        </div>
      </div>

      <div className="inv-category-grid">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="inv-category-card">
            <Badge label={CATEGORY_LABELS[cat]} colors={CATEGORY_COLORS[cat]} />
            <span className="inv-category-count">{catCount(cat)} item{catCount(cat) !== 1 ? 's' : ''}</span>
            <span className="inv-category-value">{money(totalValue(cat))} total value</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Items tab ────────────────────────────────────────────────────────

function ItemsTab({ items, search, setSearch, categoryFilter, setCategoryFilter, onSelectItem, onAddItem, canWrite }) {
  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="inv-items-tab">
      <div className="inv-items-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Search by name, brand, or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-input" style={{ maxWidth: 200 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        {canWrite && (
          <button className="btn btn--primary" onClick={onAddItem}>+ Add Item</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="state-msg state-msg--empty"><p>No items match.</p></div>
      ) : (
        <div className="inv-item-list">
          {filtered.map((item) => {
            const status = quantityStatus(item);
            return (
              <button key={item.id} className="inv-item-row" onClick={() => onSelectItem(item)}>
                <div className="inv-item-row-main">
                  <span className="inv-item-name">{item.name}</span>
                  <Badge label={CATEGORY_LABELS[item.category]} colors={CATEGORY_COLORS[item.category]} />
                  {item.is_controlled_substance && <Badge label="Controlled" colors={QTY_STATUS_COLORS.critical} />}
                </div>
                <div className="inv-item-row-meta">
                  <span className="inv-qty-badge" style={{ background: QTY_STATUS_COLORS[status].bg, color: QTY_STATUS_COLORS[status].color, borderColor: QTY_STATUS_COLORS[status].border }}>
                    {item.quantity_on_hand} {item.unit}{item.low_stock_threshold != null ? ` / ${item.low_stock_threshold} min` : ''} — {QTY_STATUS_LABELS[status]}
                  </span>
                  {item.location && <span className="inv-item-location">{item.location}</span>}
                  <span className="inv-item-updated">Updated {formatDate(item.updated_at?.split('T')[0])}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Item detail ──────────────────────────────────────────────────────

function ItemDetail({ item, checkoutsForItem, onBack, onEdit, onDelete, onAction, onReturn, canWrite, onGoToControlled }) {
  const status = quantityStatus(item);
  return (
    <div className="inv-detail">
      <button className="inv-back-link" onClick={onBack}>&larr; Back to Items</button>

      <div className="inv-detail-header">
        <div>
          <h2 className="inv-detail-title">{item.name}</h2>
          <div className="inv-detail-badges">
            <Badge label={CATEGORY_LABELS[item.category]} colors={CATEGORY_COLORS[item.category]} />
            {item.is_controlled_substance && <Badge label="Controlled Substance" colors={QTY_STATUS_COLORS.critical} />}
            {item.requires_prescription && <Badge label="Rx Required" colors={QTY_STATUS_COLORS.low} />}
          </div>
        </div>
        {canWrite && (
          <div className="inv-detail-header-actions">
            <button className="btn btn--sm btn--outline" onClick={onEdit}>Edit</button>
            <button className="btn btn--sm btn--danger-ghost" onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>

      <div className="inv-detail-grid">
        <div className="inv-detail-field">
          <span className="inv-detail-label">On Hand</span>
          <span className="inv-qty-badge" style={{ background: QTY_STATUS_COLORS[status].bg, color: QTY_STATUS_COLORS[status].color, borderColor: QTY_STATUS_COLORS[status].border }}>
            {item.quantity_on_hand} {item.unit}
          </span>
        </div>
        <div className="inv-detail-field"><span className="inv-detail-label">Low Stock Threshold</span><span>{item.low_stock_threshold ?? '—'}</span></div>
        <div className="inv-detail-field"><span className="inv-detail-label">Location</span><span>{item.location ?? '—'}</span></div>
        <div className="inv-detail-field"><span className="inv-detail-label">Brand</span><span>{item.brand ?? '—'}</span></div>
        <div className="inv-detail-field"><span className="inv-detail-label">SKU</span><span>{item.sku ?? '—'}</span></div>
        <div className="inv-detail-field"><span className="inv-detail-label">Cost Per Unit</span><span>{money(item.cost_per_unit)}</span></div>
        {item.category === 'medication' && (
          <>
            <div className="inv-detail-field"><span className="inv-detail-label">Expiration Date</span><span>{formatDate(item.expiration_date?.split('T')[0])}</span></div>
            <div className="inv-detail-field"><span className="inv-detail-label">Lot Number</span><span>{item.lot_number ?? '—'}</span></div>
          </>
        )}
      </div>

      {item.description && <p className="inv-detail-notes">{item.description}</p>}
      {item.notes && <p className="inv-detail-notes">{item.notes}</p>}

      {item.is_controlled_substance && (
        <button className="btn btn--sm btn--outline" onClick={onGoToControlled} style={{ marginBottom: '1rem' }}>
          View Controlled Substance Audit Log →
        </button>
      )}

      {canWrite && (
        <div className="inv-detail-actions">
          <button className="btn btn--sm btn--primary" onClick={() => onAction('restock')}>Restock</button>
          <button className="btn btn--sm btn--outline" onClick={() => onAction('use')}>Use</button>
          <button className="btn btn--sm btn--outline" onClick={() => onAction('adjust')}>Adjust</button>
          {item.category === 'equipment' && (
            <button className="btn btn--sm btn--outline" onClick={() => onAction('checkout')}>Checkout</button>
          )}
        </div>
      )}

      {item.category === 'equipment' && checkoutsForItem.length > 0 && (
        <div className="inv-checkout-status">
          <h3 className="inv-section-title">Current Checkouts</h3>
          {checkoutsForItem.map((c) => (
            <div key={c.id} className="inv-checkout-row">
              <span>{c.athlete_name ?? 'Unknown'} — {c.quantity} {item.unit}</span>
              <span className="inv-item-updated">{c.due_date ? `Due ${formatDate(c.due_date)}` : 'No due date'}</span>
              {canWrite && <button className="btn btn--sm btn--outline" onClick={() => onReturn(c)}>Return</button>}
            </div>
          ))}
        </div>
      )}

      <h3 className="inv-section-title">Transaction History</h3>
      {item.transactions.length === 0 ? (
        <p className="state-msg--empty">No transactions yet.</p>
      ) : (
        <div className="inv-tx-table-wrap">
          <table className="inv-tx-table">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Qty</th><th>New Qty</th><th>Athlete</th><th>By</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {item.transactions.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleDateString('en-US')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.transaction_type}</td>
                  <td>{t.quantity}</td>
                  <td>{t.new_quantity}</td>
                  <td>{t.athlete_name ?? '—'}</td>
                  <td>{t.performed_by_email ?? '—'}</td>
                  <td>{t.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Checkouts tab ────────────────────────────────────────────────────

function CheckoutList({ checkouts, onReturn, overdue }) {
  return (
    <div className="inv-checkout-list">
      {checkouts.map((c) => (
        <div key={c.id} className={`inv-checkout-card${overdue ? ' inv-checkout-card--overdue' : ''}`}>
          <div className="inv-checkout-card-main">
            <span className="inv-item-name">{c.item_name}</span>
            <span className="inv-item-location">{c.athlete_name ?? 'Unknown athlete'} · {c.quantity} {c.unit}</span>
          </div>
          <div className="inv-checkout-card-meta">
            <span className="inv-item-updated">Checked out {formatDate(c.created_at?.split('T')[0])}</span>
            {c.due_date && (
              <span className={overdue ? 'inv-overdue-text' : 'inv-item-updated'}>
                {overdue ? `${daysOverdue(c.due_date)} day${daysOverdue(c.due_date) !== 1 ? 's' : ''} overdue` : `Due ${formatDate(c.due_date)}`}
              </span>
            )}
          </div>
          <button className="btn btn--sm btn--outline" onClick={() => onReturn(c)}>Return</button>
        </div>
      ))}
    </div>
  );
}

function CheckoutsTab({ active, overdue, onReturn }) {
  const overdueIds = new Set(overdue.map((c) => c.id));
  const activeOnly = active.filter((c) => !overdueIds.has(c.id));

  return (
    <div className="inv-checkouts-tab">
      <div className="inv-checkouts-section">
        <h2 className="inv-section-title">Overdue Checkouts ({overdue.length})</h2>
        {overdue.length === 0 ? <p className="state-msg--empty">No overdue checkouts.</p> : <CheckoutList checkouts={overdue} onReturn={onReturn} overdue />}
      </div>
      <div className="inv-checkouts-section">
        <h2 className="inv-section-title">Active Checkouts ({activeOnly.length})</h2>
        {activeOnly.length === 0 ? <p className="state-msg--empty">No active checkouts.</p> : <CheckoutList checkouts={activeOnly} onReturn={onReturn} />}
      </div>
    </div>
  );
}

// ── Controlled substances tab ────────────────────────────────────────

function ControlledTab({ items, athletes, staff, selectedId, onSelect, onAction, log, logLoading }) {
  const controlledItems = items.filter((i) => i.is_controlled_substance);
  const selected = controlledItems.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="inv-controlled-tab">
      <div className="inv-controlled-list">
        {controlledItems.length === 0 ? (
          <p className="state-msg--empty">No controlled substances on file.</p>
        ) : (
          controlledItems.map((item) => (
            <button
              key={item.id}
              className={`inv-controlled-row${item.id === selectedId ? ' inv-controlled-row--active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="inv-item-name">{item.name}</span>
              <span className="inv-item-location">{item.quantity_on_hand} {item.unit} on hand</span>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="inv-controlled-detail">
          <div className="inv-controlled-detail-header">
            <h3 className="inv-section-title" style={{ margin: 0 }}>{selected.name}</h3>
            <button className="btn btn--sm btn--outline" onClick={() => window.print()}>Print Log</button>
          </div>

          <div className="inv-detail-actions">
            <button className="btn btn--sm btn--primary" onClick={() => onAction('administer', selected)}>Administer</button>
            <button className="btn btn--sm btn--outline" onClick={() => onAction('waste', selected)}>Waste</button>
            <button className="btn btn--sm btn--outline" onClick={() => onAction('receive', selected)}>Receive</button>
          </div>

          <h4 className="inv-section-title">Audit Log</h4>
          {logLoading ? (
            <p className="state-msg--empty">Loading…</p>
          ) : log.length === 0 ? (
            <p className="state-msg--empty">No log entries yet.</p>
          ) : (
            <div className="inv-tx-table-wrap">
              <table className="inv-tx-table">
                <thead>
                  <tr><th>Date/Time</th><th>Type</th><th>Qty</th><th>Athlete</th><th>By</th><th>Witness</th><th>Lot</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {log.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.created_at).toLocaleString('en-US')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{l.transaction_type}</td>
                      <td>{l.quantity}</td>
                      <td>{l.athlete_name ?? '—'}</td>
                      <td>{l.administered_by_email ?? '—'}</td>
                      <td>{l.witness_email ?? '—'}</td>
                      <td>{l.lot_number ?? '—'}</td>
                      <td>{l.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function Inventory() {
  const { role } = useAuth();
  const canWrite = role !== 'coach';
  const canSeeControlled = role !== 'coach';

  const [tab, setTab] = useState('overview');
  const [items, setItems] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [checkoutsActive, setCheckoutsActive] = useState([]);
  const [checkoutsOverdue, setCheckoutsOverdue] = useState([]);
  const [alerts, setAlerts] = useState({ low_stock: [], overdue_checkouts: [], expiring_medications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [txModal, setTxModal] = useState(null); // { mode, item }
  const [returnModal, setReturnModal] = useState(null); // checkout row
  const [controlledId, setControlledId] = useState(null);
  const [controlledLog, setControlledLog] = useState([]);
  const [controlledLogLoading, setControlledLogLoading] = useState(false);
  const [controlledModal, setControlledModal] = useState(null); // { mode, item }

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/api/inventory'),
      api.get('/api/inventory/checkouts/active'),
      api.get('/api/inventory/checkouts/overdue'),
      api.get('/api/inventory/alerts'),
      api.get('/api/athletes'),
    ])
      .then(([itemsRes, activeRes, overdueRes, alertsRes, athletesRes]) => {
        setItems(itemsRes.data);
        setCheckoutsActive(activeRes.data);
        setCheckoutsOverdue(overdueRes.data);
        setAlerts(alertsRes.data);
        setAthletes(athletesRes.data);
      })
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load inventory.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!canSeeControlled) return;
    api.get('/api/school/staff').then(({ data }) => setStaff(data)).catch(() => {});
  }, [canSeeControlled]);

  useEffect(() => {
    if (!controlledId) { setControlledLog([]); return; }
    setControlledLogLoading(true);
    api.get(`/api/inventory/${controlledId}/controlled/log`)
      .then(({ data }) => setControlledLog(data))
      .catch(() => setControlledLog([]))
      .finally(() => setControlledLogLoading(false));
  }, [controlledId]);

  function upsertItem(updated) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === updated.id);
      return exists ? prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)) : [...prev, updated].sort((a, b) => a.name.localeCompare(b.name));
    });
    if (selectedItem?.id === updated.id) {
      setSelectedItem((prev) => ({ ...prev, ...updated }));
    }
  }

  function handleItemAdded(item) { upsertItem(item); }
  function handleItemEdited(item) { upsertItem(item); }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/inventory/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedItem(null);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  function handleTransactionDone(updatedItem) {
    upsertItem(updatedItem);
    loadAll();
  }

  function handleReturnDone(updatedItem) {
    upsertItem(updatedItem);
    loadAll();
  }

  function handleControlledActionDone() {
    loadAll();
    if (controlledId) {
      setControlledLogLoading(true);
      api.get(`/api/inventory/${controlledId}/controlled/log`)
        .then(({ data }) => setControlledLog(data))
        .catch(() => {})
        .finally(() => setControlledLogLoading(false));
    }
  }

  async function openSelectedItem(item) {
    try {
      const { data } = await api.get(`/api/inventory/${item.id}`);
      setSelectedItem(data);
    } catch {
      setSelectedItem({ ...item, transactions: [] });
    }
  }

  const checkoutsForSelected = selectedItem
    ? checkoutsActive.filter((c) => c.item_id === selectedItem.id)
    : [];

  return (
    <div className="inventory-page">
      <div className="inv-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Supplies, equipment, and medication tracking.</p>
        </div>
      </div>

      <div className="inv-tabs">
        <button className={`inv-tab${tab === 'overview' ? ' inv-tab--active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`inv-tab${tab === 'items' ? ' inv-tab--active' : ''}`} onClick={() => { setTab('items'); setSelectedItem(null); }}>Items</button>
        <button className={`inv-tab${tab === 'checkouts' ? ' inv-tab--active' : ''}`} onClick={() => setTab('checkouts')}>Checkouts</button>
        {canSeeControlled && (
          <button className={`inv-tab${tab === 'controlled' ? ' inv-tab--active' : ''}`} onClick={() => setTab('controlled')}>Controlled Substances</button>
        )}
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <>
          {tab === 'overview' && (
            <OverviewTab items={items} alerts={alerts} activeCheckoutCount={checkoutsActive.length} onGoTo={setTab} />
          )}

          {tab === 'items' && !selectedItem && (
            <ItemsTab
              items={items}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              onSelectItem={openSelectedItem}
              onAddItem={() => setShowAddModal(true)}
              canWrite={canWrite}
            />
          )}

          {tab === 'items' && selectedItem && (
            <ItemDetail
              item={selectedItem}
              checkoutsForItem={checkoutsForSelected}
              onBack={() => setSelectedItem(null)}
              onEdit={() => setEditingItem(selectedItem)}
              onDelete={() => handleDeleteItem(selectedItem)}
              onAction={(mode) => setTxModal({ mode, item: selectedItem })}
              onReturn={(checkout) => setReturnModal(checkout)}
              canWrite={canWrite}
              onGoToControlled={() => { setControlledId(selectedItem.id); setTab('controlled'); }}
            />
          )}

          {tab === 'checkouts' && (
            <CheckoutsTab active={checkoutsActive} overdue={checkoutsOverdue} onReturn={setReturnModal} />
          )}

          {tab === 'controlled' && canSeeControlled && (
            <ControlledTab
              items={items}
              athletes={athletes}
              staff={staff}
              selectedId={controlledId}
              onSelect={setControlledId}
              onAction={(mode, item) => setControlledModal({ mode, item })}
              log={controlledLog}
              logLoading={controlledLogLoading}
            />
          )}
        </>
      )}

      {showAddModal && (
        <ItemFormModal onClose={() => setShowAddModal(false)} onSaved={handleItemAdded} />
      )}
      {editingItem && (
        <ItemFormModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={handleItemEdited} />
      )}
      {txModal && (
        <TransactionModal
          mode={txModal.mode}
          item={txModal.item}
          athletes={athletes}
          onClose={() => setTxModal(null)}
          onDone={handleTransactionDone}
        />
      )}
      {returnModal && (
        <ReturnModal checkout={returnModal} onClose={() => setReturnModal(null)} onDone={handleReturnDone} />
      )}
      {controlledModal && (
        <ControlledActionModal
          mode={controlledModal.mode}
          item={controlledModal.item}
          athletes={athletes}
          staff={staff}
          onClose={() => setControlledModal(null)}
          onDone={handleControlledActionDone}
        />
      )}
    </div>
  );
}
