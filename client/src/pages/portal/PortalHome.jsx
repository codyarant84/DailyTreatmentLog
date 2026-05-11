import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalHome.css';

export default function PortalHome() {
  const { portalUser, isApproved, portalSignOut } = usePortalAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    portalSignOut();
    navigate('/portal/login', { replace: true });
  }

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
              Your account is awaiting approval from your school's athletic trainer. You'll have
              access once they verify your information.
            </p>
          </div>
        ) : (
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

            <div className="ph-coming-soon">
              <p>Injury status, treatment history, and health updates are coming soon.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
