import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // 'login' | 'forgot' | 'forgot-sent'
  const [view, setView] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setView('forgot-sent');
    } catch (err) {
      setForgotError(err.response?.data?.error ?? err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  const brand = (
    <div className="login-brand">
      <span className="brand-icon">+</span>
      <span className="brand-name">Fieldside Health</span>
    </div>
  );

  if (view === 'forgot-sent') {
    return (
      <div className="login-page">
        <div className="login-card">
          {brand}
          <div className="login-confirm">
            <div className="confirm-icon">✉️</div>
            <h2>Check your email</h2>
            <p>
              If an account exists with that email, you will receive a reset link
              shortly. Please contact your administrator if you need immediate access.
            </p>
            <button className="btn btn--outline btn--full" onClick={() => setView('login')}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="login-page">
        <div className="login-card">
          {brand}
          <h1 className="login-title">Reset password</h1>

          <form onSubmit={handleForgot} noValidate>
            {forgotError && (
              <div className="form-error" role="alert">{forgotError}</div>
            )}

            <div className="form-group">
              <label htmlFor="forgot-email" className="form-label">Email</label>
              <input
                id="forgot-email"
                type="email"
                className="form-input"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@school.edu"
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="login-toggle">
            <button className="link-btn" onClick={() => { setForgotError(null); setView('login'); }}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {brand}
        <h1 className="login-title">Welcome back</h1>

        <form onSubmit={handleLogin} noValidate>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
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
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-toggle">
          <button className="link-btn" onClick={() => { setError(null); setView('forgot'); }}>
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
