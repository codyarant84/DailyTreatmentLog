import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import TreatmentCard from '../components/TreatmentCard.jsx';
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

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [filters, setFilters]       = useState(EMPTY_FILTERS);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/daily-treatments?athlete_name=${encodeURIComponent(athleteName)}`)
      .then(({ data }) => setTreatments(data))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load treatment history.'))
      .finally(() => setLoading(false));
  }, [athleteName]);

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
  const totalSavings    = filtered.reduce((n, t) => n + (t.estimated_savings ?? 0), 0);

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
    </div>
  );
}
