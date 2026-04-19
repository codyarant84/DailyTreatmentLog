import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import './ConcussionDetail.css';

const TOTAL_STEPS = 6;

const DEFAULT_STEPS = [
  'Symptom-limited activity',
  'Light aerobic exercise',
  'Sport-specific exercise',
  'Non-contact training',
  'Full-contact practice',
  'Return to competition',
];

const MECHANISMS = ['Contact', 'Non-contact', 'Unknown'];

const SYMPTOM_FIELDS = [
  { key: 'headache',               label: 'Headache',                category: 'Physical'  },
  { key: 'head_pressure',          label: 'Pressure in head',        category: 'Physical'  },
  { key: 'neck_pain',              label: 'Neck pain',               category: 'Physical'  },
  { key: 'nausea',                 label: 'Nausea / vomiting',       category: 'Physical'  },
  { key: 'dizziness',              label: 'Dizziness',               category: 'Physical'  },
  { key: 'blurred_vision',         label: 'Blurred vision',          category: 'Physical'  },
  { key: 'balance_problems',       label: 'Balance problems',        category: 'Physical'  },
  { key: 'light_sensitivity',      label: 'Light sensitivity',       category: 'Sensory'   },
  { key: 'noise_sensitivity',      label: 'Noise sensitivity',       category: 'Sensory'   },
  { key: 'feeling_slowed',         label: 'Feeling slowed down',     category: 'Cognitive' },
  { key: 'feeling_foggy',          label: 'Feeling in a fog',        category: 'Cognitive' },
  { key: 'concentration_problems', label: 'Difficulty concentrating',category: 'Cognitive' },
  { key: 'memory_problems',        label: 'Difficulty remembering',  category: 'Cognitive' },
  { key: 'fatigue',                label: 'Fatigue / low energy',    category: 'Cognitive' },
  { key: 'confusion',              label: 'Confusion',               category: 'Cognitive' },
  { key: 'drowsiness',             label: 'Drowsiness',              category: 'Cognitive' },
  { key: 'more_emotional',         label: 'More emotional',          category: 'Emotional' },
  { key: 'irritability',           label: 'Irritability',            category: 'Emotional' },
  { key: 'sadness',                label: 'Sadness',                 category: 'Emotional' },
  { key: 'nervous_anxious',        label: 'Nervous / anxious',       category: 'Emotional' },
  { key: 'trouble_sleeping',       label: 'Trouble sleeping',        category: 'Emotional' },
  { key: 'sleeping_more',          label: 'Sleeping more than usual',category: 'Emotional' },
];

const SYMPTOM_CATEGORIES = ['Physical', 'Sensory', 'Cognitive', 'Emotional'];

const BESS_FIELDS = [
  { key: 'double_leg_firm', label: 'Double leg – firm' },
  { key: 'single_leg_firm', label: 'Single leg – firm' },
  { key: 'tandem_firm',     label: 'Tandem – firm'     },
  { key: 'double_leg_foam', label: 'Double leg – foam' },
  { key: 'single_leg_foam', label: 'Single leg – foam' },
  { key: 'tandem_foam',     label: 'Tandem – foam'     },
];

// ── Helpers ────────────────────────────────────────────────────────
function computeSymptomScore(asm) {
  return SYMPTOM_FIELDS.reduce((s, { key }) => s + (Number(asm[key]) || 0), 0);
}

function symptomCount(asm) {
  return SYMPTOM_FIELDS.filter(({ key }) => (asm[key] ?? 0) > 0).length;
}

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

// ── Symptom Chart ──────────────────────────────────────────────────
function SymptomChart({ points }) {
  if (!points || points.length < 2) {
    return (
      <div className="cd-chart-empty">
        Add assessments or check-ins to see the symptom trend.
      </div>
    );
  }

  const W = 540, H = 160;
  const PAD = { top: 12, right: 16, bottom: 32, left: 38 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const ts  = sorted.map(p => new Date(p.date).getTime());
  const minT = ts[0], maxT = ts[ts.length - 1];
  const tRange = maxT - minT || 1;
  const maxScore = 132;

  const cx = (d) => PAD.left + ((new Date(d).getTime() - minT) / tRange) * iW;
  const cy = (s) => PAD.top + iH - (Math.min(s, maxScore) / maxScore) * iH;

  const polyline = sorted.map(p => `${cx(p.date)},${cy(p.score)}`).join(' ');
  const yTicks = [0, 44, 88, 132];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cd-chart" aria-label="Symptom score over time">
      {yTicks.map(v => (
        <g key={v}>
          <line
            x1={PAD.left} y1={cy(v)} x2={PAD.left + iW} y2={cy(v)}
            stroke="var(--color-border)" strokeWidth="1"
            strokeDasharray={v === 0 ? 'none' : '3,4'}
          />
          <text x={PAD.left - 5} y={cy(v) + 4} textAnchor="end" className="cd-chart-tick">{v}</text>
        </g>
      ))}
      <text x={cx(sorted[0].date)} y={H - 6} textAnchor="start" className="cd-chart-tick">
        {formatDate(sorted[0].date)}
      </text>
      {sorted.length > 1 && (
        <text x={cx(sorted[sorted.length - 1].date)} y={H - 6} textAnchor="end" className="cd-chart-tick">
          {formatDate(sorted[sorted.length - 1].date)}
        </text>
      )}
      <polyline points={polyline} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />
      {sorted.map((p, i) => (
        <circle key={i} cx={cx(p.date)} cy={cy(p.score)} r={4} fill="var(--color-primary)" />
      ))}
    </svg>
  );
}

// ── Assessment Card ────────────────────────────────────────────────
function AssessmentCard({ assessment }) {
  const [expanded, setExpanded] = useState(false);
  const isScat6 = !assessment.assessment_type || assessment.assessment_type === 'scat6';
  const isBess  = assessment.assessment_type === 'bess';
  const score   = computeSymptomScore(assessment);
  const count   = symptomCount(assessment);
  const bessTotal = BESS_FIELDS.reduce((s, { key }) => s + (Number(assessment[key]) || 0), 0);

  const scoreBg    = score === 0 ? '#d1fae5' : score < 30 ? '#fef3c7' : '#fee2e2';
  const scoreColor = score === 0 ? '#065f46' : score < 30 ? '#92400e' : '#991b1b';

  return (
    <div className="cd-assessment-card">
      <button className="cd-assessment-header" onClick={() => setExpanded(e => !e)}>
        <div className="cd-assessment-meta">
          <span className="cd-assessment-date">{formatDate(assessment.assessment_date)}</span>
          <span className="cd-assessment-type-badge">
            {(assessment.assessment_type ?? 'SCAT6').toUpperCase()}
          </span>
        </div>
        <div className="cd-assessment-scores">
          {isScat6 && (
            <>
              <span className="cd-score-chip" style={{ background: scoreBg, color: scoreColor }}>
                {score}/132
              </span>
              <span className="cd-score-count">{count} symptom{count !== 1 ? 's' : ''}</span>
            </>
          )}
          {isBess && (
            <span className="cd-score-chip" style={{ background: '#f3f4f6', color: '#374151' }}>
              {bessTotal} errors
            </span>
          )}
        </div>
        <span className="cd-expand-icon">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="cd-assessment-body">
          {isScat6 && SYMPTOM_CATEGORIES.map(cat => {
            const fields = SYMPTOM_FIELDS.filter(f => f.category === cat);
            return (
              <div key={cat} className="cd-cat-block">
                <div className="cd-cat-label">{cat}</div>
                <div className="cd-symptom-grid">
                  {fields.map(({ key, label }) => {
                    const val = Number(assessment[key]) || 0;
                    return (
                      <div key={key} className={`cd-symptom-row${val > 0 ? ' cd-symptom-row--active' : ''}`}>
                        <span className="cd-sym-label">{label}</span>
                        <span className="cd-sym-val">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isBess && (
            <div className="cd-bess-grid">
              {BESS_FIELDS.map(({ key, label }) => (
                <div key={key} className="cd-symptom-row">
                  <span className="cd-sym-label">{label}</span>
                  <span className="cd-sym-val">{Number(assessment[key]) || 0} errors</span>
                </div>
              ))}
              <div className="cd-symptom-row cd-symptom-row--total">
                <span className="cd-sym-label">Total errors</span>
                <span className="cd-sym-val">{bessTotal}</span>
              </div>
            </div>
          )}

          {assessment.sleep_quality != null && (
            <p className="cd-assessment-sleep">
              Sleep quality: <strong>{assessment.sleep_quality}/10</strong>
            </p>
          )}
          {assessment.notes && (
            <p className="cd-assessment-notes">{assessment.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Assessment Form ────────────────────────────────────────────
const EMPTY_SCAT6 = Object.fromEntries(SYMPTOM_FIELDS.map(({ key }) => [key, 0]));
const EMPTY_BESS  = Object.fromEntries(BESS_FIELDS.map(({ key }) => [key, 0]));

function NewAssessmentForm({ concussionId, onSaved, onCancel }) {
  const today = new Date().toISOString().split('T')[0];
  const [type,  setType]  = useState('scat6');
  const [date,  setDate]  = useState(today);
  const [scat6, setScat6] = useState(EMPTY_SCAT6);
  const [bess,  setBess]  = useState(EMPTY_BESS);
  const [sleep, setSleep] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const totalScore = SYMPTOM_FIELDS.reduce((s, { key }) => s + (Number(scat6[key]) || 0), 0);
  const bessTotal  = BESS_FIELDS.reduce((s, { key }) => s + (Number(bess[key]) || 0), 0);

  function setScat(key, raw) {
    setScat6(p => ({ ...p, [key]: Math.min(6, Math.max(0, Number(raw) || 0)) }));
  }
  function setBessField(key, raw) {
    setBess(p => ({ ...p, [key]: Math.min(10, Math.max(0, Number(raw) || 0)) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        assessment_date: date,
        assessment_type: type,
        ...(type === 'scat6' ? scat6 : {}),
        ...(type === 'bess'  ? bess  : {}),
        sleep_quality: sleep !== '' ? Number(sleep) : null,
        notes: notes || null,
      };
      const { data } = await api.post(`/api/concussions/${concussionId}/assessments`, payload);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="cd-new-assessment">
      <div className="cd-form-row">
        <div className="cd-form-group">
          <label className="cd-form-label">Date</label>
          <input type="date" className="cd-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="cd-form-group">
          <label className="cd-form-label">Type</label>
          <select className="cd-input" value={type} onChange={e => setType(e.target.value)}>
            <option value="scat6">SCAT6</option>
            <option value="bess">BESS</option>
            <option value="other">Other / Notes only</option>
          </select>
        </div>
      </div>

      {type === 'scat6' && (
        <>
          <div className="cd-running-total">
            Total symptom score: <strong>{totalScore}</strong> / 132
          </div>
          {SYMPTOM_CATEGORIES.map(cat => (
            <div key={cat} className="cd-cat-block">
              <div className="cd-cat-label">{cat}</div>
              <div className="cd-scat6-input-grid">
                {SYMPTOM_FIELDS.filter(f => f.category === cat).map(({ key, label }) => (
                  <div key={key} className="cd-scat6-field">
                    <label className="cd-scat6-label">{label}</label>
                    <input
                      type="number" className="cd-scat6-input"
                      min="0" max="6"
                      value={scat6[key]}
                      onChange={e => setScat(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {type === 'bess' && (
        <>
          <div className="cd-running-total">
            Total BESS errors: <strong>{bessTotal}</strong>
          </div>
          <div className="cd-bess-grid">
            {BESS_FIELDS.map(({ key, label }) => (
              <div key={key} className="cd-scat6-field">
                <label className="cd-scat6-label">{label}</label>
                <input
                  type="number" className="cd-scat6-input"
                  min="0" max="10"
                  value={bess[key]}
                  onChange={e => setBessField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="cd-form-row">
        <div className="cd-form-group">
          <label className="cd-form-label">Sleep quality (0–10)</label>
          <input
            type="number" className="cd-input"
            min="0" max="10" placeholder="—"
            value={sleep} onChange={e => setSleep(e.target.value)}
          />
        </div>
      </div>

      <div className="cd-form-group">
        <label className="cd-form-label">Notes</label>
        <textarea
          className="cd-input cd-textarea" rows={3}
          placeholder="Clinical observations, test conditions…"
          value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <div className="cd-form-error">{error}</div>}

      <div className="cd-form-actions">
        <button className="btn btn--ghost" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn--primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Assessment'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function ConcussionDetail() {
  const { id } = useParams();

  const [concussion,   setConcussion]   = useState(null);
  const [protocols,    setProtocols]    = useState({});
  const [assessments,  setAssessments]  = useState([]);
  const [checkins,     setCheckins]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Edit case header
  const [editing,   setEditing]   = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);

  // RTP
  const [rtpSaving, setRtpSaving] = useState(false);
  const [rtpError,  setRtpError]  = useState(null);

  // New assessment form
  const [showNewAssessment, setShowNewAssessment] = useState(false);

  // Check-in link generation
  const [linkGenerating, setLinkGenerating] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseRes, protoRes, asmRes, ciRes] = await Promise.all([
        api.get(`/api/concussions/${id}`),
        api.get('/api/rtp-protocols'),
        api.get(`/api/concussions/${id}/assessments`),
        api.get(`/api/concussions/${id}/checkins`),
      ]);
      setConcussion(caseRes.data);
      const pm = {};
      (protoRes.data ?? []).forEach(p => { pm[p.step_number] = p; });
      setProtocols(pm);
      setAssessments(asmRes.data ?? []);
      setCheckins(ciRes.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setEditForm({
      mechanism:             concussion.mechanism              ?? '',
      loss_of_consciousness: concussion.loss_of_consciousness  ?? false,
      loc_duration_seconds:  concussion.loc_duration_seconds   ?? '',
      physician_name:        concussion.physician_name          ?? '',
      physician_cleared_at:  concussion.physician_cleared_at    ?? '',
      notes:                 concussion.notes                   ?? '',
    });
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...editForm,
        loc_duration_seconds: editForm.loss_of_consciousness && editForm.loc_duration_seconds
          ? Number(editForm.loc_duration_seconds) : null,
        physician_cleared_at: editForm.physician_cleared_at || null,
      };
      const { data } = await api.put(`/api/concussions/${id}`, payload);
      setConcussion(data);
      setEditing(false);
    } catch (err) {
      setSaveError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCleared() {
    if (!window.confirm('Mark this athlete as cleared to return to play? This cannot be undone.')) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await api.put(`/api/concussions/${id}`, { status: 'cleared' });
      setConcussion(data);
    } catch (err) {
      setSaveError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvanceStep() {
    const next = (concussion.current_step ?? 1) + 1;
    if (next > TOTAL_STEPS) return;
    setRtpSaving(true);
    setRtpError(null);
    try {
      const { data } = await api.put(`/api/concussions/${id}`, { current_step: next });
      setConcussion(data);
    } catch (err) {
      setRtpError(err.response?.data?.error ?? err.message);
    } finally {
      setRtpSaving(false);
    }
  }

  async function handleGoBack() {
    const prev = (concussion.current_step ?? 1) - 1;
    if (prev < 1) return;
    if (!window.confirm('Go back to the previous RTP step?')) return;
    setRtpSaving(true);
    setRtpError(null);
    try {
      const { data } = await api.put(`/api/concussions/${id}`, { current_step: prev });
      setConcussion(data);
    } catch (err) {
      setRtpError(err.response?.data?.error ?? err.message);
    } finally {
      setRtpSaving(false);
    }
  }

  async function generateLink(linkType) {
    setLinkGenerating(true);
    try {
      const { data } = await api.post(`/api/concussions/${id}/links`, { link_type: linkType });
      const url = `${window.location.origin}/concussion-checkin/${data.token}`;
      setGeneratedLinks(prev => ({ ...prev, [linkType]: url }));
    } catch {
      // non-blocking
    } finally {
      setLinkGenerating(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────
  if (loading) {
    return (
      <div className="cd-page">
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      </div>
    );
  }

  if (error || !concussion) {
    return (
      <div className="cd-page">
        <Link to="/concussions" className="cd-back">← Back to Concussions</Link>
        <div className="page-error">{error ?? 'Case not found.'}</div>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────
  const currentStep     = concussion.current_step ?? 1;
  const currentProtocol = protocols[currentStep];
  const nextProtocol    = protocols[currentStep + 1];
  const days            = daysSince(concussion.injury_date);

  const latestAssessment = assessments[0] ?? null;
  const latestScore      = latestAssessment ? computeSymptomScore(latestAssessment) : null;
  const symptomFree      = latestScore === 0;
  const needsPhysician   = currentProtocol?.requires_physician_clearance && !concussion.physician_cleared_at;
  const canAdvance       = symptomFree && !needsPhysician && currentStep < TOTAL_STEPS && concussion.status !== 'cleared';

  // Chart: combine assessments + checkins
  const chartPoints = [
    ...assessments.map(a => ({ date: a.assessment_date, score: computeSymptomScore(a) })),
    ...checkins.map(c => ({ date: c.check_in_date, score: c.total_symptom_score ?? 0 })),
  ].filter(p => p.date);

  // Build RTP step track elements
  const rtpElements = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const step   = i + 1;
    const done   = step < currentStep;
    const active = step === currentStep;
    const proto  = protocols[step];

    if (i > 0) {
      rtpElements.push(
        <div key={`line-${i}`} className={`cd-rtp-connector${done ? ' done' : ''}`} />
      );
    }
    rtpElements.push(
      <div key={step} className="cd-rtp-step-col">
        <div className={`cd-rtp-circle${done ? ' done' : active ? ' active' : ''}`}>
          {done ? '✓' : step}
        </div>
        <span className={`cd-rtp-label${active ? ' active' : ''}`}>
          {proto?.step_name ?? DEFAULT_STEPS[i]}
        </span>
      </div>
    );
  }

  // Check-in sorted newest first
  const sortedCheckins = [...checkins].sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));

  return (
    <div className="cd-page">
      <Link to="/concussions" className="cd-back">← Back to Concussions</Link>

      {/* ── Case Header ─────────────────────────────────────────── */}
      <div className="cd-card">
        <div className="cd-case-top">
          <div className="cd-athlete-block">
            <span className="cd-athlete-name">{concussion.athlete_name}</span>
            {concussion.athlete_sport && (
              <span className="cd-sport-badge">{concussion.athlete_sport}</span>
            )}
          </div>
          <span className={`cd-status-badge cd-status-badge--${concussion.status === 'cleared' ? 'cleared' : 'active'}`}>
            {concussion.status === 'cleared' ? 'Cleared' : 'Active'}
          </span>
        </div>

        {!editing ? (
          <>
            <div className="cd-meta-grid">
              <div className="cd-meta-item">
                <span className="cd-meta-label">Injury date</span>
                <span className="cd-meta-value">
                  {formatDate(concussion.injury_date)}
                  {days !== null && <span className="cd-meta-sub"> · {days}d ago</span>}
                </span>
              </div>
              <div className="cd-meta-item">
                <span className="cd-meta-label">Mechanism</span>
                <span className="cd-meta-value">{concussion.mechanism ?? '—'}</span>
              </div>
              <div className="cd-meta-item">
                <span className="cd-meta-label">Loss of consciousness</span>
                <span className="cd-meta-value">
                  {concussion.loss_of_consciousness
                    ? `Yes${concussion.loc_duration_seconds ? ` (${concussion.loc_duration_seconds}s)` : ''}`
                    : 'No'}
                </span>
              </div>
              {concussion.physician_name && (
                <div className="cd-meta-item">
                  <span className="cd-meta-label">Physician</span>
                  <span className="cd-meta-value">{concussion.physician_name}</span>
                </div>
              )}
              {concussion.physician_cleared_at && (
                <div className="cd-meta-item">
                  <span className="cd-meta-label">Physician clearance</span>
                  <span className="cd-meta-value">{formatDate(concussion.physician_cleared_at)}</span>
                </div>
              )}
              {concussion.notes && (
                <div className="cd-meta-item cd-meta-item--full">
                  <span className="cd-meta-label">Notes</span>
                  <span className="cd-meta-value">{concussion.notes}</span>
                </div>
              )}
            </div>

            {saveError && <div className="cd-form-error">{saveError}</div>}

            <div className="cd-case-actions">
              <button className="btn btn--ghost btn--sm" onClick={startEdit} disabled={saving}>Edit</button>
              {concussion.status !== 'cleared' && (
                <button className="btn btn--primary btn--sm" onClick={handleMarkCleared} disabled={saving}>
                  {saving ? 'Saving…' : 'Mark Cleared'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="cd-edit-form">
            <div className="cd-form-row">
              <div className="cd-form-group">
                <label className="cd-form-label">Mechanism</label>
                <select className="cd-input" value={editForm.mechanism}
                  onChange={e => setEditForm(p => ({ ...p, mechanism: e.target.value }))}>
                  <option value="">Unknown</option>
                  {MECHANISMS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="cd-form-group">
                <label className="cd-form-label">Physician name</label>
                <input type="text" className="cd-input" placeholder="Dr. Smith"
                  value={editForm.physician_name}
                  onChange={e => setEditForm(p => ({ ...p, physician_name: e.target.value }))} />
              </div>
            </div>

            <div className="cd-form-group">
              <label className="cd-form-label">Physician clearance date</label>
              <input type="date" className="cd-input"
                value={editForm.physician_cleared_at ?? ''}
                onChange={e => setEditForm(p => ({ ...p, physician_cleared_at: e.target.value }))} />
            </div>

            <div className="cd-form-group">
              <label className="cd-form-label">Loss of consciousness</label>
              <div className="cd-loc-toggle">
                <button type="button"
                  className={`cd-toggle-btn${!editForm.loss_of_consciousness ? ' cd-toggle-btn--active' : ''}`}
                  onClick={() => setEditForm(p => ({ ...p, loss_of_consciousness: false }))}>No</button>
                <button type="button"
                  className={`cd-toggle-btn${editForm.loss_of_consciousness ? ' cd-toggle-btn--active' : ''}`}
                  onClick={() => setEditForm(p => ({ ...p, loss_of_consciousness: true }))}>Yes</button>
              </div>
              {editForm.loss_of_consciousness && (
                <input type="number" className="cd-input" style={{ marginTop: '0.5rem' }}
                  placeholder="Duration in seconds" min="0"
                  value={editForm.loc_duration_seconds}
                  onChange={e => setEditForm(p => ({ ...p, loc_duration_seconds: e.target.value }))} />
              )}
            </div>

            <div className="cd-form-group">
              <label className="cd-form-label">Notes</label>
              <textarea className="cd-input cd-textarea" rows={3}
                value={editForm.notes}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            {saveError && <div className="cd-form-error">{saveError}</div>}

            <div className="cd-form-actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RTP Progress ─────────────────────────────────────────── */}
      <div className="cd-card">
        <h2 className="cd-section-title">Return to Play Protocol</h2>

        <div className="cd-rtp-steps">{rtpElements}</div>

        {currentProtocol && (
          <div className="cd-rtp-detail">
            <div className="cd-rtp-step-name">
              Step {currentStep}: {currentProtocol.step_name ?? DEFAULT_STEPS[currentStep - 1]}
            </div>
            {currentProtocol.step_description && (
              <p className="cd-rtp-step-desc">{currentProtocol.step_description}</p>
            )}
          </div>
        )}

        {rtpError && <div className="cd-form-error">{rtpError}</div>}

        {concussion.status !== 'cleared' && (
          <div className="cd-rtp-controls">
            {latestScore === null && (
              <p className="cd-rtp-hint">Add a SCAT6 assessment before advancing.</p>
            )}
            {latestScore !== null && !symptomFree && (
              <p className="cd-rtp-hint">
                Athlete must be symptom-free (score = 0) to advance. Current score: {latestScore}.
              </p>
            )}
            {needsPhysician && (
              <div className="cd-physician-warning">
                ⚠ Step {currentStep} requires physician clearance before advancing. Set clearance date in Edit.
              </div>
            )}
            {currentStep < TOTAL_STEPS && (
              <button className="btn btn--primary" onClick={handleAdvanceStep} disabled={!canAdvance || rtpSaving}>
                {rtpSaving ? 'Saving…' : `Advance to Step ${currentStep + 1}${nextProtocol?.step_name ? ` – ${nextProtocol.step_name}` : ''}`}
              </button>
            )}
            {currentStep > 1 && (
              <button className="btn btn--ghost btn--sm" onClick={handleGoBack} disabled={rtpSaving}>
                ← Go back one step
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Two-column grid ───────────────────────────────────────── */}
      <div className="cd-two-col">

        {/* Left — Assessments */}
        <div className="cd-col">
          <div className="cd-col-header">
            <h2 className="cd-section-title">SCAT6 Assessments</h2>
            {!showNewAssessment && (
              <button className="btn btn--primary btn--sm" onClick={() => setShowNewAssessment(true)}>
                + New Assessment
              </button>
            )}
          </div>

          {showNewAssessment && (
            <NewAssessmentForm
              concussionId={id}
              onSaved={a => { setAssessments(prev => [a, ...prev]); setShowNewAssessment(false); }}
              onCancel={() => setShowNewAssessment(false)}
            />
          )}

          {assessments.length === 0 && !showNewAssessment && (
            <div className="state-msg state-msg--empty" style={{ padding: '2rem 1rem' }}>
              <p>No assessments recorded yet.</p>
            </div>
          )}

          <div className="cd-assessment-list">
            {assessments.map(a => <AssessmentCard key={a.id} assessment={a} />)}
          </div>
        </div>

        {/* Right — Daily Check-ins */}
        <div className="cd-col">
          <div className="cd-col-header">
            <h2 className="cd-section-title">Daily Check-ins</h2>
          </div>

          <SymptomChart points={chartPoints} />

          <div className="cd-link-section">
            <div className="cd-link-row">
              <button className="btn btn--ghost btn--sm" onClick={() => generateLink('athlete')} disabled={linkGenerating}>
                Generate Athlete Check-in Link
              </button>
              {generatedLinks.athlete && (
                <input
                  className="cd-link-input" readOnly
                  value={generatedLinks.athlete}
                  onClick={e => e.target.select()}
                />
              )}
            </div>
            <div className="cd-link-row">
              <button className="btn btn--ghost btn--sm" onClick={() => generateLink('parent')} disabled={linkGenerating}>
                Generate Parent Link
              </button>
              {generatedLinks.parent && (
                <input
                  className="cd-link-input" readOnly
                  value={generatedLinks.parent}
                  onClick={e => e.target.select()}
                />
              )}
            </div>
          </div>

          {checkins.length === 0 ? (
            <div className="state-msg state-msg--empty" style={{ padding: '2rem 1rem' }}>
              <p>No check-ins yet.</p>
            </div>
          ) : (
            <div className="cd-checkin-list">
              {sortedCheckins.map((ci, i) => {
                const prev = sortedCheckins[i + 1];
                const diff = prev != null ? (ci.total_symptom_score ?? 0) - (prev.total_symptom_score ?? 0) : null;
                const trend = diff === null ? null : diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
                return (
                  <div key={ci.id} className="cd-checkin-row">
                    <span className="cd-checkin-date">{formatDate(ci.check_in_date)}</span>
                    <span className="cd-checkin-by">{ci.submitted_by_type ?? 'AT'}</span>
                    <span className={`cd-checkin-score${ci.total_symptom_score === 0 ? ' zero' : ''}`}>
                      {ci.total_symptom_score ?? 0}
                    </span>
                    {trend && (
                      <span className={`cd-trend${trend === '▲' ? ' worse' : trend === '▼' ? ' better' : ' same'}`}>
                        {trend}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
