import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import TreatmentCard from '../components/TreatmentCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import './AthleteProfile.css';

const TREATMENT_TYPES = ['Ice', 'Heat', 'Ultrasound', 'E-Stim', 'Massage', 'Taping', 'Exercise'];

function mostCommon(values) {
  if (!values.length) return null;
  const counts = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function formatDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FILTERS = { from: '', to: '', treatment_type: '' };

export default function AthleteProfile() {
  const { name } = useParams();
  const athleteName = decodeURIComponent(name);
  const navigate = useNavigate();
  const { branding } = useAuth();
  const costPerVisit = branding?.costPerVisit ?? 50;

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filters, setFilters]       = useState(EMPTY_FILTERS);

  const [athlete, setAthlete]       = useState(null);
  const [flags, setFlags]           = useState([]);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [editingFlag, setEditingFlag]   = useState(null);
  const EMPTY_FLAG = { flag_type: 'allergy', description: '', severity: 'medium' };
  const [flagForm, setFlagForm]     = useState(EMPTY_FLAG);
  const [flagSaving, setFlagSaving] = useState(false);
  const [flagError, setFlagError]   = useState(null);

  // Parent access state
  const [parents, setParents]               = useState([]);
  const [inviteEmail, setInviteEmail]       = useState('');
  const [inviteSaving, setInviteSaving]     = useState(false);
  const [inviteMsg, setInviteMsg]           = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/api/daily-treatments?athlete_name=${encodeURIComponent(athleteName)}`),
      api.get(`/api/athletes/by-name/${encodeURIComponent(athleteName)}`),
    ])
      .then(([treatRes, athRes]) => {
        setTreatments(treatRes.data);
        setAthlete(athRes.data);
      })
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load athlete data.'))
      .finally(() => setLoading(false));
  }, [athleteName]);

  useEffect(() => {
    if (!athlete?.id) return;
    api.get(`/api/athletes/${athlete.id}/flags`)
      .then(({ data }) => setFlags(data))
      .catch(() => {});
    api.get(`/api/portal/athlete/${athlete.id}/parents`)
      .then(({ data }) => setParents(data))
      .catch(() => {});
  }, [athlete?.id]);

  function startAddFlag() {
    setEditingFlag(null);
    setFlagForm(EMPTY_FLAG);
    setFlagError(null);
    setShowFlagForm(true);
  }

  function startEditFlag(flag) {
    setEditingFlag(flag);
    setFlagForm({ flag_type: flag.flag_type, description: flag.description, severity: flag.severity ?? 'medium' });
    setFlagError(null);
    setShowFlagForm(true);
  }

  async function handleFlagSubmit(e) {
    e.preventDefault();
    if (!flagForm.description.trim()) { setFlagError('Description is required.'); return; }
    setFlagSaving(true);
    setFlagError(null);
    try {
      if (editingFlag) {
        const { data } = await api.put(`/api/athletes/${athlete.id}/flags/${editingFlag.id}`, flagForm);
        setFlags((prev) => prev.map((f) => f.id === data.id ? data : f));
      } else {
        const { data } = await api.post(`/api/athletes/${athlete.id}/flags`, flagForm);
        setFlags((prev) => [data, ...prev]);
      }
      setShowFlagForm(false);
      setEditingFlag(null);
    } catch (err) {
      setFlagError(err.response?.data?.error ?? err.message);
    } finally {
      setFlagSaving(false);
    }
  }

  async function handleDeleteFlag(flagId) {
    if (!window.confirm('Delete this flag?')) return;
    try {
      await api.delete(`/api/athletes/${athlete.id}/flags/${flagId}`);
      setFlags((prev) => prev.filter((f) => f.id !== flagId));
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to delete flag.');
    }
  }

  async function handleInviteParent(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSaving(true);
    setInviteMsg(null);
    try {
      const { data } = await api.post(`/api/portal/athlete/${athlete.id}/parents/invite`, { email: inviteEmail.trim() });
      setInviteEmail('');
      setInviteMsg({ ok: true, text: data.linked ? 'Parent linked and notified.' : 'Invite sent.' });
      if (data.linked) {
        const { data: updated } = await api.get(`/api/portal/athlete/${athlete.id}/parents`);
        setParents(updated);
      }
    } catch (err) {
      setInviteMsg({ ok: false, text: err.response?.data?.error ?? 'Failed to send invite.' });
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleUnlinkParent(parentId) {
    if (!window.confirm('Remove this parent\'s access?')) return;
    try {
      await api.delete(`/api/portal/athlete/${athlete.id}/parents/${parentId}`);
      setParents((prev) => prev.filter((p) => p.id !== parentId));
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to remove parent.');
    }
  }

  // Client-side filtering for instant response
  const filtered = useMemo(() => {
    return treatments.filter((t) => {
      if (filters.from && t.date < filters.from) return false;
      if (filters.to   && t.date > filters.to)   return false;
      if (filters.treatment_type && t.treatment_type !== filters.treatment_type) return false;
      return true;
    });
  }, [treatments, filters]);

  const hasFilters = Object.values(filters).some(Boolean);

  // Stats are always computed from the filtered set so they stay in sync
  const totalMinutes    = filtered.reduce((n, t) => n + (t.duration_minutes ?? 0), 0);
  const uniqueDays      = new Set(filtered.map((t) => t.date)).size;
  const topBodyPart     = mostCommon(filtered.map((t) => t.body_part));
  const topType         = mostCommon(filtered.map((t) => t.treatment_type));
  const totalSavings    = filtered.length * costPerVisit;

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this treatment record?')) return;
    try {
      await api.delete(`/api/daily-treatments/${id}`);
      setTreatments((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to delete treatment.');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        <span>Loading treatment history...</span>
      </div>
    );
  }

  return (
    <div className="athlete-profile">

      {/* Page header */}
      <div className="profile-header">
        <button className="back-link" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        <div className="profile-name-row">
          <div>
            <h1 className="page-title">{athleteName}</h1>
            <p className="page-subtitle">
              {treatments.length} treatment{treatments.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          <Link
            to={`/new?athlete=${encodeURIComponent(athleteName)}`}
            className="btn btn--primary"
          >
            + New Treatment
          </Link>
        </div>
      </div>

      {error && <div className="state-msg state-msg--error"><p>{error}</p></div>}

      {/* Flags */}
      <div className="flags-section">
        <div className="flags-header">
          <h2 className="flags-title">
            Flags
            {flags.length > 0 && <span className={`flag-badge flag-badge--${flags[0].severity ?? 'low'}`} style={{ marginLeft: '0.5rem' }}>{flags.length}</span>}
          </h2>
          <button className="btn btn--sm btn--outline" onClick={startAddFlag}>+ Add Flag</button>
        </div>

        {showFlagForm && (
          <form className="flag-form" onSubmit={handleFlagSubmit} noValidate>
            {flagError && <div className="form-error">{flagError}</div>}
            <div className="flag-form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={flagForm.flag_type} onChange={(e) => setFlagForm((p) => ({ ...p, flag_type: e.target.value }))}>
                  <option value="allergy">Allergy</option>
                  <option value="medical_condition">Medical Condition</option>
                  <option value="injury_history">Injury History</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="form-input" value={flagForm.severity ?? ''} onChange={(e) => setFlagForm((p) => ({ ...p, severity: e.target.value || null }))}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                rows={2}
                value={flagForm.description}
                onChange={(e) => setFlagForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe the flag…"
              />
            </div>
            <div className="flag-form-actions">
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setShowFlagForm(false); setEditingFlag(null); }} disabled={flagSaving}>Cancel</button>
              <button type="submit" className="btn btn--sm btn--primary" disabled={flagSaving}>{flagSaving ? 'Saving…' : editingFlag ? 'Save' : 'Add Flag'}</button>
            </div>
          </form>
        )}

        {flags.length === 0 && !showFlagForm ? (
          <p className="flags-empty">No flags on file for this athlete.</p>
        ) : (
          <div className="flag-list">
            {flags.map((flag) => (
              <div key={flag.id} className={`flag-card flag-card--${flag.severity ?? 'low'}`}>
                <div className="flag-card-left">
                  <span className={`flag-severity-dot flag-dot--${flag.severity ?? 'low'}`} />
                  <div className="flag-card-body">
                    <span className="flag-type-label">{flag.flag_type.replace('_', ' ')}</span>
                    <p className="flag-description">{flag.description}</p>
                  </div>
                </div>
                <div className="flag-card-actions">
                  <button className="btn btn--sm btn--ghost" onClick={() => startEditFlag(flag)}>Edit</button>
                  <button className="btn btn--sm btn--danger-ghost" onClick={() => handleDeleteFlag(flag.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{filtered.length}</span>
          <span className="stat-label">
            {hasFilters ? 'Matching' : 'Total'} Treatments
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{uniqueDays}</span>
          <span className="stat-label">Days Seen</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMinutes}</span>
          <span className="stat-label">Total Minutes</span>
        </div>
        <div className="stat-card stat-card--text">
          <span className="stat-value stat-value--sm">{topBodyPart ?? '—'}</span>
          <span className="stat-label">Top Body Part</span>
        </div>
        <div className="stat-card stat-card--text">
          <span className="stat-value stat-value--sm">{topType ?? '—'}</span>
          <span className="stat-label">Top Treatment</span>
        </div>
        {totalSavings > 0 && (
          <div className="stat-card stat-card--savings">
            <span className="stat-value stat-value--savings">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalSavings)}
            </span>
            <span className="stat-label">Est. Total Savings</span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            className="filter-input"
            value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            className="filter-input"
            value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-type">Treatment Type</label>
          <select
            id="filter-type"
            className="filter-input filter-select"
            value={filters.treatment_type}
            onChange={(e) => setFilter('treatment_type', e.target.value)}
          >
            <option value="">All Types</option>
            {TREATMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <button className="btn btn--ghost filter-clear" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Results label when filtered */}
      {hasFilters && (
        <p className="filter-result-label">
          Showing {filtered.length} of {treatments.length} treatment{treatments.length !== 1 ? 's' : ''}
          {filters.from && ` · from ${formatDisplayDate(filters.from)}`}
          {filters.to   && ` · to ${formatDisplayDate(filters.to)}`}
          {filters.treatment_type && ` · ${filters.treatment_type}`}
        </p>
      )}

      {/* Treatment list */}
      {filtered.length === 0 ? (
        <div className="state-msg state-msg--empty">
          {hasFilters ? (
            <>
              <p>No treatments match these filters.</p>
              <button className="btn btn--outline" onClick={clearFilters}>Clear Filters</button>
            </>
          ) : (
            <>
              <p>No treatments on record for {athleteName}.</p>
              <Link to={`/new?athlete=${encodeURIComponent(athleteName)}`} className="btn btn--primary">
                Log first treatment
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="treatment-list">
          {filtered.map((t) => (
            <TreatmentCard key={t.id} treatment={t} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Parent Access */}
      <div className="parent-access-section">
        <h2 className="flags-title">Parent Access</h2>
        <p className="flags-empty" style={{ marginBottom: '0.75rem' }}>
          Parents with access can view this athlete's injury status and forms via the portal.
        </p>

        {parents.length > 0 && (
          <div className="parent-list">
            {parents.map((p) => (
              <div key={p.id} className="parent-row">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="parent-avatar" />
                ) : (
                  <div className="parent-avatar-placeholder">{p.name?.[0]?.toUpperCase() ?? '?'}</div>
                )}
                <div className="parent-info">
                  <span className="parent-name">{p.name}</span>
                  <span className="parent-email">{p.email}</span>
                </div>
                <button className="btn btn--sm btn--danger-ghost" onClick={() => handleUnlinkParent(p.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form className="parent-invite-form" onSubmit={handleInviteParent}>
          <input
            type="email"
            className="form-input"
            placeholder="Parent email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button type="submit" className="btn btn--sm btn--primary" disabled={inviteSaving}>
            {inviteSaving ? 'Sending…' : 'Invite Parent'}
          </button>
        </form>
        {inviteMsg && (
          <p className={inviteMsg.ok ? 'parent-msg--ok' : 'parent-msg--error'}>{inviteMsg.text}</p>
        )}
      </div>
    </div>
  );
}
