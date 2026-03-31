import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import './RehabPrograms.css';

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RehabPrograms() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/rehab-programs');
      setPrograms(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete program "${name}"?`)) return;
    try {
      await api.delete(`/api/rehab-programs/${id}`);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    }
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div className="rehab-programs">
      <div className="rp-header">
        <div>
          <h1 className="page-title">Rehab Programs</h1>
          <p className="page-subtitle">Build and assign multi-week rehab protocols to individual athletes or develop standardized treatment protocols. Track completion and progress over time.</p>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>{programs.length} program{programs.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/programs/new"
          className="btn btn--primary"
          title="Create a structured week-by-week rehab plan for an athlete recovering from injury."
        >
          + New Program
        </Link>
      </div>

      {error && <div className="page-error">{error}</div>}

      {programs.length === 0 && (
        <p className="rp-empty">No programs yet. Create one to get started.</p>
      )}

      <div className="program-list">
        {programs.map((p) => (
          <div key={p.id} className="program-card">
            <div className="program-card-main">
              <div className="program-info">
                <Link to={`/programs/${p.id}`} className="program-name">{p.name}</Link>
                {p.athlete_name && (
                  <span className="program-athlete">{p.athlete_name}</span>
                )}
                {p.description && (
                  <p className="program-desc">{p.description}</p>
                )}
              </div>
              <div className="program-meta">
                <span className="program-count">
                  {p.exercise_count} exercise{p.exercise_count !== 1 ? 's' : ''}
                </span>
                <span className="program-date">{formatDate(p.created_at)}</span>
              </div>
            </div>
            <div className="program-card-actions">
              <Link to={`/programs/${p.id}`} className="btn btn--sm btn--ghost">Edit</Link>
              <button
                className="btn btn--sm btn--danger-ghost"
                onClick={() => handleDelete(p.id, p.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
