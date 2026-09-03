import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import { formatDate, parseLocalDate } from '../../lib/dateUtils.js';
import './PortalHome.css';

function statusVariant(status) {
  if (status === 'Out') return 'out';
  if (status === 'Limited') return 'limited';
  if (status === 'Full Participation') return 'full';
  return 'none';
}

function formatTimeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function PortalHome() {
  const { portalUser, isApproved, onboardingComplete, portalSignOut, getToken } = usePortalAuth();
  const navigate = useNavigate();
  const isAthlete = portalUser?.role === 'athlete';
  const isParent  = portalUser?.role === 'parent';

  useEffect(() => {
    if (portalUser && isAthlete && !onboardingComplete) {
      navigate('/portal/onboarding', { replace: true });
    }
  }, [portalUser, isAthlete, onboardingComplete, navigate]);

  // Forms (athlete role)
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);

  // Athlete-only dashboard data
  const [athleteStatus, setAthleteStatus]       = useState(null);
  const [rehabPrograms, setRehabPrograms]       = useState([]);
  const [concussionStatus, setConcussionStatus] = useState(null);
  const [dashLoading, setDashLoading]           = useState(false);
  const [upcomingAppts, setUpcomingAppts]       = useState([]);

  // Parent-only data
  const [myAthletes, setMyAthletes]       = useState([]);
  const [athletesLoading, setAthletesLoading] = useState(false);

  const headers = useCallback(() => ({ Authorization: `Bearer ${getToken()}` }), [getToken]);

  const fetchForms = useCallback(async () => {
    try {
      const { data } = await api.get('/api/portal/my-forms', { headers: headers() });
      setForms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFormsLoading(false);
    }
  }, [headers]);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    const h = { headers: headers() };
    const [statusRes, rehabRes, concussionRes, scheduleRes] = await Promise.allSettled([
      api.get('/api/portal/athlete-status', h),
      api.get('/api/portal/my-rehab', h),
      api.get('/api/portal/concussion-status', h),
      api.get('/api/schedule/my-requests', h),
    ]);
    if (statusRes.status    === 'fulfilled') setAthleteStatus(statusRes.value.data);
    if (rehabRes.status     === 'fulfilled') setRehabPrograms(rehabRes.value.data);
    if (concussionRes.status === 'fulfilled') setConcussionStatus(concussionRes.value.data);
    if (scheduleRes.status  === 'fulfilled') {
      setUpcomingAppts(scheduleRes.value.data.filter((r) => r.status === 'approved'));
    }
    setDashLoading(false);
  }, [headers]);

  const fetchMyAthletes = useCallback(async () => {
    setAthletesLoading(true);
    try {
      const { data } = await api.get('/api/portal/my-athletes', { headers: headers() });
      setMyAthletes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAthletesLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!isApproved) return;
    if (isAthlete) {
      fetchForms();
      fetchDashboard();
    } else if (isParent) {
      fetchMyAthletes();
      fetchForms();
    }
  }, [isApproved, isAthlete, isParent, fetchForms, fetchDashboard, fetchMyAthletes]);

  function handleSignOut() {
    portalSignOut();
    navigate('/portal/login', { replace: true });
  }

  const pending   = forms.filter(f => !f.completed);
  const completed = forms.filter(f => f.completed);

  return (
    <div className="ph-page">
      <header className="ph-header">
        <div className="ph-brand">
          <span className="ph-brand-icon">+</span>
          <span className="ph-brand-name">Fieldside</span>
        </div>
        <button className="ph-signout" onClick={handleSignOut}>Sign Out</button>
      </header>

      <main className="ph-main">
        {!isApproved ? (
          <div className="ph-card ph-pending">
            <div className="ph-pending-icon">⏳</div>
            <h2 className="ph-pending-title">Pending Approval</h2>
            <p className="ph-pending-text">
              Your account is awaiting approval from your school's athletic trainer.
              You'll have access once they verify your information.
            </p>
          </div>
        ) : (
          <div className="ph-content">
            {/* Welcome card */}
            <div className="ph-card">
              <div className="ph-welcome">
                {portalUser?.avatar_url ? (
                  <img src={portalUser.avatar_url} alt={portalUser.name} className="ph-avatar" />
                ) : (
                  <div className="ph-avatar-placeholder">
                    {portalUser?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div>
                  <h1 className="ph-title">Welcome, {portalUser?.name}</h1>
                  <p className="ph-meta">
                    {isAthlete ? 'Athlete' : 'Parent'} &middot;{' '}
                    {portalUser?.school_name ?? 'Your School'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status card — athlete only */}
            {isAthlete && (
              <div className="ph-card ph-status-card">
                <h2 className="ph-section-title" style={{ marginBottom: '0.65rem' }}>Current Status</h2>
                {dashLoading && !athleteStatus ? (
                  <p className="ph-empty">Loading...</p>
                ) : (
                  <div className="ph-status-row">
                    <span className={`ph-status-badge ph-status-badge--${statusVariant(athleteStatus?.status ?? 'No Active Injuries')}`}>
                      {athleteStatus?.status ?? 'No Active Injuries'}
                    </span>
                    {athleteStatus?.injuries?.length > 0 && (
                      <span className="ph-status-parts">
                        {athleteStatus.injuries.map(i => i.body_part).join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Schedule — athlete only */}
            {isAthlete && (
              <section className="ph-section">
                <h2 className="ph-section-title">Schedule</h2>
                {dashLoading && upcomingAppts.length === 0 ? (
                  <p className="ph-empty">Loading...</p>
                ) : upcomingAppts.length === 0 ? (
                  <p className="ph-empty">No upcoming appointments.</p>
                ) : (
                  <div className="ph-form-list">
                    {upcomingAppts.map((r) => (
                      <div key={r.id} className="ph-form-card">
                        <div className="ph-form-info">
                          <p className="ph-form-title">
                            {formatDate(r.requested_date)} at {formatTimeLabel(r.requested_time)}
                          </p>
                          <p className="ph-form-due">
                            {r.reason}{r.body_part ? ` · ${r.body_part}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="ph-form-btn" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/portal/schedule')}>
                  Request Treatment
                </button>
              </section>
            )}

            {/* Concussion check-in — athlete only */}
            {isAthlete && concussionStatus?.active && (
              <section className="ph-section">
                <h2 className="ph-section-title ph-section-title--alert">
                  Concussion Protocol
                  <span className="ph-badge ph-badge--warning">Active</span>
                </h2>
                <div className="ph-concussion-card">
                  <div className="ph-concussion-info">
                    <p className="ph-concussion-step">
                      Step {concussionStatus.current_step} &mdash; {concussionStatus.step_name}
                    </p>
                    {concussionStatus.last_checkin ? (
                      <p className="ph-concussion-meta">
                        Last check-in: {formatDate(concussionStatus.last_checkin)}
                      </p>
                    ) : (
                      <p className="ph-concussion-meta ph-concussion-meta--alert">No check-ins submitted yet</p>
                    )}
                  </div>
                  <button
                    className="ph-form-btn"
                    onClick={() => navigate('/portal/concussion-checkin')}
                  >
                    Today's Check-in
                  </button>
                </div>
              </section>
            )}

            {/* Forms to complete */}
            <section className="ph-section">
              <h2 className="ph-section-title">
                Forms to Complete
                {pending.length > 0 && <span className="ph-badge">{pending.length}</span>}
              </h2>
              {formsLoading ? (
                <p className="ph-empty">Loading...</p>
              ) : pending.length === 0 ? (
                <p className="ph-empty">No forms to complete right now.</p>
              ) : (
                <div className="ph-form-list">
                  {pending.map(f => (
                    <div key={f.id} className="ph-form-card">
                      <div className="ph-form-info">
                        <p className="ph-form-title">{f.form_title}</p>
                        {f.due_date && (
                          <p className={`ph-form-due${parseLocalDate(f.due_date) < new Date() ? ' overdue' : ''}`}>
                            Due: {formatDate(f.due_date)}
                          </p>
                        )}
                      </div>
                      <button
                        className="ph-form-btn"
                        onClick={() => navigate(`/portal/forms/${f.id}`)}
                      >
                        Complete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active rehab programs — athlete only */}
            {isAthlete && rehabPrograms.length > 0 && (
              <section className="ph-section">
                <h2 className="ph-section-title">Active Rehab Programs</h2>
                <div className="ph-form-list">
                  {rehabPrograms.map(p => (
                    <div key={p.id} className="ph-form-card">
                      <div className="ph-form-info">
                        <p className="ph-form-title">{p.name}</p>
                        <p className="ph-form-due">
                          {p.exercise_count} exercise{p.exercise_count !== 1 ? 's' : ''}
                          {p.description && ` · ${p.description}`}
                        </p>
                      </div>
                      <button
                        className="ph-form-btn"
                        onClick={() => navigate(`/portal/rehab/${p.id}`)}
                      >
                        View Program
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed forms */}
            {completed.length > 0 && (
              <section className="ph-section">
                <h2 className="ph-section-title">Completed Forms</h2>
                <div className="ph-form-list">
                  {completed.map(f => (
                    <div key={f.id} className="ph-form-card ph-form-card--done">
                      <div className="ph-form-info">
                        <p className="ph-form-title">{f.form_title}</p>
                        {f.submitted_at && (
                          <p className="ph-form-due">
                            Submitted {new Date(f.submitted_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span className="ph-done-badge">Done</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Parent: athlete cards */}
            {isParent && (
              <section className="ph-section">
                <h2 className="ph-section-title">Your Athletes</h2>
                {athletesLoading ? (
                  <p className="ph-empty">Loading...</p>
                ) : myAthletes.length === 0 ? (
                  <p className="ph-empty">No athletes linked to your account yet. Contact your school's athletic trainer.</p>
                ) : (
                  <div className="ph-form-list">
                    {myAthletes.map((a) => (
                      <div key={a.id} className="ph-form-card ph-athlete-card">
                        <div className="ph-form-info">
                          <p className="ph-form-title">{a.name}</p>
                          <p className="ph-form-due">
                            {a.sport ?? 'Athlete'}
                            {a.active_injury_count > 0 && (
                              <span className="ph-injury-dot" title={`${a.active_injury_count} active injury`}> · {a.active_injury_count} injury</span>
                            )}
                            {a.pending_forms > 0 && (
                              <span className="ph-form-dot"> · {a.pending_forms} form{a.pending_forms !== 1 ? 's' : ''} pending</span>
                            )}
                          </p>
                        </div>
                        <button
                          className="ph-form-btn"
                          onClick={() => navigate(`/portal/athlete/${a.id}`)}
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Parent: forms assigned to them (cross-athlete) */}
            {isParent && (
              <section className="ph-section">
                <h2 className="ph-section-title">
                  Forms to Complete
                  {forms.filter(f => !f.completed).length > 0 && (
                    <span className="ph-badge">{forms.filter(f => !f.completed).length}</span>
                  )}
                </h2>
                {formsLoading ? (
                  <p className="ph-empty">Loading...</p>
                ) : forms.filter(f => !f.completed).length === 0 ? (
                  <p className="ph-empty">No forms to complete right now.</p>
                ) : (
                  <div className="ph-form-list">
                    {forms.filter(f => !f.completed).map(f => (
                      <div key={f.id} className="ph-form-card">
                        <div className="ph-form-info">
                          <p className="ph-form-title">{f.form_title}</p>
                          {f.athlete_name && <p className="ph-form-due">For: {f.athlete_name}</p>}
                        </div>
                        <button className="ph-form-btn" onClick={() => navigate(`/portal/forms/${f.id}`)}>
                          Complete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
