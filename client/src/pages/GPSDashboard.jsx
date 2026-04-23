import { useState, useEffect, useRef } from 'react';
import { parsePlayerDataCSV } from '../lib/parsePlayerDataCSV.js';
import api from '../lib/api.js';
import './GPSDashboard.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function avatarStyle(risk) {
  if (risk === 'red')    return { background: '#fee2e2', color: '#b91c1c' };
  if (risk === 'yellow') return { background: '#fef3c7', color: '#92400e' };
  return { background: '#dcfce7', color: '#166534' };
}

function fmtLoad(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString();
}

function fmtDist(yds) {
  if (yds == null) return '—';
  return (parseFloat(yds) / 1000 || 0).toFixed(1) + 'k';
}

function fmtSpeed(n) {
  if (n == null) return '—';
  return (parseFloat(n) || 0).toFixed(1);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { key: 'all',              label: 'All athletes' },
  { key: 'red',              label: 'High risk' },
  { key: 'yellow',           label: 'Monitor' },
  { key: 'Training Session', label: 'Training' },
  { key: 'Match Session',    label: 'Match' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function GPSDashboard() {
  const [athletes,         setAthletes]         = useState([]);
  const [selectedAthlete,  setSelectedAthlete]  = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [filter,           setFilter]           = useState('all');
  const [sessionTypeIds,   setSessionTypeIds]   = useState({});
  const [loading,          setLoading]          = useState(true);
  const [importing,        setImporting]        = useState(false);
  const [toast,            setToast]            = useState(null);
  const [dragOver,         setDragOver]         = useState(false);
  const [insights,         setInsights]         = useState([]);
  const [insightsLoading,  setInsightsLoading]  = useState(false);
  const [schoolName,       setSchoolName]       = useState('');

  const fileInputRef = useRef(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function loadDashboard() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/gps/dashboard');
      setAthletes(data.athletes ?? []);
      setSessionTypeIds(data.sessionTypeIds ?? {});
      setSchoolName(data.schoolName ?? '');
      if (data.insights?.length > 0) setInsights(data.insights);
    } catch (err) {
      setToast({ message: err.response?.data?.error ?? err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Import pipeline ────────────────────────────────────────────────────────

  async function handleFile(file) {
    setImporting(true);

    let parsed;
    try {
      parsed = await parsePlayerDataCSV(file);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      setImporting(false);
      return;
    }

    const { athletes: parsedAthletes, sessions, zeroData, batch } = parsed;

    try {
      // Strip athlete-only fields that don't belong in gps_sessions
      const cleanSession = ({ name, position, sport, team, max_speed_mph, ...s }) => s;

      const { data: importResult } = await api.post('/api/gps/import', {
        athletes: [...parsedAthletes.values()],
        sessions: sessions.map(cleanSession),
        zeroData: zeroData.map(cleanSession),
        batchInfo: batch,
      });

      const zeroNote = zeroData.length ? ` ${zeroData.length} zero-data sessions logged.` : '.';
      setToast({
        message: `Imported ${importResult.sessionsImported} sessions for ${importResult.athletesImported} athletes${zeroNote}`,
        type: 'success',
      });

      await loadDashboard();

      // Generate AI insights from the freshly imported athlete data
      generateInsights([...parsedAthletes.values()]);
    } catch (err) {
      setToast({ message: err.response?.data?.error ?? err.message, type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  // ── AI insights ───────────────────────────────────────────────────────────

  async function generateInsights(athleteData) {
    setInsightsLoading(true);
    try {
      const redCount    = athleteData.filter((a) => a.risk_status === 'red').length;
      const yellowCount = athleteData.filter((a) => a.risk_status === 'yellow').length;
      const greenCount  = athleteData.filter((a) => a.risk_status === 'green').length;
      const totalSessions = athleteData.reduce((sum, a) => sum + (a.weekly_sessions ?? 0), 0);

      const athleteLines = athleteData.map((a) => {
        const season = (a.weekly_sessions > 0 && a.session_type === 'Match Session') ? 'in-season' : 'offseason';
        return `- ${a.name} (${a.position ?? 'unknown position'}): ACWR=${(a.acwr ?? 1).toFixed(2)}, load=${Math.round(a.weekly_session_load ?? 0)}, dist=${Math.round(a.weekly_distance_yds ?? 0)} yds, HI=${Math.round(a.weekly_hi_yds ?? 0)} yds, sprints=${Math.round(a.weekly_sprint_yds ?? 0)} yds, risk=${a.risk_status ?? 'green'}, ${season}`;
      }).join('\n');

      const teamLabel = schoolName ? `${schoolName} Football` : 'Football';
      const prompt = `Team: ${teamLabel}\nTotal athletes: ${athleteData.length}\nRisk summary: ${redCount} high-risk, ${yellowCount} monitor, ${greenCount} green\nTotal sessions this week: ${totalSessions}\n\nAthlete breakdown:\n${athleteLines}`;

      const { data: json } = await api.post('/api/anthropic/messages', {
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: "You are an expert sports scientist and athletic trainer assistant. Analyze the GPS load data provided and generate 3-5 concise, actionable insights about the team's current workload status. Each insight should be 1-2 sentences. Focus on: athletes with concerning ACWR trends, week-over-week load spikes, athletes with zero-data sessions, positive callouts for well-managed athletes, and team-level patterns. Be specific — use athlete names and actual numbers. Format your response as a JSON array of objects, each with two fields: 'text' (the insight string) and 'type' (one of: 'alert', 'warn', 'good', 'info'). Return only the JSON array, no other text.",
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = json?.content?.[0]?.text ?? '[]';
      const clean = raw.replace(/```json|```/g, '').trim();
      const insightData = Array.isArray(JSON.parse(clean)) ? JSON.parse(clean) : [];
      setInsights(insightData);

      // Persist to server
      await api.post('/api/gps/insights', { insights: insightData });
    } catch (err) {
      console.error('[GPS insights] failed:', err);
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }

  // ── Upload zone handlers ───────────────────────────────────────────────────

  function handleDragOver(e) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave()  { setDragOver(false); }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }
  function handleInputChange(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  // ── Athlete card selection ─────────────────────────────────────────────────

  async function selectAthlete(athlete) {
    if (selectedAthlete?.id === athlete.id) {
      setSelectedAthlete(null);
      setSelectedSessions([]);
      return;
    }
    setSelectedAthlete(athlete);
    try {
      const { data } = await api.get(`/api/gps/sessions/${encodeURIComponent(athlete.id)}`);
      setSelectedSessions(data ?? []);
    } catch (err) {
      console.error('[GPS selectAthlete]', err);
      setSelectedSessions([]);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const totalAthletes    = athletes.length;
  const highRiskCount    = athletes.filter((a) => a.risk_status === 'red').length;
  const monitorCount     = athletes.filter((a) => a.risk_status === 'yellow').length;
  const sessionsThisWeek = athletes.reduce((sum, a) => sum + (a.weekly_sessions ?? 0), 0);

  const filteredAthletes = (() => {
    if (filter === 'all')    return athletes;
    if (filter === 'red')    return athletes.filter((a) => a.risk_status === 'red');
    if (filter === 'yellow') return athletes.filter((a) => a.risk_status === 'yellow');
    // sessionTypeIds values are arrays (from server JSON)
    const ids = sessionTypeIds[filter] ?? [];
    return athletes.filter((a) => ids.includes(a.id));
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        <span>Loading GPS data…</span>
      </div>
    );
  }

  return (
    <div className="gps-page">

      {/* Page header + upload zone */}
      <div className="gps-page-header">
        <div>
          <h1 className="page-title">GPS Dashboard</h1>
          <p className="page-subtitle">{schoolName ? `GPS Data — ${schoolName}` : 'GPS Data'}</p>
        </div>

        <div
          className={`gps-upload-zone${dragOver ? ' gps-upload-zone--drag' : ''}${importing ? ' gps-upload-zone--importing' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !importing && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload PlayerData CSV export"
          onKeyDown={(e) => e.key === 'Enter' && !importing && fileInputRef.current?.click()}
        >
          {importing ? (
            <>
              <div className="spinner gps-upload-spinner" />
              <span className="gps-upload-text">Importing…</span>
            </>
          ) : (
            <>
              <svg className="gps-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="gps-upload-text">Upload PlayerData CSV export</span>
              <span className="gps-upload-sub">Whole Session rows imported automatically · drag &amp; drop or click</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="gps-upload-input"
            onChange={handleInputChange}
            tabIndex={-1}
          />
        </div>
      </div>

      {/* AI Insights panel */}
      {(insights.length > 0 || insightsLoading) && (
        <div className="insights-panel">
          <div className="insights-header">
            <span className="insights-dot" />
            <span className="insights-title">AI insights</span>
            <span className="insights-date">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {insightsLoading ? (
            <div className="insights-loading">
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Generating insights…</span>
            </div>
          ) : (
            insights.map((insight, i) => (
              <div key={i} className={`insight-row insight-${insight.type}`}>
                {insight.text}
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary strip */}
      <div className="gps-stats-strip">
        <div className="gps-stat-card">
          <span className="gps-stat-value">{totalAthletes}</span>
          <span className="gps-stat-label">Athletes tracked</span>
        </div>
        <div className="gps-stat-card gps-stat-card--red">
          <span className="gps-stat-value">{highRiskCount}</span>
          <span className="gps-stat-label">High risk</span>
        </div>
        <div className="gps-stat-card gps-stat-card--amber">
          <span className="gps-stat-value">{monitorCount}</span>
          <span className="gps-stat-label">Monitor</span>
        </div>
        <div className="gps-stat-card">
          <span className="gps-stat-value">{sessionsThisWeek}</span>
          <span className="gps-stat-label">Sessions this week</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="gps-filter-bar" role="group" aria-label="Filter athletes">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`gps-filter-btn${filter === key ? ' gps-filter-btn--active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Athlete grid */}
      {filteredAthletes.length === 0 ? (
        <p className="gps-empty">
          {athletes.length === 0
            ? 'No GPS data imported yet. Upload a Catapult PlayerData CSV to get started.'
            : 'No athletes match this filter.'}
        </p>
      ) : (
        <div className="gps-athlete-grid">
          {filteredAthletes.map((athlete) => {
            const isSelected = selectedAthlete?.id === athlete.id;
            const risk = athlete.risk_status ?? 'green';
            const acwr = athlete.acwr ?? 1;
            const acwrWidth = Math.min(100, (acwr / 2) * 100);

            return (
              <article
                key={athlete.id}
                className={`gps-athlete-card${isSelected ? ' gps-athlete-card--selected' : ''}`}
                onClick={() => selectAthlete(athlete)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && selectAthlete(athlete)}
              >
                {/* Header */}
                <div className="gps-card-header">
                  <div className="gps-card-header-left">
                    <span className="gps-avatar" style={avatarStyle(risk)}>
                      {getInitials(athlete.name)}
                    </span>
                    <div className="gps-card-name-block">
                      <span className="gps-card-name">{athlete.name}</span>
                      {athlete.position && (
                        <span className="gps-card-position">{athlete.position}</span>
                      )}
                    </div>
                  </div>
                  {risk !== 'green' && (
                    <span className={`gps-risk-badge gps-risk-badge--${risk}`}>
                      {risk === 'red' ? 'High risk' : 'Monitor'}
                    </span>
                  )}
                </div>

                {/* Metrics */}
                <div className="gps-metrics-row">
                  <div className="gps-metric">
                    <span className="gps-metric-value">{fmtLoad(athlete.weekly_session_load)}</span>
                    <span className="gps-metric-label">Load pts</span>
                  </div>
                  <div className="gps-metric">
                    <span className="gps-metric-value">{fmtDist(athlete.weekly_distance_yds)}</span>
                    <span className="gps-metric-label">Dist yds</span>
                  </div>
                  <div className="gps-metric">
                    <span className="gps-metric-value">{fmtSpeed(athlete.max_speed_mph)}</span>
                    <span className="gps-metric-label">Top mph</span>
                  </div>
                </div>

                {/* ACWR bar */}
                <div className="gps-acwr-row">
                  <span className="gps-acwr-label">ACWR</span>
                  <div className="gps-acwr-bar-track">
                    <div
                      className={`gps-acwr-bar-fill gps-acwr-bar-fill--${risk}`}
                      style={{ width: `${acwrWidth}%` }}
                    />
                  </div>
                  <span className="gps-acwr-value">{(parseFloat(acwr) || 0).toFixed(2)}</span>
                </div>

                {/* New top speed */}
                {athlete.new_top_speed && (
                  <div className="gps-new-top-speed">New top speed</div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Session history table */}
      {selectedAthlete && (
        <section className="gps-session-section">
          <h2 className="gps-session-heading">
            {selectedAthlete.name} — Recent Sessions
          </h2>
          <div className="gps-session-table-wrap">
            <table className="gps-session-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Load</th>
                  <th>Distance (yds)</th>
                  <th>HI Running (yds)</th>
                  <th>Sprints</th>
                  <th>Acc / Dec</th>
                  <th>Top Speed</th>
                </tr>
              </thead>
              <tbody>
                {selectedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="gps-table-empty">No sessions found.</td>
                  </tr>
                ) : (
                  selectedSessions.map((s, i) => {
                    const isMatch = s.session_type?.toLowerCase().includes('match');
                    if (s.data_recorded === false) {
                      return (
                        <tr key={i} className="gps-row-zero">
                          <td>{fmtDate(s.session_date)}</td>
                          <td>
                            {s.session_type && (
                              <span className={`gps-type-badge${isMatch ? ' gps-type-badge--match' : ''}`}>
                                {s.session_type}
                              </span>
                            )}
                          </td>
                          <td colSpan={6} className="gps-no-data">No data recorded</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={i}>
                        <td>{fmtDate(s.session_date)}</td>
                        <td>
                          {s.session_type && (
                            <span className={`gps-type-badge${isMatch ? ' gps-type-badge--match' : ''}`}>
                              {s.session_type}
                            </span>
                          )}
                        </td>
                        <td>{fmtLoad(s.session_load)}</td>
                        <td>{s.distance_yds != null ? Math.round(s.distance_yds).toLocaleString() : '—'}</td>
                        <td>{s.hi_running_yds != null ? Math.round(s.hi_running_yds).toLocaleString() : '—'}</td>
                        <td>{s.num_sprints ?? '—'}</td>
                        <td>
                          {s.accelerations != null
                            ? `${s.accelerations} / ${s.decelerations ?? '—'}`
                            : '—'}
                        </td>
                        <td>
                          {s.top_speed_mph != null ? `${s.top_speed_mph.toFixed(1)} mph` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className={`gps-toast gps-toast--${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

    </div>
  );
}
