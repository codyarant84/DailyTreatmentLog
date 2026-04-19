import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import './Login.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  const brand = (
    <div className="login-brand">
      <span className="brand-icon">+</span>
      <span className="brand-name">Fieldside Health</span>
    </div>
  );

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          {brand}
          <div className="login-confirm">
            <div className="confirm-icon">⚠️</div>
            <h2>Invalid reset link</h2>
            <p>This password reset link is missing or malformed. Please request a new one.</p>
            <button className="btn btn--outline btn--full" onClick={() => navigate('/login')}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card">
          {brand}
          <div className="login-confirm">
            <div className="confirm-icon">✓</div>
            <h2>Password updated</h2>
            <p>Your password has been reset successfully. You can now sign in with your new password.</p>
            <button className="btn btn--primary btn--full" onClick={() => navigate('/login')}>
              Sign In
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
        <h1 className="login-title">Set new password</h1>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="form-error" role="alert">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="new-password" className="form-label">New password</label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password" className="form-label">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
