import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import SelectWithOther from '../components/SelectWithOther.jsx';
import { BODY_PARTS, INJURY_TYPES } from '../lib/constants.js';
import './InjuryDetail.css';

// ── Constants ──────────────────────────────────────────────────────
const RTP_STATUSES = ['Full Participation', 'Limited Participation', 'Out', 'Cleared'];
const SEVERITIES   = ['Mild', 'Moderate', 'Severe'];
const MECHANISMS   = ['Contact', 'Non-contact', 'Overuse', 'Unknown'];

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

const EMPTY_SOAP = {
  chief_complaint:     '',
  mechanism_detail:    '',
  pain_scale:          '',
  symptom_description: '',
  relevant_history:    '',
  observation:         '',
  palpation:           '',
  range_of_motion:     '',
  special_tests:       '',
  strength_testing:    '',
  assessment:          '',
  severity:            '',
  differential:        '',
  treatment_plan:      '',
  referral:            '',
  rtp_timeline:        '',
  restrictions:        '',
  followup:            '',
};

// ── Helpers ────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ── Injury summary card ────────────────────────────────────────────
function InjurySummaryCard({ injury, onUpdate }) {
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [resolving, setResolving]     = useState(false);
  const [updatingRtp, setUpdatingRtp] = useState(false);
  const [error, setError]             = useState(null);
  const [form, setForm]               = useState({});

  function startEdit() {
    setForm({
      injury_date: injury.injury_date,
      body_part:   injury.body_part,
      injury_type: injury.injury_type,
      mechanism:   injury.mechanism   ?? '',
      severity:    injury.severity    ?? '',
      notes:       injury.notes       ?? '',
      rtp_status:  injury.rtp_status  ?? 'Out',
    });
    setError(null);
    setEditing(true);
  }

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.body_part)   { setError('Body part is required.'); return; }
    if (!form.injury_type) { setError('Injury type is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put(`/api/injuries/${injury.id}`, {
        injury_date: form.injury_date,
        body_part:   form.body_part,
        injury_type: form.injury_type,
        mechanism:   form.mechanism  || null,
        severity:    form.severity   || null,
        notes:       form.notes      || null,
        rtp_status:  form.rtp_status,
        is_active:   injury.is_active,
      });
      onUpdate(data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

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
    } finally {
      setUpdatingRtp(false);
    }
  }

  async function handleResolve() {
    if (!confirm('Mark this injury as resolved?')) return;
    setResolving(true);
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
    } finally {
      setResolving(false);
    }
  }

  const days = daysSince(injury.injury_date);
  const sevStyle = SEVERITY_COLORS[injury.severity];
  const rtpStyle = RTP_COLORS[injury.rtp_status] ?? {};

  if (editing) {
    return (
      <div className="id-summary-card">
        <form className="id-edit-form no-print" onSubmit={handleSave} noValidate>
          {error && <div className="form-error">{error}</div>}

          <div className="id-edit-row">
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

          <div className="id-edit-row">
            <div className="form-group">
              <label className="form-label">Body Part <span className="required">*</span></label>
              <SelectWithOther
                options={BODY_PARTS}
                value={form.body_part}
                onChange={(v) => set('body_part', v)}
                placeholder="Select…"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Injury Type <span className="required">*</span></label>
              <SelectWithOther
                options={INJURY_TYPES}
                value={form.injury_type}
                onChange={(v) => set('injury_type', v)}
                placeholder="Select…"
              />
            </div>
          </div>

          <div className="id-edit-row">
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

          <div className="id-edit-actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--sm btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="id-summary-card print-injury-summary">
      <div className="id-summary-top">
        <div className="id-athlete-block">
          <Link
            to={`/athletes/${encodeURIComponent(injury.athlete_name)}`}
            className="id-athlete-name"
          >
            {injury.athlete_name}
          </Link>
          {injury.athlete_sport && (
            <span className="id-sport-badge">{injury.athlete_sport}</span>
          )}
        </div>
        <div className="id-summary-badges">
          {injury.severity && sevStyle && (
            <span
              className="inj-badge"
              style={{ background: sevStyle.bg, color: sevStyle.color, borderColor: sevStyle.border }}
            >
              {injury.severity}
            </span>
          )}
          {!injury.is_active && (
            <span className="inj-badge inj-badge--resolved">Resolved</span>
          )}
        </div>
      </div>

      <div className="id-type-line">
        <strong>{injury.injury_type}</strong>
        <span className="id-sep">·</span>
        <span>{injury.body_part}</span>
        {injury.mechanism && (
          <>
            <span className="id-sep">·</span>
            <span className="id-mechanism">{injury.mechanism}</span>
          </>
        )}
        {injury.severity && (
          <>
            <span className="id-sep">·</span>
            <span className="id-mechanism">{injury.severity}</span>
          </>
        )}
      </div>

      <div className="id-meta-row">
        <span className="id-date">{formatDate(injury.injury_date)}</span>
        {days !== null && (
          <span className="id-days">
            {days === 0 ? 'Today' : `${days} day${days !== 1 ? 's' : ''} ago`}
          </span>
        )}
      </div>

      {injury.notes && <p className="id-notes">{injury.notes}</p>}

      <div className="id-summary-footer no-print">
        <div className="id-rtp-row">
          <label className="id-rtp-label">RTP Status</label>
          <select
            className="id-rtp-select"
            value={injury.rtp_status}
            onChange={handleRtpChange}
            disabled={updatingRtp}
            style={{
              background:  rtpStyle.bg    ?? '#f3f4f6',
              color:       rtpStyle.color ?? '#374151',
              borderColor: rtpStyle.border ?? '#d1d5db',
            }}
          >
            {RTP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="id-footer-actions">
          <button className="btn btn--sm btn--ghost" onClick={startEdit}>Edit</button>
          {injury.is_active && (
            <button
              className="btn btn--sm btn--ghost"
              onClick={handleResolve}
              disabled={resolving}
            >
              {resolving ? 'Resolving…' : 'Resolve'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SOAP note card ─────────────────────────────────────────────────
function SoapField({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="soap-field">
      <span className="soap-field-label">{label}</span>
      <span className="soap-field-value">{value}</span>
    </div>
  );
}

function SoapSection({ letter, title, children }) {
  return (
    <div className={`soap-section soap-section--${letter.toLowerCase()}`}>
      <div className="soap-section-header">
        <span className="soap-section-letter">{letter}</span>
        <span className="soap-section-title">{title}</span>
      </div>
      <div className="soap-section-body">{children}</div>
    </div>
  );
}

function SoapNoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this SOAP note?')) return;
    try {
      await api.delete(`/api/soap-notes/${note.id}`);
      onDelete(note.id);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  return (
    <div className="soap-note-card print-soap-note">
      <div className="soap-note-card-header" onClick={() => setExpanded((e) => !e)}>
        <div className="soap-note-card-meta">
          <span className="soap-note-date">{formatDateTime(note.authored_at)}</span>
          {note.author_name && (
            <span className="soap-note-author">by {note.author_name}</span>
          )}
          <span className="soap-note-version">v{note.version ?? 1}</span>
        </div>
        <div className="soap-note-card-right no-print">
          <button
            className="btn btn--sm btn--ghost"
            onClick={(e) => { e.stopPropagation(); onEdit(note); }}
          >
            Edit
          </button>
          <button
            className="btn btn--sm btn--danger-ghost"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            Delete
          </button>
          <span className={`soap-chevron${expanded ? ' soap-chevron--open' : ''}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="soap-note-body">
          {note.note_type === 'simple' ? (
            <p className="soap-simple-text">{note.chief_complaint}</p>
          ) : (<>
          <SoapSection letter="S" title="Subjective">
            <SoapField label="Chief Complaint"      value={note.chief_complaint} />
            <SoapField label="Mechanism Detail"     value={note.mechanism_detail} />
            <SoapField label="Pain Scale"           value={note.pain_scale != null ? `${note.pain_scale} / 10` : null} />
            <SoapField label="Symptoms"             value={note.symptom_description} />
            <SoapField label="Relevant History"     value={note.relevant_history} />
          </SoapSection>

          <SoapSection letter="O" title="Objective">
            <SoapField label="Observation"          value={note.observation} />
            <SoapField label="Palpation"            value={note.palpation} />
            <SoapField label="Range of Motion"      value={note.range_of_motion} />
            <SoapField label="Special Tests"        value={note.special_tests} />
            <SoapField label="Strength Testing"     value={note.strength_testing} />
          </SoapSection>

          <SoapSection letter="A" title="Assessment">
            <SoapField label="Assessment/Impression" value={note.assessment} />
            <SoapField label="Severity"              value={note.severity} />
            <SoapField label="Differential"          value={note.differential} />
          </SoapSection>

          <SoapSection letter="P" title="Plan">
            <SoapField label="Treatment Plan"       value={note.treatment_plan} />
            <SoapField label="Referral"             value={note.referral} />
            <SoapField label="RTP Timeline"         value={note.rtp_timeline} />
            <SoapField label="Restrictions"         value={note.restrictions} />
            <SoapField label="Follow-up"            value={note.followup} />
          </SoapSection>
          </>)}
        </div>
      )}
    </div>
  );
}

// ── SOAP note form ─────────────────────────────────────────────────
function SoapNoteForm({ injuryId, athleteId, editingNote, onSaved, onCancel }) {
  const [noteType, setNoteType] = useState(editingNote?.note_type ?? 'simple');
  const [form, setForm] = useState(
    editingNote
      ? {
          chief_complaint:     editingNote.chief_complaint     ?? '',
          mechanism_detail:    editingNote.mechanism_detail    ?? '',
          pain_scale:          editingNote.pain_scale          ?? '',
          symptom_description: editingNote.symptom_description ?? '',
          relevant_history:    editingNote.relevant_history    ?? '',
          observation:         editingNote.observation         ?? '',
          palpation:           editingNote.palpation           ?? '',
          range_of_motion:     editingNote.range_of_motion     ?? '',
          special_tests:       editingNote.special_tests       ?? '',
          strength_testing:    editingNote.strength_testing    ?? '',
          assessment:          editingNote.assessment          ?? '',
          severity:            editingNote.severity            ?? '',
          differential:        editingNote.differential        ?? '',
          treatment_plan:      editingNote.treatment_plan      ?? '',
          referral:            editingNote.referral            ?? '',
          rtp_timeline:        editingNote.rtp_timeline        ?? '',
          restrictions:        editingNote.restrictions        ?? '',
          followup:            editingNote.followup            ?? '',
        }
      : { ...EMPTY_SOAP }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        injury_id:  injuryId,
        athlete_id: athleteId,
        note_type:  noteType,
        pain_scale: form.pain_scale !== '' ? Number(form.pain_scale) : null,
      };
      const { data } = editingNote
        ? await api.put(`/api/soap-notes/${editingNote.id}`, payload)
        : await api.post('/api/soap-notes', payload);
      onSaved(data, Boolean(editingNote));
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  function ta(field, placeholder = '', rows = 3) {
    return (
      <textarea
        className="form-input form-textarea"
        rows={rows}
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <form className="soap-form no-print" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div className="soap-type-toggle">
        <button
          type="button"
          className={`soap-toggle-btn${noteType === 'simple' ? ' soap-toggle-btn--active' : ''}`}
          onClick={() => setNoteType('simple')}
        >
          Simple
        </button>
        <button
          type="button"
          className={`soap-toggle-btn${noteType === 'full' ? ' soap-toggle-btn--active' : ''}`}
          onClick={() => setNoteType('full')}
        >
          Full
        </button>
      </div>

      {noteType === 'simple' ? (
        <div className="form-group">
          <label className="form-label">SOAP Note</label>
          <textarea
            className="form-input form-textarea soap-simple-textarea"
            value={form.chief_complaint}
            onChange={(e) => set('chief_complaint', e.target.value)}
            placeholder="Enter your SOAP note here..."
          />
        </div>
      ) : (<>

      {/* S — Subjective */}
      <div className="soap-form-section soap-form-section--s">
        <div className="soap-form-section-header">
          <span className="soap-section-letter">S</span>
          <span className="soap-section-title">Subjective</span>
        </div>
        <div className="soap-form-fields">
          <div className="form-group">
            <label className="form-label">Chief Complaint</label>
            {ta('chief_complaint', "What is the athlete's main complaint?")}
          </div>
          <div className="form-group">
            <label className="form-label">Mechanism Detail</label>
            {ta('mechanism_detail', 'Describe how the injury occurred…')}
          </div>
          <div className="form-group">
            <label className="form-label">Pain Scale (0–10)</label>
            <div className="pain-scale-row">
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={form.pain_scale === '' ? 0 : Number(form.pain_scale)}
                onChange={(e) => set('pain_scale', e.target.value)}
                className="pain-slider"
              />
              <span className="pain-scale-value">
                {form.pain_scale !== '' ? form.pain_scale : '—'} / 10
              </span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Symptom Description</label>
            {ta('symptom_description', 'Describe symptoms in detail…')}
          </div>
          <div className="form-group">
            <label className="form-label">Relevant History</label>
            {ta('relevant_history', 'Prior injuries, surgeries, or relevant medical history…')}
          </div>
        </div>
      </div>

      {/* O — Objective */}
      <div className="soap-form-section soap-form-section--o">
        <div className="soap-form-section-header">
          <span className="soap-section-letter">O</span>
          <span className="soap-section-title">Objective</span>
        </div>
        <div className="soap-form-fields">
          <div className="form-group">
            <label className="form-label">Observation</label>
            {ta('observation', 'Visual findings — swelling, bruising, posture, gait…')}
          </div>
          <div className="form-group">
            <label className="form-label">Palpation</label>
            {ta('palpation', 'Tenderness, temperature, crepitus…')}
          </div>
          <div className="form-group">
            <label className="form-label">Range of Motion</label>
            {ta('range_of_motion', 'Active and passive ROM measurements…')}
          </div>
          <div className="form-group">
            <label className="form-label">Special Tests</label>
            {ta('special_tests', 'e.g. Lachman — positive, McMurray — negative')}
          </div>
          <div className="form-group">
            <label className="form-label">Strength Testing</label>
            {ta('strength_testing', 'Manual muscle testing grades…')}
          </div>
        </div>
      </div>

      {/* A — Assessment */}
      <div className="soap-form-section soap-form-section--a">
        <div className="soap-form-section-header">
          <span className="soap-section-letter">A</span>
          <span className="soap-section-title">Assessment</span>
        </div>
        <div className="soap-form-fields">
          <div className="form-group">
            <label className="form-label">Assessment / Impression</label>
            {ta('assessment', 'Clinical impression and diagnosis…')}
          </div>
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select
              className="form-input"
              value={form.severity}
              onChange={(e) => set('severity', e.target.value)}
            >
              <option value="">Not specified</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Differential Diagnosis <span className="form-optional">(optional)</span></label>
            {ta('differential', 'Alternative diagnoses to consider…')}
          </div>
        </div>
      </div>

      {/* P — Plan */}
      <div className="soap-form-section soap-form-section--p">
        <div className="soap-form-section-header">
          <span className="soap-section-letter">P</span>
          <span className="soap-section-title">Plan</span>
        </div>
        <div className="soap-form-fields">
          <div className="form-group">
            <label className="form-label">Treatment Plan</label>
            {ta('treatment_plan', 'Modalities, exercises, interventions…')}
          </div>
          <div className="form-group">
            <label className="form-label">Referral <span className="form-optional">(optional)</span></label>
            {ta('referral', 'e.g. Referred to Dr. Smith for MRI')}
          </div>
          <div className="form-group">
            <label className="form-label">RTP Timeline</label>
            {ta('rtp_timeline', 'e.g. 2–3 weeks pending swelling resolution')}
          </div>
          <div className="form-group">
            <label className="form-label">Restrictions</label>
            {ta('restrictions', 'Activity limitations and precautions…')}
          </div>
          <div className="form-group">
            <label className="form-label">Follow-up</label>
            {ta('followup', 'e.g. Re-evaluate in 3 days')}
          </div>
        </div>
      </div>

      </>)}

      <div className="soap-form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : editingNote ? 'Save Changes' : 'Save SOAP Note'}
        </button>
      </div>
    </form>
  );
}

// ── Print helpers ──────────────────────────────────────────────────
function PrintSection({ letter, title, fields }) {
  const populated = fields.filter((f) => f.value != null && f.value !== '');
  if (populated.length === 0) return null;
  return (
    <div className="print-soap-section">
      <div className="print-soap-section-header">{letter} — {title}</div>
      {populated.map((f) => (
        <div key={f.label} className="print-soap-field">
          <span className="print-soap-field-label">{f.label}:</span>
          <span className="print-soap-field-value">
            {f.label === 'Pain Scale' && f.value != null ? `${f.value} / 10` : f.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function InjuryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [injury, setInjury]       = useState(null);
  const [soapNotes, setSoapNotes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [injRes, notesRes] = await Promise.all([
        api.get(`/api/injuries/${id}`),
        api.get(`/api/soap-notes/injury/${id}`),
      ]);
      setInjury(injRes.data);
      setSoapNotes(notesRes.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleInjuryUpdate(updated) { setInjury(updated); }

  function handleSoapSaved(saved, isEdit) {
    setSoapNotes((prev) =>
      isEdit
        ? prev.map((n) => (n.id === saved.id ? saved : n))
        : [saved, ...prev]
    );
    setShowForm(false);
    setEditingNote(null);
  }

  function handleSoapDelete(noteId) {
    setSoapNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  function handleEdit(note) {
    setEditingNote(note);
    setShowForm(true);
    setTimeout(() => {
      document.querySelector('.soap-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingNote(null);
  }

  function handlePrint() {
    window.print();
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>;
  if (error)   return <div className="state-msg state-msg--error"><p>{error}</p></div>;
  if (!injury) return <div className="state-msg state-msg--empty"><p>Injury not found.</p></div>;

  return (
    <div className="injury-detail">

      {/* Back */}
      <div className="id-back no-print">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/injuries')}>
          ← Back to Injuries
        </button>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="print-header">
        <div className="print-header-brand">Fieldside Health</div>
        <div className="print-header-title">Injury & SOAP Note Report</div>
        <div className="print-header-date">Printed {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* Injury summary */}
      <InjurySummaryCard injury={injury} onUpdate={handleInjuryUpdate} />

      {/* SOAP Notes section */}
      <section className="soap-notes-section">
        <div className="soap-notes-header">
          <h2 className="soap-notes-title">SOAP Notes</h2>
          <div className="soap-notes-header-actions no-print">
            {soapNotes.length > 0 && (
              <button className="btn btn--outline btn--sm" onClick={handlePrint}>
                Print / Export PDF
              </button>
            )}
            <button
              className="btn btn--primary btn--sm"
              onClick={() => { setEditingNote(null); setShowForm((v) => !v); }}
            >
              {showForm && !editingNote ? 'Cancel' : '+ New SOAP Note'}
            </button>
          </div>
        </div>

        {/* Inline form */}
        {showForm && (
          <SoapNoteForm
            injuryId={injury.id}
            athleteId={injury.athlete_id}
            editingNote={editingNote}
            onSaved={handleSoapSaved}
            onCancel={handleCancelForm}
          />
        )}

        {/* Note list */}
        {soapNotes.length === 0 && !showForm ? (
          <div className="section-empty soap-empty">
            <p>No SOAP notes yet for this injury.</p>
            <button className="btn btn--primary btn--sm" onClick={() => setShowForm(true)}>
              + New SOAP Note
            </button>
          </div>
        ) : (
          <div className="soap-note-list">
            {soapNotes.map((note) => (
              <SoapNoteCard
                key={note.id}
                note={note}
                onEdit={handleEdit}
                onDelete={handleSoapDelete}
              />
            ))}
          </div>
        )}

        {/* Print-only SOAP notes (all notes, always expanded) */}
        <div className="print-soap-notes">
          {soapNotes.map((note, i) => (
            <div key={note.id} className="print-soap-note-block">
              {soapNotes.length > 1 && (
                <div className="print-soap-note-index">Note {soapNotes.length - i} of {soapNotes.length}</div>
              )}
              <div className="print-soap-note-meta">
                <span>{formatDateTime(note.authored_at)}</span>
                {note.author_name && <span> · {note.author_name}</span>}
                <span> · Version {note.version ?? 1}</span>
              </div>
              <PrintSection letter="S" title="Subjective" fields={[
                { label: 'Chief Complaint',      value: note.chief_complaint },
                { label: 'Mechanism Detail',     value: note.mechanism_detail },
                { label: 'Pain Scale',           value: note.pain_scale },
                { label: 'Symptom Description',  value: note.symptom_description },
                { label: 'Relevant History',     value: note.relevant_history },
              ]} />
              <PrintSection letter="O" title="Objective" fields={[
                { label: 'Observation',          value: note.observation },
                { label: 'Palpation',            value: note.palpation },
                { label: 'Range of Motion',      value: note.range_of_motion },
                { label: 'Special Tests',        value: note.special_tests },
                { label: 'Strength Testing',     value: note.strength_testing },
              ]} />
              <PrintSection letter="A" title="Assessment" fields={[
                { label: 'Assessment/Impression', value: note.assessment },
                { label: 'Severity',              value: note.severity },
                { label: 'Differential',          value: note.differential },
              ]} />
              <PrintSection letter="P" title="Plan" fields={[
                { label: 'Treatment Plan',        value: note.treatment_plan },
                { label: 'Referral',              value: note.referral },
                { label: 'RTP Timeline',          value: note.rtp_timeline },
                { label: 'Restrictions',          value: note.restrictions },
                { label: 'Follow-up',             value: note.followup },
              ]} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
