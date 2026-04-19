import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Landing.css';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(session) {
  const meta = session?.user?.user_metadata;
  if (meta?.full_name) return meta.full_name.split(' ')[0];
  if (meta?.name) return meta.name.split(' ')[0];
  const email = session?.user?.email ?? '';
  const local = email.split('@')[0];
  // Only extract if the local part has a separator suggesting first.last format
  if (local.includes('.') || local.includes('_')) {
    const part = local.split(/[._]/)[0];
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
  }
  return '';
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const RTP_META = {
  'Full Participation':    { bg: '#d1fae5', color: '#065f46' },
  'Limited Participation': { bg: '#fef3c7', color: '#92400e' },
  'Out':                   { bg: '#fee2e2', color: '#991b1b' },
  'Cleared':               { bg: '#ede9fe', color: '#4c1d95' },
};

const RISK_META = {
  red:    { bg: '#fee2e2', color: '#991b1b', label: 'High risk' },
  yellow: { bg: '#fef3c7', color: '#92400e', label: 'Caution' },
};

export default function Landing() {
  const { session } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [loading, setLoading] = useState(true);
  const [todayTreatments, setTodayTreatments] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [allTreatments, setAllTreatments] = useState([]);
  const [gpsAlerts, setGpsAlerts] = useState([]);
  const [activeConcussions, setActiveConcussions] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [todayRes, injuriesRes, athletesRes, allTreatmentsRes, gpsDashRes, concussionsRes] = await Promise.all([
          api.get(`/api/daily-treatments?date=${today}`),
          api.get('/api/injuries'),
          api.get('/api/athletes'),
          api.get('/api/daily-treatments'),
          api.get('/api/gps/dashboard'),
          api.get('/api/concussions?status=active'),
        ]);

        setTodayTreatments(todayRes.data ?? []);
        setInjuries(injuriesRes.data ?? []);
        setAthletes(athletesRes.data ?? []);
        setAllTreatments(allTreatmentsRes.data ?? []);

        // GPS alerts: dashboard already returns most recent load per athlete
        const alerts = (gpsDashRes.data.athletes ?? [])
          .filter((a) => a.risk_status === 'red' || a.risk_status === 'yellow');
        setGpsAlerts(alerts);

        setActiveConcussions((concussionsRes.data ?? []).length);
      } catch (err) {
        console.error('Landing load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today]);

  // ── Derived data ──────────────────────────────────────────────────
  const activeInjuries = injuries.filter((i) => i.rtp_status !== 'Cleared');
  const activeInjuryNames = new Set(activeInjuries.map((i) => i.athlete_name));
  const clearedCount = athletes.filter((a) => !activeInjuryNames.has(a.name)).length;

  // Most recent treatment date per athlete name
  const latestTx = {};
  allTreatments.forEach((t) => {
    if (!latestTx[t.athlete_name] || t.date > latestTx[t.athlete_name]) {
      latestTx[t.athlete_name] = t.date;
    }
  });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const inactiveAthletes = athletes
    .filter((a) => {
      const last = latestTx[a.name];
      return !last || new Date(last) < cutoff;
    })
    .map((a) => ({ ...a, lastDate: latestTx[a.name] ?? null }));

  const firstName = getFirstName(session);
  const todaySorted = [...todayTreatments].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="landing">

      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="landing-header">
        <div className="landing-greeting">
          <h1 className="page-title">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="page-subtitle">Here's what's happening today.</p>
        </div>
        <div className="landing-actions">
          <Link to="/new" className="btn btn--primary landing-action-btn">+ Log Treatment</Link>
          <Link to="/injuries?new=1" className="btn btn--outline landing-action-btn">+ Log Injury</Link>
          <Link to="/gps" className="btn btn--outline landing-action-btn">Import GPS</Link>
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────── */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{loading ? '—' : todayTreatments.length}</span>
          <span className="stat-label">Treated today</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{loading ? '—' : activeInjuries.length}</span>
          <span className="stat-label">Active injuries</span>
        </div>
        <div className="stat-card">
          <span className="stat-value stat-value--alert">
            {loading ? '—' : gpsAlerts.length}
          </span>
          <span className="stat-label">Load alerts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{loading ? '—' : clearedCount}</span>
          <span className="stat-label">Cleared to play</span>
        </div>
        <div className="stat-card">
          <span className="stat-value stat-value--alert">
            {loading ? '—' : activeConcussions}
          </span>
          <span className="stat-label">Active concussions</span>
        </div>
      </div>

      {/* ── Main two-col grid ───────────────────────────────────────── */}
      <div className="landing-grid">

        {/* Today's treatments */}
        <section className="landing-section">
          <div className="section-header">
            <h2 className="section-title">Today's treatments</h2>
            <Link to="/dashboard" className="section-link">View all</Link>
          </div>
          {loading ? (
            <div className="section-loading"><div className="spinner" /></div>
          ) : todaySorted.length === 0 ? (
            <div className="section-empty">
              <p>No treatments logged today.</p>
              <Link to="/new" className="btn btn--primary btn--sm">+ Log Treatment</Link>
            </div>
          ) : (
            <div className="compact-card-list">
              {todaySorted.slice(0, 5).map((t) => {
                const types = t.treatment_type
                  ? t.treatment_type.split(',').map((s) => s.trim()).filter(Boolean)
                  : [];
                return (
                  <div key={t.id} className="compact-card">
                    <div className="compact-card-main">
                      <Link
                        to={`/athletes/${encodeURIComponent(t.athlete_name)}`}
                        className="compact-card-name"
                      >
                        {t.athlete_name}
                      </Link>
                      <div className="compact-card-tags">
                        {t.sport && <span className="compact-sport-badge">{t.sport}</span>}
                        {types.map((tp) => (
                          <span key={tp} className="compact-type-badge">{tp}</span>
                        ))}
                        {t.body_part && <span className="compact-body-badge">{t.body_part}</span>}
                      </div>
                    </div>
                    <span className="compact-card-time">{formatTime(t.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active injuries */}
        <section className="landing-section">
          <div className="section-header">
            <h2 className="section-title">Active injuries</h2>
            <Link to="/injuries" className="section-link">View all</Link>
          </div>
          {loading ? (
            <div className="section-loading"><div className="spinner" /></div>
          ) : activeInjuries.length === 0 ? (
            <div className="section-empty"><p>No active injuries.</p></div>
          ) : (
            <div className="compact-card-list">
              {activeInjuries.slice(0, 5).map((inj) => {
                const rtp = RTP_META[inj.rtp_status] ?? { bg: '#f3f4f6', color: '#374151' };
                const days = daysSince(inj.injury_date);
                return (
                  <Link key={inj.id} to={`/injuries/${inj.id}`} className="compact-card compact-card--link">
                    <div className="compact-card-main">
                      <span className="compact-card-name">{inj.athlete_name}</span>
                      <div className="compact-card-tags">
                        <span className="compact-type-badge">{inj.injury_type}</span>
                        {inj.body_part && <span className="compact-body-badge">{inj.body_part}</span>}
                      </div>
                    </div>
                    <div className="compact-card-right">
                      {days !== null && (
                        <span className="compact-days">{days}d</span>
                      )}
                      <span
                        className="compact-rtp-badge"
                        style={{ background: rtp.bg, color: rtp.color }}
                      >
                        {inj.rtp_status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ── Bottom two-col grid ─────────────────────────────────────── */}
      <div className="landing-grid">

        {/* GPS load alerts */}
        <section className="landing-section">
          <div className="section-header">
            <h2 className="section-title">GPS load alerts</h2>
            <Link to="/gps" className="section-link">View all</Link>
          </div>
          {loading ? (
            <div className="section-loading"><div className="spinner" /></div>
          ) : gpsAlerts.length === 0 ? (
            <div className="section-empty"><p>No load alerts this week.</p></div>
          ) : (
            <div className="compact-card-list">
              {gpsAlerts.slice(0, 5).map((row) => {
                const risk = RISK_META[row.risk_status] ?? { bg: '#f3f4f6', color: '#374151', label: row.risk_status };
                return (
                  <div key={row.id} className="compact-card">
                    <div className="compact-card-main">
                      <span className="compact-card-name">{row.name}</span>
                      <span className="compact-acwr">
                        ACWR {row.acwr != null ? Number(row.acwr).toFixed(2) : '—'}
                      </span>
                    </div>
                    <span
                      className="compact-rtp-badge"
                      style={{ background: risk.bg, color: risk.color }}
                    >
                      {risk.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Inactive athletes */}
        <section className="landing-section">
          <div className="section-header">
            <h2 className="section-title">Inactive athletes</h2>
            <Link to="/athletes" className="section-link">View all</Link>
          </div>
          {loading ? (
            <div className="section-loading"><div className="spinner" /></div>
          ) : inactiveAthletes.length === 0 ? (
            <div className="section-empty"><p>All athletes have been seen recently.</p></div>
          ) : (
            <div className="compact-card-list">
              {inactiveAthletes.slice(0, 5).map((a) => (
                <div key={a.id} className="compact-card">
                  <div className="compact-card-main">
                    <Link
                      to={`/athletes/${encodeURIComponent(a.name)}`}
                      className="compact-card-name"
                    >
                      {a.name}
                    </Link>
                    {a.sport && <span className="compact-sport-badge">{a.sport}</span>}
                  </div>
                  <span className="compact-days compact-days--muted">
                    {a.lastDate ? `${daysSince(a.lastDate)}d ago` : 'Never treated'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── Schedule placeholder ────────────────────────────────────── */}
      <div className="schedule-placeholder">
        <div className="schedule-placeholder-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div className="schedule-placeholder-text">
          <div className="schedule-placeholder-heading">
            Scheduling
            <span className="schedule-coming-soon">Coming soon</span>
          </div>
          <p className="schedule-placeholder-sub">Appointment scheduling coming soon.</p>
        </div>
      </div>

    </div>
  );
}
