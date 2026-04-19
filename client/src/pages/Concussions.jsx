import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import './Concussions.css';

const TOTAL_STEPS = 6;

const MECHANISMS = ['Contact', 'Non-contact', 'Unknown'];

const SYMPTOM_FIELDS = [
  'headache', 'pressure_in_head', 'neck_pain', 'nausea_or_vomiting',
  'dizziness', 'blurred_vision', 'balance_problems', 'sensitivity_to_light',
  'sensitivity_to_noise', 'feeling_slowed_down', 'feeling_in_fog',
  'dont_feel_right', 'difficulty_concentrating', 'difficulty_remembering',
  'fatigue_or_low_energy', 'confusion', 'drowsiness', 'more_emotional',
  'irritability', 'sadness', 'nervous_or_anxious', 'visual_problems',
];

function computeSymptomScore(assessment) {
  if (!assessment) return null;
  return SYMPTOM_FIELDS.reduce((sum, f) => {
    const v = assessment[f];
    return sum + (v != null ? Number(v) : 0);
  }, 0);
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

// ── New Case Modal ─────────────────────────────────────────────────
function NewCaseModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [athletes, setAthletes]           = useState([]);
  const [activeInjuries, setActiveInjuries] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);

  const [form, setForm] = useState({
    athlete_id:            '',
    injury_date:           today,
    mechanism:             '',
    loss_of_consciousness: false,
    loc_duration_seconds:  '',
    injury_id:             '',
    physician_name:        '',
    notes:                 '',
  });

  useEffect(() => {
    async function load() {
      const [athRes, injRes] = await Promise.all([
        api.get('/api/athletes'),
        api.get('/api/injuries?active=true'),
      ]);
      setAthletes(athRes.data ?? []);
      setActiveInjuries(injRes.data ?? []);
    }
    load();
  }, []);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  const filteredAthletes = athletes.filter((a) =>
    !athleteSearch || a.name.toLowerCase().includes(athleteSearch.toLowerCase())
  );

  const athleteInjuries = activeInjuries.filter(
    (i) => i.athlete_id === form.athlete_id
  );

  async function handleSubmit(e) {
    e.preventDefault();
    console.log('Form state on submit:', form);
    if (!form.athlete_id)   { setError('Athlete is required.'); return; }
    if (!form.injury_date)  { setError('Injury date is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        athlete_id:            form.athlete_id,
        injury_date:           form.injury_date,
        mechanism:             form.mechanism             || null,
        loss_of_consciousness: form.loss_of_consciousness,
        loc_duration_seconds:  form.loss_of_consciousness && form.loc_duration_seconds
                                 ? Number(form.loc_duration_seconds) : null,
        injury_id:             form.injury_id             || null,
        physician_name:        form.physician_name         || null,
        notes:                 form.notes                  || null,
      };
      const { data } = await api.post('/api/concussions', payload);
      onCreated();
      navigate(`/concussions/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">New Concussion Case</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          {/* Athlete selector */}
          <div className="form-group">
            <label className="form-label">Athlete <span className="required">*</span></label>
            {form.athlete_id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="form-input" style={{ flex: 1 }}>
                  {/* eslint-disable-next-line eqeqeq */}
                  {athletes.find((a) => a.id == form.athlete_id)?.name ?? '—'}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => { set('athlete_id', ''); set('injury_id', ''); setAthleteSearch(''); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search athletes…"
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                />
                {athleteSearch && (
                  <div className="cc-athlete-dropdown">
                    {filteredAthletes.length === 0 ? (
                      <div className="cc-athlete-option cc-athlete-option--empty">No athletes found</div>
                    ) : (
                      filteredAthletes.slice(0, 8).map((a) => (
                        <div
                          key={a.id}
                          className="cc-athlete-option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            set('athlete_id', a.id);
                            set('injury_id', '');
                            setAthleteSearch('');
                          }}
                        >
                          {a.name}{a.sport ? <span className="cc-athlete-option-sport"> — {a.sport}</span> : null}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

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
              <label className="form-label">Mechanism</label>
              <select className="form-input" value={form.mechanism} onChange={(e) => set('mechanism', e.target.value)}>
                <option value="">Unknown</option>
                {MECHANISMS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Loss of consciousness */}
          <div className="form-group">
            <label className="form-label">Loss of Consciousness</label>
            <div className="cc-loc-toggle">
              <button
                type="button"
                className={`cc-toggle-btn${!form.loss_of_consciousness ? ' cc-toggle-btn--active' : ''}`}
                onClick={() => set('loss_of_consciousness', false)}
              >
                No
              </button>
              <button
                type="button"
                className={`cc-toggle-btn${form.loss_of_consciousness ? ' cc-toggle-btn--active' : ''}`}
                onClick={() => set('loss_of_consciousness', true)}
              >
                Yes
              </button>
            </div>
            {form.loss_of_consciousness && (
              <input
                type="number"
                className="form-input"
                style={{ marginTop: '0.5rem' }}
                placeholder="Duration in seconds"
                min="0"
                value={form.loc_duration_seconds}
                onChange={(e) => set('loc_duration_seconds', e.target.value)}
              />
            )}
          </div>

          {/* Link to existing injury */}
          {form.athlete_id && (
            <div className="form-group">
              <label className="form-label">Link to Existing Injury <span className="form-optional">(optional)</span></label>
              <select
                className="form-input"
                value={form.injury_id}
                onChange={(e) => set('injury_id', e.target.value)}
              >
                <option value="">None</option>
                {athleteInjuries.map((inj) => (
                  <option key={inj.id} value={inj.id}>
                    {inj.injury_type} — {inj.body_part} ({formatDate(inj.injury_date)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Physician Name <span className="form-optional">(optional)</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Smith"
              value={form.physician_name}
              onChange={(e) => set('physician_name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes <span className="form-optional">(optional)</span></label>
            <textarea
              className="form-input form-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Initial assessment, relevant history…"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Case Card ──────────────────────────────────────────────────────
function CaseCard({ c, assessments, rtpStep }) {
  const navigate = useNavigate();
  const days = daysSince(c.injury_date);
  const step = c.current_step ?? 1;

  const latest = assessments[0] ?? null;
  const prev   = assessments[1] ?? null;
  const latestScore = computeSymptomScore(latest);
  const prevScore   = computeSymptomScore(prev);

  let trendIcon = null;
  if (latestScore !== null && prevScore !== null) {
    if (latestScore > prevScore)       trendIcon = <span className="cc-trend cc-trend--worse">▲</span>;
    else if (latestScore < prevScore)  trendIcon = <span className="cc-trend cc-trend--better">▼</span>;
    else                               trendIcon = <span className="cc-trend cc-trend--same">—</span>;
  } else if (latestScore !== null) {
    trendIcon = <span className="cc-trend cc-trend--same">—</span>;
  }

  const needsPhysician = rtpStep?.requires_physician_clearance && !c.physician_cleared_at;

  return (
    <div className="cc-card" onClick={() => navigate(`/concussions/${c.id}`)}>
      {/* Header */}
      <div className="cc-card-header">
        <div className="cc-card-athlete">
          <span className="cc-athlete-name">{c.athlete_name ?? '—'}</span>
          {c.athlete_sport && <span className="cc-sport-badge">{c.athlete_sport}</span>}
        </div>
        <span className={`cc-status-badge cc-status-badge--${c.status === 'cleared' ? 'cleared' : 'active'}`}>
          {c.status === 'cleared' ? 'Cleared' : 'Active'}
        </span>
      </div>

      {/* RTP progress */}
      <div className="cc-rtp-block">
        <div className="cc-rtp-label-row">
          <span className="cc-step-label">Step {step} of {TOTAL_STEPS}</span>
          {rtpStep?.step_name && (
            <span className="cc-step-name">{rtpStep.step_name}</span>
          )}
        </div>
        <div className="cc-progress-track">
          <div
            className="cc-progress-fill"
            style={{ width: `${Math.min((step / TOTAL_STEPS) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="cc-meta-row">
        <span className="cc-meta-date">{formatDate(c.injury_date)}</span>
        {days !== null && (
          <span className="cc-meta-days">{days === 0 ? 'Today' : `${days}d ago`}</span>
        )}
      </div>

      {/* Symptom score */}
      {latestScore !== null && (
        <div className="cc-symptom-row">
          <span className="cc-symptom-label">Symptom score</span>
          <span className="cc-symptom-score">{latestScore}</span>
          {trendIcon}
        </div>
      )}

      {/* Physician clearance badge */}
      {needsPhysician && (
        <div className="cc-physician-badge">Awaiting physician clearance</div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function Concussions() {
  const [tab, setTab]           = useState('active');
  const [cases, setCases]       = useState([]);
  const [assessmentMap, setAssessmentMap] = useState({});
  const [rtpProtocols, setRtpProtocols]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [casesRes, rtpRes] = await Promise.all([
        api.get(`/api/concussions?status=${tab}`),
        api.get('/api/rtp-protocols'),
      ]);

      const loaded = casesRes.data ?? [];
      setCases(loaded);

      // Build RTP protocol map by step_number
      const protoMap = {};
      (rtpRes.data ?? []).forEach((s) => { protoMap[s.step_number] = s; });
      setRtpProtocols(protoMap);

      // Fetch assessments per case in parallel
      const asmResults = await Promise.all(
        loaded.map((c) =>
          api.get(`/api/concussions/${c.id}/assessments`).then((r) => ({ id: c.id, data: r.data ?? [] }))
        )
      );
      const aMap = {};
      asmResults.forEach(({ id, data }) => { aMap[id] = data; });
      setAssessmentMap(aMap);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="cc-page">
      {/* Header */}
      <div className="cc-header">
        <div>
          <h1 className="page-title">Concussion Management</h1>
          <p className="page-subtitle">Track concussion cases, SCAT6 assessments, and return-to-play progress.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ New Case</button>
      </div>

      {/* Filter tabs */}
      <div className="cc-tabs">
        <button
          className={`cc-tab${tab === 'active' ? ' cc-tab--active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
        <button
          className={`cc-tab${tab === 'cleared' ? ' cc-tab--active' : ''}`}
          onClick={() => setTab('cleared')}
        >
          Cleared
        </button>
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      ) : cases.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>No {tab} concussion cases.</p>
          {tab === 'active' && (
            <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ New Case</button>
          )}
        </div>
      ) : (
        <div className="cc-grid">
          {cases.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              assessments={assessmentMap[c.id] ?? []}
              rtpStep={rtpProtocols[c.current_step ?? 1] ?? null}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewCaseModal
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
