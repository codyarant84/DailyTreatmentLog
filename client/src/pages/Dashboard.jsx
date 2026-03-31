import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import api from '../lib/api.js';
import './Dashboard.css';

const TREATMENT_COLORS = {
  'Ice':        '#2980b9',
  'Heat':       '#e67e22',
  'Ultrasound': '#2c3e50',
  'E-Stim':     '#d35400',
  'Massage':    '#8e44ad',
  'Taping':     '#16a085',
  'Exercise':   '#c0392b',
  'Cupping':    '#6d4c8f',
};

function typeColor(t) {
  return TREATMENT_COLORS[t.trim()] ?? '#7f8c8d';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatFullDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// "john.smith@westview.edu" → "john.smith"
function trainerLabel(email) {
  if (!email) return null;
  return email.split('@')[0];
}

function DayCard({ treatment, isNew }) {
  const types = treatment.treatment_type
    ? treatment.treatment_type.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  const exercises = treatment.exercises_performed
    ? treatment.exercises_performed.split(',').map((e) => e.trim()).filter(Boolean)
    : [];
  const logger = trainerLabel(treatment.logged_by_email);

  return (
    <article className={`day-card${isNew ? ' day-card--new' : ''}`}>
      <div className="day-card-header">
        <div className="day-card-top-left">
          <Link
            to={`/athletes/${encodeURIComponent(treatment.athlete_name)}`}
            className="day-card-athlete"
          >
            {treatment.athlete_name}
          </Link>
          {treatment.sport && (
            <span className="day-card-sport">{treatment.sport}</span>
          )}
        </div>
        <div className="day-card-top-right">
          <span className="day-card-time">{formatTime(treatment.created_at)}</span>
          <Link
            to={`/treatments/${treatment.id}/edit`}
            className="day-card-edit"
            title="Edit treatment"
          >
            ✏
          </Link>
        </div>
      </div>

      <div className="day-card-tags">
        {types.map((type) => (
          <span
            key={type}
            className="type-badge"
            style={{
              backgroundColor: typeColor(type) + '22',
              color: typeColor(type),
              borderColor: typeColor(type) + '55',
            }}
          >
            {type}
          </span>
        ))}
        <span className="day-card-tag day-card-tag--body">{treatment.body_part}</span>
        {treatment.duration_minutes && (
          <span className="day-card-tag day-card-tag--duration">
            {treatment.duration_minutes} min
          </span>
        )}
      </div>

      {exercises.length > 0 && (
        <div className="day-card-exercises">
          {exercises.map((ex) => (
            <span key={ex} className="day-card-exercise-tag">{ex}</span>
          ))}
        </div>
      )}

      {treatment.notes && (
        <p className="day-card-notes">{treatment.notes}</p>
      )}

      {logger && (
        <div className="day-card-footer">
          Logged by <strong>{logger}</strong>
        </div>
      )}
    </article>
  );
}

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];

  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [schoolId, setSchoolId]     = useState(null);
  const [newIds, setNewIds]         = useState(new Set());

  // Fetch school_id for realtime filter
  useEffect(() => {
    api.get('/api/auth/me')
      .then(({ data }) => setSchoolId(data.school_id))
      .catch(() => setError('Could not load your profile. Try refreshing.'));
  }, []);

  // Fetch today's treatments
  useEffect(() => {
    api.get(`/api/daily-treatments?date=${today}`)
      .then(({ data }) => setTreatments(data))
      .catch((err) => setError(err.response?.data?.error ?? "Failed to load today's treatments."))
      .finally(() => setLoading(false));
  }, [today]);

  // Realtime subscription — INSERT, UPDATE, DELETE
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
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'daily_treatments',
        filter: `school_id=eq.${schoolId}`,
      }, ({ new: row }) => {
        if (row.date !== today) return;
        setTreatments((prev) => {
          if (prev.some((t) => t.id === row.id)) return prev;
          return [row, ...prev];
        });
        flashNew(row.id);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'daily_treatments',
        filter: `school_id=eq.${schoolId}`,
      }, ({ new: row }) => {
        setTreatments((prev) =>
          row.date === today
            ? prev.map((t) => (t.id === row.id ? row : t))
            : prev.filter((t) => t.id !== row.id)
        );
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'daily_treatments',
        filter: `school_id=eq.${schoolId}`,
      }, ({ old: row }) => {
        setTreatments((prev) => prev.filter((t) => t.id !== row.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [schoolId, today]);

  // Sort most recent first
  const sorted = [...treatments].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // Derived stats always from full treatments list
  const totalMinutes   = treatments.reduce((n, t) => n + (t.duration_minutes ?? 0), 0);
  const uniqueAthletes = new Set(treatments.map((t) => t.athlete_name)).size;

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

      {error && <div className="state-msg state-msg--error"><p>{error}</p></div>}

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

      {/* Treatment cards */}
      {sorted.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>No treatments logged yet today.</p>
          <p className="empty-sub">This page updates automatically — no need to refresh.</p>
          <Link to="/new" className="btn btn--primary">Log First Treatment</Link>
        </div>
      ) : (
        <div className="day-card-list">
          {sorted.map((t) => (
            <DayCard key={t.id} treatment={t} isNew={newIds.has(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
