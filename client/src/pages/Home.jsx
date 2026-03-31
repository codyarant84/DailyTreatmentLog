import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import TreatmentCard from '../components/TreatmentCard.jsx';
import { SPORTS } from '../components/SportCombobox.jsx';
import './Home.css';

function Home() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');

  useEffect(() => {
    fetchTreatments();
  }, []);

  async function fetchTreatments() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/api/daily-treatments');
      setTreatments(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load treatments. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this treatment record?')) return;
    try {
      await api.delete(`/api/daily-treatments/${id}`);
      setTreatments((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete treatment.');
    }
  }

  const filtered = treatments.filter((t) => {
    if (sportFilter && t.sport !== sportFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      t.athlete_name?.toLowerCase().includes(q) ||
      t.sport?.toLowerCase().includes(q) ||
      t.treatment_type?.toLowerCase().includes(q) ||
      t.body_part?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="home">
      <div className="home-top">
        <div>
          <h1 className="page-title">Treatment Log</h1>
          <p className="page-subtitle">
            {treatments.length} record{treatments.length !== 1 ? 's' : ''} on file
            {(() => {
              const total = treatments.reduce((n, t) => n + (t.estimated_savings ?? 0), 0);
              return total > 0
                ? ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)} est. saved`
                : null;
            })()}
          </p>
        </div>
        <Link to="/new" className="btn btn--primary">
          + New Treatment
        </Link>
      </div>

      <div className="filter-row">
        <input
          type="search"
          placeholder="Search by athlete, sport, treatment, body part, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          className="sport-filter-select"
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          aria-label="Filter by sport"
        >
          <option value="">All Sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {sportFilter && (
          <button className="btn btn--ghost btn--sm" onClick={() => setSportFilter('')}>
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="state-msg">
          <div className="spinner" />
          <span>Loading treatments...</span>
        </div>
      )}

      {!loading && error && (
        <div className="state-msg state-msg--error">
          <p>{error}</p>
          <button className="btn btn--outline" onClick={fetchTreatments}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="state-msg state-msg--empty">
          {(search || sportFilter) ? (
            <p>No treatments match your filters.</p>
          ) : (
            <>
              <p>No treatments logged yet.</p>
              <Link to="/new" className="btn btn--primary">
                Log your first treatment
              </Link>
            </>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="treatment-list">
          {filtered.map((t) => (
            <TreatmentCard key={t.id} treatment={t} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
