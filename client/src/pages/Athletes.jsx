import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import './Athletes.css';

function formatDob(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Athletes() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    api.get('/api/athletes')
      .then(({ data }) => setAthletes(data))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load roster.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = athletes.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.sport?.toLowerCase().includes(q) ||
      a.grade?.toLowerCase().includes(q)
    );
  });

  // Group by first letter of name
  const grouped = filtered.reduce((acc, a) => {
    const letter = a.name[0].toUpperCase();
    (acc[letter] = acc[letter] ?? []).push(a);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort();

  return (
    <div className="athletes-page">
      <div className="athletes-header">
        <div>
          <h1 className="page-title">Athletes</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${athletes.length} athlete${athletes.length !== 1 ? 's' : ''} on roster`}
          </p>
        </div>
        <Link to="/athletes/import" className="btn btn--primary">
          Import CSV
        </Link>
      </div>

      {!loading && !error && athletes.length > 0 && (
        <div className="athletes-search">
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, sport, or grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading && (
        <div className="state-msg">
          <div className="spinner" />
          <span>Loading roster…</span>
        </div>
      )}

      {!loading && error && (
        <div className="state-msg state-msg--error"><p>{error}</p></div>
      )}

      {!loading && !error && athletes.length === 0 && (
        <div className="state-msg state-msg--empty">
          <p>No athletes on the roster yet.</p>
          <Link to="/athletes/import" className="btn btn--primary">Import CSV</Link>
        </div>
      )}

      {!loading && !error && athletes.length > 0 && filtered.length === 0 && (
        <div className="state-msg state-msg--empty">
          <p>No athletes match your search.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Sport</th>
                <th>Grade</th>
                <th>Date of Birth</th>
                <th></th>
              </tr>
            </thead>
            {letters.map((letter) => (
              <tbody key={letter}>
                <tr className="letter-row">
                  <td colSpan={5} className="letter-cell">{letter}</td>
                </tr>
                {grouped[letter].map((a) => (
                  <tr key={a.id} className="athlete-row">
                    <td>
                      <Link
                        to={`/athletes/${encodeURIComponent(a.name)}`}
                        className="athlete-name-link"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td>{a.sport ?? <span className="cell-empty">—</span>}</td>
                    <td>{a.grade ?? <span className="cell-empty">—</span>}</td>
                    <td>{formatDob(a.date_of_birth)}</td>
                    <td>
                      <Link
                        to={`/athletes/${encodeURIComponent(a.name)}`}
                        className="view-link"
                      >
                        Treatment history →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
