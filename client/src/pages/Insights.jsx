import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line,
} from 'recharts';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Insights.css';

// ── Date helpers ──────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getSeasonStart() {
  const d = new Date();
  const year = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-08-01`;
}

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

const MONTH_START  = getMonthStart();
const SEASON_START = getSeasonStart();
const WEEK_START   = getWeekStart();

const RANGES = {
  week:   { label: 'This Week',   from: WEEK_START,   to: TODAY },
  month:  { label: 'This Month',  from: MONTH_START,  to: TODAY },
  season: { label: 'This Season', from: SEASON_START, to: TODAY },
  all:    { label: 'All Time',    from: null,          to: null  },
};

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = [
  '#1d6fa5', '#2ecc71', '#e67e22', '#9b59b6',
  '#e74c3c', '#1abc9c', '#f39c12', '#16a085',
  '#8e44ad', '#2980b9',
];

const TYPE_COLORS = {
  'Ice':        '#2980b9',
  'Heat':       '#e67e22',
  'Ultrasound': '#34495e',
  'E-Stim':     '#d35400',
  'Massage':    '#8e44ad',
  'Taping':     '#16a085',
  'Exercise':   '#c0392b',
  'Cupping':    '#6d4c8f',
};

// ── Misc helpers ──────────────────────────────────────────────────────────────
function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function countBy(arr, key) {
  const map = {};
  arr.forEach((item) => {
    const val = item[key] || 'Unknown';
    map[val] = (map[val] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div className="ins-section-header">
      <h2 className="ins-section-title">{title}</h2>
      {subtitle && <p className="ins-section-sub">{subtitle}</p>}
    </div>
  );
}

function StatCard({ value, label, sub, accent }) {
  return (
    <div className={`ins-stat-card ${accent ? `ins-stat-card--${accent}` : ''}`}>
      <span className="ins-stat-value">{value}</span>
      <span className="ins-stat-label">{label}</span>
      {sub && <span className="ins-stat-sub">{sub}</span>}
    </div>
  );
}

function HBarChart({ data, color = '#1d6fa5', maxBars = 8 }) {
  const shown = data.slice(0, maxBars);
  if (shown.length === 0) return <p className="ins-empty-chart">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={shown.length * 36 + 8}>
      <BarChart data={shown} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 12, fill: 'var(--ins-text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [v, 'Count']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: 'var(--ins-text-muted)' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VBarChart({ data, multiColor = false, color = '#1d6fa5' }) {
  if (data.length === 0) return <p className="ins-empty-chart">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--ins-text-muted)' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--ins-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip
          formatter={(v) => [v, 'Treatments']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={multiColor ? PALETTE[i % PALETTE.length] : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Sparkline({ data }) {
  return (
    <LineChart width={88} height={30} data={data}>
      <Line
        type="monotone"
        dataKey="v"
        stroke="var(--color-primary, #1d6fa5)"
        dot={false}
        strokeWidth={1.5}
      />
    </LineChart>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Insights() {
  const { branding } = useAuth();
  const costPerVisit = branding?.costPerVisit ?? 50;

  const [treatments, setTreatments] = useState([]);
  const [injuries,   setInjuries]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [range,      setRange]      = useState('month');

  useEffect(() => {
    Promise.all([
      api.get('/api/daily-treatments'),
      api.get('/api/injuries'),
    ]).then(([tRes, iRes]) => {
      setTreatments(tRes.data);
      setInjuries(iRes.data);
    }).catch((err) => {
      setError(err.response?.data?.error ?? err.message);
    }).finally(() => setLoading(false));
  }, []);

  // ── Section 1: Treatment Trends ────────────────────────────────────────────
  const rangeFiltered = useMemo(() => {
    const { from, to } = RANGES[range];
    return treatments.filter((t) => {
      if (from && t.date < from) return false;
      if (to   && t.date > to)   return false;
      return true;
    });
  }, [treatments, range]);

  const bodyPartData = useMemo(() => countBy(rangeFiltered, 'body_part').slice(0, 5), [rangeFiltered]);

  const sportTrendData = useMemo(() => countBy(rangeFiltered, 'sport'), [rangeFiltered]);

  const typeBreakdown = useMemo(() => {
    const counts = {};
    rangeFiltered.forEach((t) => {
      if (!t.treatment_type) return;
      t.treatment_type.split(',').map((s) => s.trim()).forEach((type) => {
        counts[type] = (counts[type] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [rangeFiltered]);

  // ── Section 2: Injury Tracker ──────────────────────────────────────────────
  const activeInjuries = useMemo(() => injuries.filter((i) => i.is_active), [injuries]);

  const injByBodyPart = useMemo(() => countBy(activeInjuries, 'body_part'), [activeInjuries]);

  const injBySport = useMemo(() => {
    return countBy(activeInjuries.map((i) => ({ ...i, sport: i.athlete_sport || 'Unknown' })), 'sport');
  }, [activeInjuries]);

  const avgDaysToRtp = useMemo(() => {
    const cleared = injuries.filter(
      (i) => !i.is_active && i.rtp_status === 'Cleared' && i.cleared_at && i.injury_date
    );
    if (cleared.length === 0) return null;
    const total = cleared.reduce((sum, i) => {
      const days = Math.floor((new Date(i.cleared_at) - new Date(i.injury_date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
      return sum + Math.max(0, days);
    }, 0);
    return Math.round(total / cleared.length);
  }, [injuries]);

  const flaggedOut = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return activeInjuries
      .filter((i) => i.rtp_status === 'Out' && i.injury_date <= cutoffStr)
      .sort((a, b) => a.injury_date.localeCompare(b.injury_date));
  }, [activeInjuries]);

  // ── Section 3: Athlete Workload ────────────────────────────────────────────
  const monthTreatments  = useMemo(() => treatments.filter((t) => t.date >= MONTH_START),  [treatments]);
  const past7Treatments  = useMemo(() => treatments.filter((t) => t.date >= WEEK_START),   [treatments]);

  const topAthletes = useMemo(() => {
    return countBy(monthTreatments, 'athlete_name').slice(0, 10);
  }, [monthTreatments]);

  const overuseFlags = useMemo(() => {
    return countBy(past7Treatments, 'athlete_name').filter((r) => r.count >= 5);
  }, [past7Treatments]);

  // Sparkline data: weekly visit counts for the past 8 weeks per athlete
  const sparklineCache = useMemo(() => {
    const cache = {};
    topAthletes.forEach(({ name }) => {
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const wEnd = new Date(); wEnd.setDate(wEnd.getDate() - i * 7);
        const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 6);
        const ws = wStart.toISOString().split('T')[0];
        const we = wEnd.toISOString().split('T')[0];
        const v = treatments.filter((t) => t.athlete_name === name && t.date >= ws && t.date <= we).length;
        weeks.push({ w: 8 - i, v });
      }
      cache[name] = weeks;
    });
    return cache;
  }, [topAthletes, treatments]);

  // ── Section 4: Program Summary ─────────────────────────────────────────────
  const seasonTreatments = useMemo(() => treatments.filter((t) => t.date >= SEASON_START), [treatments]);

  const summaryMonth  = useMemo(() => ({
    count:    monthTreatments.length,
    minutes:  monthTreatments.reduce((s, t) => s + (t.duration_minutes ?? 0), 0),
    athletes: new Set(monthTreatments.map((t) => t.athlete_name)).size,
    savings:  monthTreatments.length * costPerVisit,
  }), [monthTreatments, costPerVisit]);

  const summarySeason = useMemo(() => ({
    count:    seasonTreatments.length,
    minutes:  seasonTreatments.reduce((s, t) => s + (t.duration_minutes ?? 0), 0),
    athletes: new Set(seasonTreatments.map((t) => t.athlete_name)).size,
    savings:  seasonTreatments.length * costPerVisit,
  }), [seasonTreatments, costPerVisit]);

  const dowData = useMemo(() => {
    const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    treatments.forEach((t) => {
      if (!t.date) return;
      const [y, m, d] = t.date.split('-');
      counts[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]++;
    });
    return NAMES.map((name, i) => ({ name, count: counts[i] }));
  }, [treatments]);

  const busiestDay = useMemo(() => {
    if (treatments.length === 0) return null;
    return dowData.reduce((best, cur) => cur.count > best.count ? cur : best, dowData[0]).name;
  }, [dowData, treatments.length]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="insights-page">

      {/* Page header + range filter */}
      <div className="ins-page-header">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Clinical analytics for your athletic training program.</p>
        </div>
        <div className="ins-range-tabs" role="group" aria-label="Date range">
          {Object.entries(RANGES).map(([key, { label }]) => (
            <button
              key={key}
              className={`ins-range-tab ${range === key ? 'ins-range-tab--active' : ''}`}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 1: Treatment Trends ──────────────────────────────────── */}
      <section className="ins-section">
        <SectionHeader
          title="Treatment Trends"
          subtitle={`${rangeFiltered.length} treatment${rangeFiltered.length !== 1 ? 's' : ''} — ${RANGES[range].label.toLowerCase()}`}
        />

        {rangeFiltered.length === 0 ? (
          <p className="ins-empty">No treatments in this date range.</p>
        ) : (
          <>
            <div className="ins-chart-row">
              <div className="ins-chart-card">
                <h3 className="ins-chart-title">Top Body Parts</h3>
                <VBarChart data={bodyPartData} color="var(--color-primary, #1d6fa5)" />
              </div>
              <div className="ins-chart-card">
                <h3 className="ins-chart-title">Treatments by Sport</h3>
                <VBarChart data={sportTrendData} multiColor />
              </div>
            </div>

            {typeBreakdown.length > 0 && (
              <div className="ins-chart-card">
                <h3 className="ins-chart-title">Treatment Types Used</h3>
                <div className="ins-type-pills">
                  {typeBreakdown.map(({ name, count }) => (
                    <span
                      key={name}
                      className="ins-type-pill"
                      style={{
                        background: (TYPE_COLORS[name] ?? '#7f8c8d') + '22',
                        color:      TYPE_COLORS[name] ?? '#7f8c8d',
                        borderColor: (TYPE_COLORS[name] ?? '#7f8c8d') + '66',
                      }}
                    >
                      {name}
                      <span className="ins-type-pill-count">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Section 2: Injury Tracker ────────────────────────────────────── */}
      <section className="ins-section">
        <SectionHeader
          title="Injury Tracker"
          subtitle="Based on all active injuries in the system."
        />

        <div className="ins-stat-row">
          <StatCard value={activeInjuries.length} label="Active Injuries" />
          <StatCard
            value={avgDaysToRtp !== null ? `${avgDaysToRtp}d` : '—'}
            label="Avg Days to RTP"
            sub={avgDaysToRtp !== null ? 'cleared injuries' : 'no cleared injuries yet'}
          />
          <StatCard
            value={flaggedOut.length}
            label="Out 14+ Days"
            accent={flaggedOut.length > 0 ? 'warn' : null}
            sub={flaggedOut.length > 0 ? 'need attention' : 'none flagged'}
          />
          <StatCard
            value={injuries.filter((i) => !i.is_active).length}
            label="Resolved"
          />
        </div>

        {activeInjuries.length === 0 ? (
          <p className="ins-empty">No active injuries.</p>
        ) : (
          <div className="ins-chart-row">
            <div className="ins-chart-card">
              <h3 className="ins-chart-title">Active Injuries by Body Part</h3>
              <HBarChart data={injByBodyPart} color="#e74c3c" />
            </div>
            <div className="ins-chart-card">
              <h3 className="ins-chart-title">Active Injuries by Sport</h3>
              <HBarChart data={injBySport} color="#e67e22" />
            </div>
          </div>
        )}

        {flaggedOut.length > 0 && (
          <div className="ins-flag-list">
            <div className="ins-flag-header">
              <span className="ins-flag-icon">⚠</span>
              <span>Athletes out for 14+ days — consider follow-up</span>
            </div>
            <div className="ins-flag-items">
              {flaggedOut.map((inj) => {
                const days = daysSince(inj.injury_date);
                return (
                  <div key={inj.id} className="ins-flag-item">
                    <span className="ins-flag-athlete">{inj.athlete_name}</span>
                    {inj.athlete_sport && <span className="ins-flag-sport">{inj.athlete_sport}</span>}
                    <span className="ins-flag-injury">{inj.injury_type} · {inj.body_part}</span>
                    <span className="ins-flag-days">{days}d out</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 3: Athlete Workload ───────────────────────────────────── */}
      <section className="ins-section">
        <SectionHeader
          title="Athlete Workload"
          subtitle="Visit frequency this month. Sparklines show weekly trend over the past 8 weeks."
        />

        {overuseFlags.length > 0 && (
          <div className="ins-flag-list ins-flag-list--overuse">
            <div className="ins-flag-header">
              <span className="ins-flag-icon">⚠</span>
              <span>Potential overuse — 5+ visits in the past 7 days</span>
            </div>
            <div className="ins-flag-items">
              {overuseFlags.map(({ name, count }) => (
                <div key={name} className="ins-flag-item">
                  <span className="ins-flag-athlete">{name}</span>
                  <span className="ins-flag-days">{count} visits this week</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topAthletes.length === 0 ? (
          <p className="ins-empty">No treatments logged this month.</p>
        ) : (
          <div className="ins-workload-table-wrap">
            <table className="ins-workload-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Athlete</th>
                  <th>Visits This Month</th>
                  <th>8-Week Trend</th>
                </tr>
              </thead>
              <tbody>
                {topAthletes.map(({ name, count }, i) => (
                  <tr key={name} className={overuseFlags.some((f) => f.name === name) ? 'ins-row--flag' : ''}>
                    <td className="ins-rank">{i + 1}</td>
                    <td className="ins-athlete-cell">{name}</td>
                    <td className="ins-count-cell">
                      <span className="ins-visit-bar-wrap">
                        <span
                          className="ins-visit-bar"
                          style={{ width: `${Math.round((count / topAthletes[0].count) * 100)}%` }}
                        />
                        <span className="ins-visit-num">{count}</span>
                      </span>
                    </td>
                    <td className="ins-spark-cell">
                      <Sparkline data={sparklineCache[name] ?? []} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 4: Program Summary ────────────────────────────────────── */}
      <section className="ins-section">
        <SectionHeader
          title="Program Summary"
          subtitle={`Cost savings calculated at ${fmt$(costPerVisit)}/visit. Update in Settings.`}
        />

        <div className="ins-summary-grid">
          <div className="ins-summary-block">
            <h3 className="ins-summary-period">This Month</h3>
            <div className="ins-stat-row">
              <StatCard value={summaryMonth.count}    label="Treatments" />
              <StatCard value={summaryMonth.minutes}  label="Minutes" />
              <StatCard value={summaryMonth.athletes} label="Athletes Seen" />
              <StatCard value={fmt$(summaryMonth.savings)} label="Est. Savings" accent="green" />
            </div>
          </div>
          <div className="ins-summary-block">
            <h3 className="ins-summary-period">This Season</h3>
            <div className="ins-stat-row">
              <StatCard value={summarySeason.count}    label="Treatments" />
              <StatCard value={summarySeason.minutes}  label="Minutes" />
              <StatCard value={summarySeason.athletes} label="Athletes Seen" />
              <StatCard value={fmt$(summarySeason.savings)} label="Est. Savings" accent="green" />
            </div>
          </div>
        </div>

        {treatments.length > 0 && (
          <div className="ins-chart-card" style={{ marginTop: '1rem' }}>
            <h3 className="ins-chart-title">
              Most Active Day of Week
              {busiestDay && <span className="ins-busiest-badge">{busiestDay}</span>}
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dowData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'var(--ins-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--ins-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip
                  formatter={(v) => [v, 'Treatments']}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dowData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.name === busiestDay ? 'var(--color-primary, #1d6fa5)' : '#cbd5e1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

    </div>
  );
}
