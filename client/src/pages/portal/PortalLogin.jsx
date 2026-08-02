import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalLogin.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function PortalLogin() {
  const { portalUser, portalLoading, portalLogin } = usePortalAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('google'); // 'google' | 'password' | 'invite'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCredential, setPendingCredential] = useState(null);
  const [schoolChoices, setSchoolChoices] = useState([]);

  // Read invite token from URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setInviteToken(t);
      setTab('invite');
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!portalLoading && portalUser) {
      navigate('/portal/home', { replace: true });
    }
  }, [portalUser, portalLoading, navigate]);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function initGsi() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('gsi-button'),
        { theme: 'outline', size: 'large', width: 300 }
      );
    }

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [tab]); // re-run when switching to google tab so button re-renders

  async function handleGoogleCallback(response) {
    setError(null);
    setLoading(true);
    try {
      const body = { credential: response.credential };
      if (inviteToken) body.invite_token = inviteToken;
      const { data } = await api.post('/api/portal/auth/google', body);
      if (data.school_choice_required) {
        setPendingCredential(response.credential);
        setSchoolChoices(data.schools);
        return;
      }
      portalLogin(data.token, data.portalUser);
      navigate('/portal/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSchoolChoice(schoolId) {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/api/portal/auth/google', {
        credential: pendingCredential,
        school_id: schoolId,
      });
      portalLogin(data.token, data.portalUser);
      navigate('/portal/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/api/portal/auth/login', { email, password });
      portalLogin(data.token, data.portalUser);
      navigate('/portal/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteRegister(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/api/portal/auth/register', {
        token: inviteToken,
        email: inviteEmail,
        password: invitePassword,
        name: inviteName,
      });
      portalLogin(data.token, data.portalUser);
      navigate('/portal/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  if (portalLoading) return null;

  if (schoolChoices.length > 0) {
    return (
      <div className="pl-page">
        <div className="pl-card">
          <div className="pl-logo">
            <span className="pl-logo-icon">+</span>
            <span className="pl-logo-name">Fieldside</span>
          </div>
          <h1 className="pl-title">Which school do you attend?</h1>
          <p className="pl-subtitle">Your email domain matches multiple schools. Select yours to continue.</p>
          {error && <p className="pl-error">{error}</p>}
          <div className="pl-school-list">
            {schoolChoices.map((school) => (
              <button
                key={school.id}
                className="pl-school-btn"
                onClick={() => handleSchoolChoice(school.id)}
                disabled={loading}
              >
                {school.name}
              </button>
            ))}
          </div>
          <button
            className="pl-back-link"
            onClick={() => { setSchoolChoices([]); setPendingCredential(null); setError(null); }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-page">
      <div className="pl-card">
        <div className="pl-logo">
          <span className="pl-logo-icon">+</span>
          <span className="pl-logo-name">Fieldside</span>
        </div>
        <h1 className="pl-title">Athlete Portal</h1>
        <p className="pl-subtitle">Sign in to view your athlete's health status</p>

        <div className="pl-tabs">
          <button className={`pl-tab${tab === 'google' ? ' active' : ''}`} onClick={() => setTab('google')}>
            Google
          </button>
          <button className={`pl-tab${tab === 'password' ? ' active' : ''}`} onClick={() => setTab('password')}>
            Email
          </button>
          <button className={`pl-tab${tab === 'invite' ? ' active' : ''}`} onClick={() => setTab('invite')}>
            Invite
          </button>
        </div>

        {error && <p className="pl-error">{error}</p>}

        {tab === 'google' && (
          <div className="pl-google-section">
            <p className="pl-google-hint">Athletes can sign in with their school Google account.</p>
            <div id="gsi-button" className="pl-gsi-button" />
            {loading && <p className="pl-loading">Signing in...</p>}
          </div>
        )}

        {tab === 'password' && (
          <form className="pl-form" onSubmit={handlePasswordLogin}>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-email">Email</label>
              <input
                id="pl-email"
                type="email"
                className="pl-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-password">Password</label>
              <input
                id="pl-password"
                type="password"
                className="pl-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="pl-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {tab === 'invite' && (
          <form className="pl-form" onSubmit={handleInviteRegister}>
            <p className="pl-google-hint">Create your account using the invite link sent by your athletic trainer.</p>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-invite-token">Invite Token</label>
              <input
                id="pl-invite-token"
                type="text"
                className="pl-input"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                required
                placeholder="Paste token from your invite email"
              />
            </div>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-invite-name">Your Name</label>
              <input
                id="pl-invite-name"
                type="text"
                className="pl-input"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-invite-email">Email</label>
              <input
                id="pl-invite-email"
                type="email"
                className="pl-input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-invite-pw">Password</label>
              <input
                id="pl-invite-pw"
                type="password"
                className="pl-input"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <button type="submit" className="pl-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
