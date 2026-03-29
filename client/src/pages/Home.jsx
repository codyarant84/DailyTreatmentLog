import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import TreatmentCard from '../components/TreatmentCard.jsx';
import './Home.css';

function Home() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

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
    const q = search.toLowerCase();
    return (
      t.athlete_name?.toLowerCase().includes(q) ||
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
          </p>
        </div>
        <Link to="/new" className="btn btn--primary">
          + New Treatment
        </Link>
      </div>

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search by athlete, treatment, body part, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
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
          {search ? (
            <p>No treatments match your search.</p>
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
