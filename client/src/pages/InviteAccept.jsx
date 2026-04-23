import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Login.css';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [schoolName, setSchoolName] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load the school name for this invite token
  useEffect(() => {
    api
      .get(`/api/auth/invite-info/${token}`)
      .then(({ data }) => setSchoolName(data.school_name))
      .catch((err) => setLoadError(err.response?.data?.error ?? 'Invalid or expired invite link.'));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);

    try {
      // Create a pre-confirmed account via the invite
      await api.post('/api/auth/accept-invite-signup', { token, email, password });

      // Sign in immediately after account creation
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-icon">+</span>
            <span className="brand-name">Daily Treatment Log</span>
          </div>
          <div className="login-confirm">
            <div className="confirm-icon">⚠</div>
            <h2>Invalid invite</h2>
            <p>{loadError}</p>
            <button className="btn btn--outline btn--full" onClick={() => navigate('/login')}>
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!schoolName) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="state-msg">
            <div className="spinner" />
            <span>Loading invite...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Daily Treatment Log</span>
        </div>

        <h1 className="login-title">You've been invited</h1>
        <p className="form-hint" style={{ marginBottom: '1.25rem' }}>
          Create your account to join <strong>{schoolName}</strong>.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="form-error" role="alert">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@school.edu"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account & Join'}
          </button>
        </form>
      </div>
    </div>
  );
}
