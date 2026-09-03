import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api.js';
import { formatDate } from '../lib/dateUtils.js';
import './Schedule.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_META = {
  pending:   { label: 'Pending',   bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  approved:  { label: 'Approved',  bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  denied:    { label: 'Denied',    bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  cancelled: { label: 'Cancelled', bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.cancelled;
  return (
    <span className="sched-badge" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
      {meta.label}
    </span>
  );
}

function formatTimeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTimeRange(start, end) {
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
}

// reviewed_at is a timestamptz — parse it directly, do NOT route through the
// date-only formatDate utility (that would read the UTC calendar date instead
// of the local one).
function formatTimestamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── Slot detail modal (Calendar tab) ────────────────────────────────
function SlotDetailModal({ date, slot, onClose }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{formatDate(date)} at {formatTimeLabel(slot.time)}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sched-slot-detail-body">
          <p className="sched-slot-capacity">{slot.booked} / {slot.max_athletes_per_slot} booked</p>
          {slot.bookings.length === 0 ? (
            <p className="sched-day-empty">No athletes booked in this slot.</p>
          ) : (
            <div className="sched-slot-bookings">
              {slot.bookings.map((b) => (
                <div key={b.id} className="sched-slot-booking-row">
                  <div className="sched-slot-booking-info">
                    <span className="sched-slot-booking-name">{b.athlete_name}</span>
                    <span className="sched-slot-booking-reason">
                      {b.reason}{b.body_part ? ` · ${b.body_part}` : ''}
                    </span>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Calendar ──────────────────────────────────────────────────
function CalendarTab() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [days, setDays]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selected, setSelected]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/schedule/calendar?start_date=${weekStart}`);
      setDays(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const allTimes = useMemo(() => {
    const set = new Set();
    days.forEach((d) => d.slots.forEach((s) => set.add(s.time)));
    return [...set].sort();
  }, [days]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="sched-calendar-tab">
      <div className="sched-week-nav">
        <button className="btn btn--sm btn--ghost" onClick={() => setWeekStart((p) => addDaysStr(p, -7))}>← Prev</button>
        <span className="sched-week-label">
          {formatDate(weekStart)} – {formatDate(addDaysStr(weekStart, 6))}
        </span>
        <button className="btn btn--sm btn--ghost" onClick={() => setWeekStart((p) => addDaysStr(p, 7))}>Next →</button>
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      ) : allTimes.length === 0 ? (
        <div className="state-msg state-msg--empty"><p>No availability configured for this week.</p></div>
      ) : (
        <div className="sched-grid-wrap">
          <table className="sched-calendar-table">
            <thead>
              <tr>
                <th className="sched-time-col" />
                {days.map((d) => (
                  <th key={d.date} className={`sched-day-th${d.date === today ? ' sched-day-th--today' : ''}`}>
                    <span className="sched-day-name">{DAY_ABBR[d.day_of_week]}</span>
                    <span className="sched-day-date">{formatDate(d.date, { year: undefined })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimes.map((time) => (
                <tr key={time}>
                  <td className="sched-time-col">{formatTimeLabel(time)}</td>
                  {days.map((d) => {
                    const slot = d.slots.find((s) => s.time === time);
                    if (!slot) return <td key={d.date} className="sched-cell sched-cell--empty" />;
                    const level = slot.is_full
                      ? 'full'
                      : slot.booked >= slot.max_athletes_per_slot * 0.5
                        ? 'filling'
                        : 'open';
                    return (
                      <td
                        key={d.date}
                        className={`sched-cell sched-cell--${level}`}
                        onClick={() => setSelected({ date: d.date, slot })}
                      >
                        {slot.booked}/{slot.max_athletes_per_slot}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <SlotDetailModal date={selected.date} slot={selected.slot} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ── Tab 2: Requests ──────────────────────────────────────────────────
function DenyModal({ request, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onConfirm(reason.trim() || null);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Deny Request</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="sched-deny-summary">
            {request.athlete_name} · {formatDate(request.requested_date)} at {formatTimeLabel(request.requested_time)}
          </p>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-input form-textarea" rows={3}
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Let the athlete know why…"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Denying…' : 'Deny Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_FILTERS = ['all', 'pending', 'approved', 'denied'];

function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');
  const [denyTarget, setDenyTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/schedule/requests');
      setRequests(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    try {
      const { data } = await api.put(`/api/schedule/requests/${id}/approve`);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  async function handleDeny(id, reason) {
    try {
      const { data } = await api.put(`/api/schedule/requests/${id}/deny`, { reason });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    } finally {
      setDenyTarget(null);
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="sched-requests-tab">
      <div className="sched-filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            className={`sched-filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>No {filter === 'all' ? '' : `${filter} `}requests.</p>
        </div>
      ) : (
        <div className="sched-request-list">
          {filtered.map((r) => (
            <div key={r.id} className="sched-request-card">
              <div className="sched-request-main">
                <div className="sched-request-top">
                  <span className="sched-request-athlete">{r.athlete_name}</span>
                  <StatusBadge status={r.status} />
                </div>
                <span className="sched-request-datetime">
                  {formatDate(r.requested_date)} at {formatTimeLabel(r.requested_time)}
                </span>
                <p className="sched-request-reason">
                  {r.reason}{r.body_part ? ` · ${r.body_part}` : ''}
                </p>
                {r.notes && <p className="sched-request-notes">{r.notes}</p>}
                {r.status !== 'pending' && r.reviewed_by_email && (
                  <p className="sched-request-reviewed">
                    Reviewed by {r.reviewed_by_email} on {formatTimestamp(r.reviewed_at)}
                  </p>
                )}
              </div>
              {r.status === 'pending' && (
                <div className="sched-request-actions">
                  <button className="btn btn--sm btn--primary" onClick={() => handleApprove(r.id)}>Approve</button>
                  <button className="btn btn--sm btn--danger-ghost" onClick={() => setDenyTarget(r)}>Deny</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {denyTarget && (
        <DenyModal
          request={denyTarget}
          onClose={() => setDenyTarget(null)}
          onConfirm={(reason) => handleDeny(denyTarget.id, reason)}
        />
      )}
    </div>
  );
}

// ── Tab 3: Availability Settings ─────────────────────────────────────
function AvailabilityFormModal({ mode, block, presetDayOfWeek, onClose, onSaved }) {
  const isEdit = Boolean(block);
  const dayOfWeek = block?.day_of_week ?? presetDayOfWeek;
  const [form, setForm] = useState({
    specific_date:          block?.specific_date ?? '',
    start_time:             block?.start_time ?? '08:00',
    end_time:               block?.end_time ?? '16:00',
    slot_duration_minutes:  block?.slot_duration_minutes ?? 15,
    max_athletes_per_slot:  block?.max_athletes_per_slot ?? 3,
    is_available:           block?.is_available ?? true,
  });
  const [blockEntireDay, setBlockEntireDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  function toggleBlockEntireDay(checked) {
    setBlockEntireDay(checked);
    if (checked) {
      setForm((p) => ({ ...p, start_time: '00:00', end_time: '23:59', is_available: false }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'override' && !form.specific_date) { setError('Date is required.'); return; }
    if (!form.start_time || !form.end_time) { setError('Start and end time are required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        day_of_week:            mode === 'recurring' ? dayOfWeek : null,
        specific_date:          mode === 'override' ? form.specific_date : null,
        start_time:             form.start_time,
        end_time:               form.end_time,
        slot_duration_minutes:  Number(form.slot_duration_minutes),
        max_athletes_per_slot:  Number(form.max_athletes_per_slot),
        is_recurring:           mode === 'recurring',
        is_available:           mode === 'recurring' ? true : form.is_available,
      };
      const { data } = isEdit
        ? await api.put(`/api/schedule/availability/${block.id}`, payload)
        : await api.post('/api/schedule/availability', payload);
      onSaved(data, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'recurring'
              ? `${isEdit ? 'Edit' : 'Add'} ${DAY_NAMES[dayOfWeek]} Availability`
              : `${isEdit ? 'Edit' : 'Add'} One-off Override`}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          {mode === 'override' && (
            <div className="form-group">
              <label className="form-label">Date <span className="required">*</span></label>
              <input
                type="date" className="form-input"
                value={form.specific_date} onChange={(e) => set('specific_date', e.target.value)}
                required
              />
            </div>
          )}

          {mode === 'override' && (
            <label className="sched-checkbox-row">
              <input type="checkbox" checked={blockEntireDay} onChange={(e) => toggleBlockEntireDay(e.target.checked)} />
              Block the entire day (e.g. game day)
            </label>
          )}

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Start Time <span className="required">*</span></label>
              <input
                type="time" className="form-input" value={form.start_time}
                onChange={(e) => set('start_time', e.target.value)} required disabled={blockEntireDay}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time <span className="required">*</span></label>
              <input
                type="time" className="form-input" value={form.end_time}
                onChange={(e) => set('end_time', e.target.value)} required disabled={blockEntireDay}
              />
            </div>
          </div>

          {!blockEntireDay && (
            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">Slot Duration (minutes)</label>
                <input
                  type="number" min="5" step="5" className="form-input"
                  value={form.slot_duration_minutes} onChange={(e) => set('slot_duration_minutes', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Athletes per Slot</label>
                <input
                  type="number" min="1" className="form-input"
                  value={form.max_athletes_per_slot} onChange={(e) => set('max_athletes_per_slot', e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === 'override' && !blockEntireDay && (
            <label className="sched-checkbox-row">
              <input type="checkbox" checked={form.is_available} onChange={(e) => set('is_available', e.target.checked)} />
              This is extra availability (uncheck to block this time range instead)
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurringGrid({ availability, onAdd, onEdit, onDelete }) {
  const recurring = availability.filter((a) => a.is_recurring);
  return (
    <div className="sched-recurring-grid">
      {DAY_NAMES.map((label, dow) => {
        const blocks = recurring.filter((a) => a.day_of_week === dow);
        return (
          <div key={dow} className="sched-day-column">
            <div className="sched-day-header">
              <span>{label}</span>
              <button className="btn btn--sm btn--outline" onClick={() => onAdd(dow)}>+ Add</button>
            </div>
            {blocks.length === 0 ? (
              <p className="sched-day-empty">No availability</p>
            ) : (
              blocks.map((b) => (
                <div key={b.id} className="sched-block-card">
                  <span className="sched-block-time">{formatTimeRange(b.start_time, b.end_time)}</span>
                  <span className="sched-block-meta">{b.slot_duration_minutes}min slots · max {b.max_athletes_per_slot}</span>
                  <div className="sched-block-actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => onEdit(b)}>Edit</button>
                    <button className="btn btn--sm btn--danger-ghost" onClick={() => onDelete(b.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverridesList({ availability, onAdd, onEdit, onDelete }) {
  const overrides = availability.filter((a) => !a.is_recurring && a.specific_date);
  return (
    <div className="sched-overrides">
      <div className="sched-overrides-header">
        <h2 className="sched-section-title">One-off Overrides</h2>
        <button className="btn btn--sm btn--primary" onClick={() => onAdd()}>+ Add Override</button>
      </div>
      {overrides.length === 0 ? (
        <p className="sched-day-empty">No one-off overrides.</p>
      ) : (
        <div className="sched-override-list">
          {overrides.map((o) => (
            <div key={o.id} className="sched-override-card">
              <div className="sched-override-main">
                <span className="sched-override-date">{formatDate(o.specific_date)}</span>
                <span className={`sched-override-badge${o.is_available ? ' sched-override-badge--add' : ' sched-override-badge--block'}`}>
                  {o.is_available ? 'Extra availability' : 'Blocked'}
                </span>
                <span className="sched-block-meta">{formatTimeRange(o.start_time, o.end_time)}</span>
              </div>
              <div className="sched-block-actions">
                <button className="btn btn--sm btn--ghost" onClick={() => onEdit(o)}>Edit</button>
                <button className="btn btn--sm btn--danger-ghost" onClick={() => onDelete(o.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AvailabilityTab() {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [modalState, setModalState]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/schedule/availability');
      setAvailability(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    setAvailability((prev) => (isEdit ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]));
  }

  async function handleDelete(id) {
    if (!confirm('Delete this availability block?')) return;
    try {
      await api.delete(`/api/schedule/availability/${id}`);
      setAvailability((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>;

  return (
    <div className="sched-availability-tab">
      {error && <div className="page-error">{error}</div>}

      <div className="sched-recurring-section">
        <h2 className="sched-section-title">Recurring Weekly Schedule</h2>
        <p className="sched-section-desc">Set up the hours you're available each week. This repeats automatically.</p>
        <RecurringGrid
          availability={availability}
          onAdd={(dow) => setModalState({ mode: 'recurring', block: null, presetDayOfWeek: dow })}
          onEdit={(block) => setModalState({ mode: 'recurring', block })}
          onDelete={handleDelete}
        />
      </div>

      <OverridesList
        availability={availability}
        onAdd={() => setModalState({ mode: 'override', block: null })}
        onEdit={(block) => setModalState({ mode: 'override', block })}
        onDelete={handleDelete}
      />

      {modalState && (
        <AvailabilityFormModal
          mode={modalState.mode}
          block={modalState.block}
          presetDayOfWeek={modalState.presetDayOfWeek}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function Schedule() {
  const [mainTab, setMainTab] = useState('calendar');

  return (
    <div className="sched-page">
      <div className="sched-header">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">Manage availability and review treatment requests.</p>
      </div>

      <div className="sched-tabs">
        <button className={`sched-tab${mainTab === 'calendar' ? ' active' : ''}`} onClick={() => setMainTab('calendar')}>
          Calendar
        </button>
        <button className={`sched-tab${mainTab === 'requests' ? ' active' : ''}`} onClick={() => setMainTab('requests')}>
          Requests
        </button>
        <button className={`sched-tab${mainTab === 'availability' ? ' active' : ''}`} onClick={() => setMainTab('availability')}>
          Availability Settings
        </button>
      </div>

      {mainTab === 'calendar' && <CalendarTab />}
      {mainTab === 'requests' && <RequestsTab />}
      {mainTab === 'availability' && <AvailabilityTab />}
    </div>
  );
}
