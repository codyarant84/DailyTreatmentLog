import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import './Injuries.css';

export const BODY_PARTS = [
  'Head / Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand / Fingers',
  'Chest', 'Upper Back', 'Lower Back', 'Hip', 'Groin', 'Quadriceps', 'Hamstring',
  'Knee', 'Shin', 'Calf', 'Ankle', 'Foot / Toes', 'Other',
];

export const INJURY_TYPES = [
  'Sprain', 'Strain', 'Contusion', 'Fracture', 'Tendinopathy', 'Overuse',
  'Laceration', 'Concussion', 'Other',
];

export const MECHANISMS = ['Contact', 'Non-contact', 'Overuse', 'Unknown'];

export const SEVERITIES = ['Mild', 'Moderate', 'Severe'];

export const RTP_STATUSES = ['Full Participation', 'Limited Participation', 'Out', 'Cleared'];

const RTP_COLORS = {
  'Full Participation':    { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'Limited Participation': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  'Out':                   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  'Cleared':               { bg: '#ede9fe', color: '#4c1d95', border: '#c4b5fd' },
};

const SEVERITY_COLORS = {
  'Mild':     { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'Moderate': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  'Severe':   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Badge({ label, colorMap }) {
  const style = colorMap?.[label];
  if (!style) return <span className="inj-badge">{label}</span>;
  return (
    <span
      className="inj-badge"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {label}
    </span>
  );
}

const EMPTY_FORM = {
  athlete_id: '',
  injury_date: new Date().toISOString().split('T')[0],
  body_part: '',
  injury_type: '',
  mechanism: '',
  severity: '',
  rtp_status: 'Out',
  notes: '',
};

function InjuryFormModal({ injury, athletes, onClose, onSaved }) {
  const isEdit = Boolean(injury);
  const [form, setForm] = useState(
    isEdit
      ? {
          athlete_id:  injury.athlete_id,
          injury_date: injury.injury_date,
          body_part:   injury.body_part,
          injury_type: injury.injury_type,
          mechanism:   injury.mechanism   ?? '',
          severity:    injury.severity    ?? '',
          rtp_status:  injury.rtp_status  ?? 'Out',
          notes:       injury.notes       ?? '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.athlete_id)  { setError('Athlete is required.'); return; }
    if (!form.injury_date) { setError('Injury date is required.'); return; }
    if (!form.body_part)   { setError('Body part is required.'); return; }
    if (!form.injury_type) { setError('Injury type is required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        mechanism:  form.mechanism  || null,
        severity:   form.severity   || null,
        notes:      form.notes      || null,
      };
      const { data } = isEdit
        ? await api.put(`/api/injuries/${injury.id}`, payload)
        : await api.post('/api/injuries', payload);
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
          <h2 className="modal-title">{isEdit ? 'Edit Injury' : 'Log New Injury'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Athlete <span className="required">*</span></label>
              <select
                className="form-input"
                value={form.athlete_id}
                onChange={(e) => set('athlete_id', e.target.value)}
                required
              >
                <option value="">Select athlete…</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.sport ? ` — ${a.sport}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Injury Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={form.injury_date}
                onChange={(e) => set('injury_date', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">RTP Status</label>
              <select className="form-input" value={form.rtp_status} onChange={(e) => set('rtp_status', e.target.value)}>
                {RTP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Body Part <span className="required">*</span></label>
              <select className="form-input" value={form.body_part} onChange={(e) => set('body_part', e.target.value)} required>
                <option value="">Select…</option>
                {BODY_PARTS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Injury Type <span className="required">*</span></label>
              <select className="form-input" value={form.injury_type} onChange={(e) => set('injury_type', e.target.value)} required>
                <option value="">Select…</option>
                {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Mechanism</label>
              <select className="form-input" value={form.mechanism} onChange={(e) => set('mechanism', e.target.value)}>
                <option value="">Unknown</option>
                {MECHANISMS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select className="form-input" value={form.severity} onChange={(e) => set('severity', e.target.value)}>
                <option value="">Not specified</option>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input form-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Mechanism of injury, initial assessment, follow-up plan…"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Injury'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InjuryCard({ injury, onUpdate, onDelete }) {
  const [updatingRtp, setUpdatingRtp] = useState(false);
  const days = daysSince(injury.injury_date);

  async function handleRtpChange(e) {
    const rtp_status = e.target.value;
    setUpdatingRtp(true);
    try {
      const { data } = await api.put(`/api/injuries/${injury.id}`, {
        injury_date: injury.injury_date,
        body_part:   injury.body_part,
        injury_type: injury.injury_type,
        mechanism:   injury.mechanism,
        severity:    injury.severity,
        notes:       injury.notes,
        is_active:   injury.is_active,
        rtp_status,
      });
      onUpdate(data);
    } catch {
      // silent — user will see no change
    } finally {
      setUpdatingRtp(false);
    }
  }

  async function handleResolve() {
    if (!confirm(`Mark this injury as resolved? It will be moved to the inactive list.`)) return;
    try {
      const { data } = await api.put(`/api/injuries/${injury.id}`, {
        injury_date: injury.injury_date,
        body_part:   injury.body_part,
        injury_type: injury.injury_type,
        mechanism:   injury.mechanism,
        severity:    injury.severity,
        notes:       injury.notes,
        rtp_status:  'Cleared',
        is_active:   false,
      });
      onUpdate(data);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete this injury record?`)) return;
    try {
      await api.delete(`/api/injuries/${injury.id}`);
      onDelete(injury.id);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  return (
    <div className={`inj-card ${!injury.is_active ? 'inj-card--resolved' : ''}`}>
      <div className="inj-card-header">
        <div className="inj-card-athlete-info">
          <Link
            to={`/athletes/${encodeURIComponent(injury.athlete_name)}`}
            className="inj-athlete-name"
          >
            {injury.athlete_name}
          </Link>
          {injury.athlete_sport && (
            <span className="inj-sport-badge">{injury.athlete_sport}</span>
          )}
        </div>
        <div className="inj-card-badges">
          {injury.severity && <Badge label={injury.severity} colorMap={SEVERITY_COLORS} />}
        </div>
      </div>

      <div className="inj-type-line">
        <span className="inj-type">{injury.injury_type}</span>
        <span className="inj-sep">·</span>
        <span className="inj-body-part">{injury.body_part}</span>
        {injury.mechanism && (
          <>
            <span className="inj-sep">·</span>
            <span className="inj-mechanism">{injury.mechanism}</span>
          </>
        )}
      </div>

      <div className="inj-card-meta">
        <span className="inj-date">{formatDate(injury.injury_date)}</span>
        {days !== null && (
          <span className="inj-days">
            {days === 0 ? 'Today' : `${days} day${days !== 1 ? 's' : ''} ago`}
          </span>
        )}
      </div>

      {injury.notes && (
        <p className="inj-notes">{injury.notes}</p>
      )}

      <div className="inj-card-footer">
        <div className="inj-rtp-row">
          <label className="inj-rtp-label">RTP Status</label>
          <select
            className="inj-rtp-select"
            value={injury.rtp_status}
            onChange={handleRtpChange}
            disabled={updatingRtp}
            style={{
              background: RTP_COLORS[injury.rtp_status]?.bg ?? '#f3f4f6',
              color:      RTP_COLORS[injury.rtp_status]?.color ?? '#374151',
              borderColor: RTP_COLORS[injury.rtp_status]?.border ?? '#d1d5db',
            }}
          >
            {RTP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="inj-card-actions">
          {injury.is_active && (
            <button className="btn btn--sm btn--ghost" onClick={handleResolve}>Resolve</button>
          )}
          <button className="btn btn--sm btn--danger-ghost" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function Injuries() {
  const [injuries, setInjuries]   = useState([]);
  const [athletes, setAthletes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showAll, setShowAll]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [injRes, athRes] = await Promise.all([
        api.get('/api/injuries'),
        api.get('/api/athletes'),
      ]);
      setInjuries(injRes.data);
      setAthletes(athRes.data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    setInjuries((prev) =>
      isEdit
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev]
    );
  }

  function handleUpdate(updated) {
    setInjuries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleDelete(id) {
    setInjuries((prev) => prev.filter((i) => i.id !== id));
  }

  const displayed = showAll ? injuries : injuries.filter((i) => i.is_active);
  const activeCount = injuries.filter((i) => i.is_active).length;

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>;

  return (
    <div className="injuries-page">
      <div className="inj-header">
        <div>
          <h1 className="page-title">Injuries</h1>
          <p className="page-subtitle">
            Track active injuries and return-to-play status for your athletes.
          </p>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
            {activeCount} active injur{activeCount !== 1 ? 'ies' : 'y'}
            {injuries.length > activeCount && ` · ${injuries.length - activeCount} resolved`}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ Log Injury</button>
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="inj-filter-bar">
        <label className="inj-toggle-label">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Show resolved injuries
        </label>
      </div>

      {displayed.length === 0 && (
        <div className="state-msg state-msg--empty">
          <p>{showAll ? 'No injuries logged yet.' : 'No active injuries.'}</p>
          {!showAll && injuries.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowAll(true)}>
              Show resolved
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>Log First Injury</button>
        </div>
      )}

      <div className="inj-grid">
        {displayed.map((inj) => (
          <InjuryCard
            key={inj.id}
            injury={inj}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onEdit={() => setEditTarget(inj)}
          />
        ))}
      </div>

      {(showModal || editTarget) && (
        <InjuryFormModal
          injury={editTarget}
          athletes={athletes}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
