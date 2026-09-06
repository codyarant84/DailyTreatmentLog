import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import { formatDate } from '../../lib/dateUtils.js';
import { ClockIcon, CheckCircleIcon } from '../../components/Icons.jsx';
import './PortalSchedule.css';

const BODY_PARTS = ['Head', 'Neck', 'Shoulder', 'Elbow', 'Wrist/Hand', 'Back', 'Hip', 'Knee', 'Ankle/Foot', 'Other'];

const STATUS_META = {
  pending:   { label: 'Pending Approval', bg: '#fef3c7', color: '#92400e' },
  approved:  { label: 'Confirmed',        bg: '#d1fae5', color: '#065f46' },
  denied:    { label: 'Denied',           bg: '#fee2e2', color: '#991b1b' },
  cancelled: { label: 'Cancelled',        bg: '#f3f4f6', color: '#6b7280' },
};

function formatTimeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function PortalSchedule() {
  const { portalUser, getToken } = usePortalAuth();
  const navigate = useNavigate();
  const headers = useCallback(() => ({ Authorization: `Bearer ${getToken()}` }), [getToken]);

  useEffect(() => {
    if (portalUser && portalUser.role !== 'athlete') {
      navigate('/portal/home', { replace: true });
    }
  }, [portalUser, navigate]);

  const today   = todayStr();
  const maxDate = addDaysStr(today, 7);

  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots]               = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError]     = useState(null);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm]                 = useState({ reason: '', body_part: '', notes: '' });
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const [myRequests, setMyRequests]         = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const loadSlots = useCallback(async (date) => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const { data } = await api.get(`/api/schedule/available-slots?date=${date}`, { headers: headers() });
      setSlots(data);
    } catch (err) {
      setSlotsError(err.response?.data?.error ?? err.message);
    } finally {
      setSlotsLoading(false);
    }
  }, [headers]);

  const loadMyRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const { data } = await api.get('/api/schedule/my-requests', { headers: headers() });
      setMyRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRequestsLoading(false);
    }
  }, [headers]);

  useEffect(() => { loadSlots(selectedDate); }, [selectedDate, loadSlots]);
  useEffect(() => { loadMyRequests(); }, [loadMyRequests]);

  function handleSelectSlot(slot) {
    setSelectedSlot(slot);
    setForm({ reason: '', body_part: '', notes: '' });
    setSubmitError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.reason.trim()) { setSubmitError('Reason for visit is required.'); return; }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/schedule/request', {
        requested_date: selectedDate,
        requested_time: selectedSlot.time,
        reason:         form.reason.trim(),
        body_part:      form.body_part || null,
        notes:          form.notes.trim() || null,
      }, { headers: headers() });

      setConfirmation({ date: selectedDate, time: selectedSlot.time, status: data.status });
      setSelectedSlot(null);
      loadSlots(selectedDate);
      loadMyRequests();
    } catch (err) {
      setSubmitError(err.response?.data?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this appointment request?')) return;
    try {
      await api.delete(`/api/schedule/my-requests/${id}`, { headers: headers() });
      setMyRequests((prev) => prev.filter((r) => r.id !== id));
      loadSlots(selectedDate);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  return (
    <div className="ps-page">
      <header className="ps-header">
        <button className="ps-back-btn" onClick={() => navigate('/portal/home')}>&larr; Back</button>
        <span className="ps-brand">
          <span className="ps-brand-icon">+</span>
          <span className="ps-brand-name">Fieldside</span>
        </span>
      </header>

      <main className="ps-main">
        <h1 className="ps-title">Request Treatment</h1>

        <div className="ps-card">
          <label className="form-label" htmlFor="ps-date">Select a date</label>
          <input
            id="ps-date"
            type="date"
            className="form-input"
            value={selectedDate}
            min={today}
            max={maxDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
          />
          <p className="ps-hint">You can request an appointment up to 7 days in advance.</p>
        </div>

        {confirmation && (
          <div className="ps-confirmation">
            <span className="ps-confirmation-icon">
              {confirmation.status === 'approved' ? <CheckCircleIcon /> : <ClockIcon />}
            </span>
            <div className="ps-confirmation-body">
              <p className="ps-confirmation-title">
                {confirmation.status === 'approved' ? 'Confirmed!' : 'Request submitted — Pending Approval'}
              </p>
              <p className="ps-confirmation-detail">
                {formatDate(confirmation.date)} at {formatTimeLabel(confirmation.time)}
              </p>
            </div>
            <button className="ps-confirmation-close" onClick={() => setConfirmation(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        <div className="ps-card">
          <h2 className="ps-section-title">Available Times — {formatDate(selectedDate)}</h2>
          {slotsError && <div className="page-error">{slotsError}</div>}
          {slotsLoading ? (
            <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
          ) : slots.length === 0 ? (
            <p className="ps-empty">No availability on this date.</p>
          ) : (
            <div className="ps-slot-grid">
              {slots.map((s) => (
                <button
                  key={s.time}
                  className={`ps-slot-btn${s.is_full ? ' ps-slot-btn--full' : ''}${selectedSlot?.time === s.time ? ' ps-slot-btn--selected' : ''}`}
                  onClick={() => handleSelectSlot(s)}
                >
                  <span className="ps-slot-time">{formatTimeLabel(s.time)}</span>
                  <span className="ps-slot-remaining">
                    {s.is_full ? 'Full — Request Anyway' : `${s.remaining} spot${s.remaining !== 1 ? 's' : ''} left`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedSlot && (
          <div className="ps-card">
            <h2 className="ps-section-title">
              Request {formatTimeLabel(selectedSlot.time)} on {formatDate(selectedDate)}
            </h2>
            {selectedSlot.is_full && (
              <p className="ps-full-notice">This slot is full — your request will need AT approval.</p>
            )}
            <form className="ps-form" onSubmit={handleSubmit} noValidate>
              {submitError && <div className="form-error">{submitError}</div>}
              <div className="form-group">
                <label className="form-label">Reason for Visit <span className="required">*</span></label>
                <input
                  type="text" className="form-input" value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Ankle taping before practice" required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Body Part</label>
                <select
                  className="form-input" value={form.body_part}
                  onChange={(e) => setForm((p) => ({ ...p, body_part: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {BODY_PARTS.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input form-textarea" rows={2} value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Include teacher/class info if you'll need to be excused…"
                />
              </div>
              <div className="ps-form-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setSelectedSlot(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="ps-card">
          <h2 className="ps-section-title">My Upcoming Appointments</h2>
          {requestsLoading ? (
            <p className="ps-empty">Loading…</p>
          ) : myRequests.length === 0 ? (
            <p className="ps-empty">No upcoming appointments.</p>
          ) : (
            <div className="ps-request-list">
              {myRequests.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.cancelled;
                return (
                  <div key={r.id} className="ps-request-row">
                    <div className="ps-request-info">
                      <span className="ps-request-datetime">
                        {formatDate(r.requested_date)} at {formatTimeLabel(r.requested_time)}
                      </span>
                      <span className="ps-request-reason">
                        {r.reason}{r.body_part ? ` · ${r.body_part}` : ''}
                      </span>
                    </div>
                    <span className="ps-status-badge" style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    {(r.status === 'pending' || r.status === 'approved') && (
                      <button className="btn btn--sm btn--danger-ghost" onClick={() => handleCancel(r.id)}>
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
