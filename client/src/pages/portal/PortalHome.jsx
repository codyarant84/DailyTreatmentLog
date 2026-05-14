import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalHome.css';

export default function PortalHome() {
  const { portalUser, isApproved, onboardingComplete, portalSignOut, getToken } = usePortalAuth();
  const navigate = useNavigate();

  // Redirect athletes to onboarding if they haven't completed it yet
  useEffect(() => {
    if (portalUser && portalUser.role === 'athlete' && !onboardingComplete) {
      navigate('/portal/onboarding', { replace: true });
    }
  }, [portalUser, onboardingComplete, navigate]);

  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);

  const fetchForms = useCallback(async () => {
    try {
      const { data } = await api.get('/api/portal/my-forms', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setForms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFormsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isApproved) fetchForms();
  }, [isApproved, fetchForms]);

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
                    {portalUser?.role === 'athlete' ? 'Athlete' : 'Parent'} &middot;{' '}
                    {portalUser?.school_name ?? 'Your School'}
                  </p>
                </div>
              </div>
            </div>

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
                          <p className={`ph-form-due${new Date(f.due_date) < new Date() ? ' overdue' : ''}`}>
                            Due: {new Date(f.due_date).toLocaleDateString()}
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

            {completed.length > 0 && (
              <section className="ph-section">
                <h2 className="ph-section-title">Completed</h2>
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
          </div>
        )}
      </main>
    </div>
  );
}
