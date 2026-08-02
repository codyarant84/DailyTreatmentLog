import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './ParentAthleteDetail.css';

const STATUS_VARIANT = { 'Out': 'out', 'Limited': 'limited', 'Full Participation': 'full' };

export default function ParentAthleteDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const { portalUser, getToken } = usePortalAuth();

  const [status, setStatus]         = useState(null);
  const [forms, setForms]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const headers = useCallback(() => ({ Authorization: `Bearer ${getToken()}` }), [getToken]);

  useEffect(() => {
    if (portalUser?.role !== 'parent') {
      navigate('/portal/home', { replace: true });
      return;
    }
    const h = { headers: headers() };
    setLoading(true);
    Promise.allSettled([
      api.get(`/api/portal/athlete/${athleteId}/status`, h),
      api.get(`/api/portal/athlete/${athleteId}/forms`, h),
    ]).then(([statusRes, formsRes]) => {
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data);
      else setError('Could not load status.');
      if (formsRes.status === 'fulfilled') setForms(formsRes.value.data);
    }).finally(() => setLoading(false));
  }, [athleteId, portalUser, navigate, headers]);

  const athleteName = status?.injuries?.[0]
    ? null
    : null;

  const pending   = forms.filter(f => !f.completed);
  const completed = forms.filter(f => f.completed);

  if (loading) {
    return (
      <div className="pad-page">
        <header className="pad-header">
          <button className="pad-back" onClick={() => navigate('/portal/home')}>← Back</button>
        </header>
        <p className="pad-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="pad-page">
      <header className="pad-header">
        <button className="pad-back" onClick={() => navigate('/portal/home')}>← Back</button>
        <div className="pad-brand">
          <span className="pad-brand-icon">+</span>
          <span className="pad-brand-name">Fieldside</span>
        </div>
      </header>

      <main className="pad-main">
        {error && <p className="pad-error">{error}</p>}

        {/* Status */}
        <div className="pad-card">
          <h2 className="pad-section-title">Current Status</h2>
          {status ? (
            <>
              <div className="pad-status-row">
                <span className={`pad-status-badge pad-status-badge--${STATUS_VARIANT[status.status] ?? 'none'}`}>
                  {status.status}
                </span>
              </div>
              {status.injuries?.length > 0 && (
                <ul className="pad-injury-list">
                  {status.injuries.map((inj, i) => (
                    <li key={i} className="pad-injury-item">
                      {inj.body_part && <span className="pad-injury-part">{inj.body_part}</span>}
                      {inj.rtp_status && (
                        <span className={`pad-status-pill pad-status-pill--${STATUS_VARIANT[inj.rtp_status] ?? 'none'}`}>
                          {inj.rtp_status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="pad-empty">No status available.</p>
          )}
        </div>

        {/* Pending forms */}
        <div className="pad-card">
          <h2 className="pad-section-title">
            Forms to Complete
            {pending.length > 0 && <span className="pad-badge">{pending.length}</span>}
          </h2>
          {pending.length === 0 ? (
            <p className="pad-empty">No forms pending.</p>
          ) : (
            <div className="pad-form-list">
              {pending.map(f => (
                <div key={f.id} className="pad-form-card">
                  <div className="pad-form-info">
                    <p className="pad-form-title">{f.form_title}</p>
                    {f.due_date && (
                      <p className={`pad-form-due${new Date(f.due_date) < new Date() ? ' overdue' : ''}`}>
                        Due: {new Date(f.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    className="pad-form-btn"
                    onClick={() => navigate(`/portal/forms/${f.id}`)}
                  >
                    Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed forms */}
        {completed.length > 0 && (
          <div className="pad-card">
            <h2 className="pad-section-title">Completed Forms</h2>
            <div className="pad-form-list">
              {completed.map(f => (
                <div key={f.id} className="pad-form-card pad-form-card--done">
                  <div className="pad-form-info">
                    <p className="pad-form-title">{f.form_title}</p>
                    {f.submitted_at && (
                      <p className="pad-form-due">Submitted {new Date(f.submitted_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <span className="pad-done-badge">Done</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
