import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import api from '../lib/api.js';
import './Dashboard.css';

const TREATMENT_COLORS = {
  'Ice':       '#2980b9',
  'Heat':      '#e67e22',
  'Ultrasound':'#2c3e50',
  'E-Stim':   '#d35400',
  'Massage':   '#8e44ad',
  'Taping':    '#16a085',
  'Exercise':  '#c0392b',
};

function typeColor(t) {
  return TREATMENT_COLORS[t] ?? '#7f8c8d';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFullDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Turn "john.smith@westview.edu" → "john.smith"
function trainerLabel(email) {
  if (!email) return '—';
  return email.split('@')[0];
}

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [schoolId, setSchoolId]     = useState(null);
  const [newIds, setNewIds]         = useState(new Set());

  // ── Fetch current user's school_id for the realtime filter ──────────────
  useEffect(() => {
    api.get('/api/auth/me')
      .then(({ data }) => setSchoolId(data.school_id))
      .catch(() => setError('Could not load your profile. Try refreshing.'));
  }, []);

  // ── Fetch today's treatments ─────────────────────────────────────────────
  useEffect(() => {
    api.get(`/api/daily-treatments?date=${today}`)
      .then(({ data }) => setTreatments(data))
      .catch((err) =>
        setError(err.response?.data?.error ?? 'Failed to load today\'s treatments.')
      )
      .finally(() => setLoading(false));
  }, [today]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;

    function flashNew(id) {
      setNewIds((prev) => new Set(prev).add(id));
      setTimeout(
        () => setNewIds((prev) => { const s = new Set(prev); s.delete(id); return s; }),
        2500
      );
    }

    const channel = supabase
      .channel(`dashboard:${schoolId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'daily_treatments',
          filter: `school_id=eq.${schoolId}`,
        },
        ({ new: row }) => {
          if (row.date !== today) return;
          setTreatments((prev) => {
            if (prev.some((t) => t.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
          });
          flashNew(row.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'daily_treatments',
          filter: `school_id=eq.${schoolId}`,
        },
        ({ old: row }) => {
          setTreatments((prev) => prev.filter((t) => t.id !== row.id));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [schoolId, today]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalMinutes = treatments.reduce((n, t) => n + (t.duration_minutes ?? 0), 0);
  const uniqueAthletes = new Set(treatments.map((t) => t.athlete_name)).size;

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        <span>Loading today's treatments...</span>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Today's Treatments</h1>
          <p className="page-subtitle">{formatFullDate(new Date())}</p>
        </div>
        <div className="live-badge" title="Updates automatically when colleagues log entries">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {error && (
        <div className="state-msg state-msg--error"><p>{error}</p></div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{treatments.length}</span>
          <span className="stat-label">Treatments</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{uniqueAthletes}</span>
          <span className="stat-label">Athletes</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMinutes}</span>
          <span className="stat-label">Total Minutes</span>
        </div>
      </div>

      {/* Table */}
      {treatments.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>No treatments logged yet today.</p>
          <p className="empty-sub">This page updates automatically — no need to refresh.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Athlete</th>
                <th>Treatment</th>
                <th>Body Part</th>
                <th>Duration</th>
                <th>Logged By</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map((t) => (
                <tr key={t.id} className={newIds.has(t.id) ? 'row--new' : ''}>
                  <td className="cell-time">{formatTime(t.created_at)}</td>
                  <td className="cell-athlete">
                    <Link
                      to={`/athletes/${encodeURIComponent(t.athlete_name)}`}
                      className="athlete-cell-link"
                    >
                      {t.athlete_name}
                    </Link>
                  </td>
                  <td>
                    <span
                      className="type-badge"
                      style={{
                        backgroundColor: typeColor(t.treatment_type) + '22',
                        color: typeColor(t.treatment_type),
                        borderColor: typeColor(t.treatment_type) + '55',
                      }}
                    >
                      {t.treatment_type}
                    </span>
                  </td>
                  <td>{t.body_part}</td>
                  <td className="cell-duration">
                    {t.duration_minutes ? `${t.duration_minutes} min` : '—'}
                  </td>
                  <td className="cell-trainer">{trainerLabel(t.logged_by_email)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
