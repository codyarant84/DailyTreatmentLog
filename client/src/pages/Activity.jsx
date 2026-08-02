import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Activity.css';

function statusBadge(row) {
  if (row.total_7d > 0)   return { label: 'Active',   cls: 'act-badge--active'   };
  if (row.total_30d > 0)  return { label: 'Quiet',    cls: 'act-badge--quiet'    };
  return                         { label: 'Inactive', cls: 'act-badge--inactive' };
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ACTION_LABELS = {
  'login':                 'Login',
  'treatment.created':     'Treatment logged',
  'injury.created':        'Injury created',
  'athlete.created':       'Athlete added',
  'concussion.assessment': 'Concussion assessment',
  'report.generated':      'Report generated',
  'form.submitted':        'Form submitted',
};

export default function Activity() {
  const { role } = useAuth();
  const [schools, setSchools]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null); // { id, name }
  const [detail, setDetail]           = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (role !== 'super_admin') return;
    api.get('/api/admin/activity')
      .then(({ data }) => setSchools(data))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, [role]);

  async function openSchool(school) {
    setSelected(school);
    setDetail([]);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/admin/activity/${school.id}`);
      setDetail(data);
    } catch {
      setDetail([]);
    } finally {
      setDetailLoading(false);
    }
  }

  if (role !== 'super_admin') {
    return (
      <div className="act-page">
        <p className="act-error">Super admin access required.</p>
      </div>
    );
  }

  return (
    <div className="act-page">
      <div className="act-header">
        <div>
          <h1 className="page-title">School Activity</h1>
          <p className="page-subtitle">Engagement overview across all schools</p>
        </div>
      </div>

      {loading && (
        <div className="state-msg"><div className="spinner" /><span>Loading activity…</span></div>
      )}
      {error && (
        <div className="state-msg state-msg--error"><p>{error}</p></div>
      )}

      {!loading && !error && (
        <div className="act-layout">
          {/* School summary table */}
          <div className={`act-table-wrap${selected ? ' act-table-wrap--split' : ''}`}>
            <table className="act-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Last Seen</th>
                  <th>Logins (30d)</th>
                  <th>Treatments (30d)</th>
                  <th>Total Actions (30d)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 && (
                  <tr><td colSpan={6} className="act-empty">No activity recorded yet.</td></tr>
                )}
                {schools.map((s) => {
                  const { label, cls } = statusBadge(s);
                  const isActive = selected?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      className={`act-row${isActive ? ' act-row--selected' : ''}`}
                      onClick={() => isActive ? setSelected(null) : openSchool(s)}
                    >
                      <td className="act-school-name">{s.name}</td>
                      <td>{fmtDate(s.last_login_at)}</td>
                      <td className="act-num">{s.logins_30d}</td>
                      <td className="act-num">{s.treatments_30d}</td>
                      <td className="act-num">{s.total_30d}</td>
                      <td><span className={`act-badge ${cls}`}>{label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="act-detail">
              <div className="act-detail-header">
                <h2 className="act-detail-title">{selected.name}</h2>
                <button className="act-close" onClick={() => setSelected(null)}>✕</button>
              </div>

              {detailLoading && (
                <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
              )}

              {!detailLoading && detail.length === 0 && (
                <p className="act-empty">No activity logged for this school.</p>
              )}

              {!detailLoading && detail.length > 0 && (
                <div className="act-feed">
                  {detail.map((row) => (
                    <div key={row.id} className="act-feed-row">
                      <div className="act-feed-left">
                        <span className="act-feed-action">{ACTION_LABELS[row.action] ?? row.action}</span>
                        {row.profile_email && (
                          <span className="act-feed-who">{row.profile_email}</span>
                        )}
                      </div>
                      <span className="act-feed-time">{fmtTime(row.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
