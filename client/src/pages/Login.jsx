import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError(null);
    setEmailSent(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      } else {
        if (!schoolName.trim()) {
          setError('School name is required.');
          return;
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
          // Email confirmation is required — profile will be set up after confirmation
          setEmailSent(true);
          return;
        }

        // No email confirmation needed — set up profile immediately
        await axios.post(
          '/api/auth/setup-profile',
          { school_name: schoolName.trim() },
          { headers: { Authorization: `Bearer ${data.session.access_token}` } }
        );

        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-icon">+</span>
            <span className="brand-name">Daily Treatment Log</span>
          </div>
          <div className="login-confirm">
            <div className="confirm-icon">✉</div>
            <h2>Check your email</h2>
            <p>
              We sent a confirmation link to <strong>{email}</strong>. Click it to
              activate your account, then come back and sign in.
            </p>
            <button className="btn btn--outline btn--full" onClick={() => switchMode('login')}>
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
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Daily Treatment Log</span>
        </div>

        <h1 className="login-title">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>

        <form onSubmit={handleSubmit} noValidate>
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="schoolName" className="form-label">School Name</label>
              <input
                id="schoolName"
                type="text"
                className="form-input"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                placeholder="e.g. Westview High School"
              />
              <p className="form-hint">
                Users with the same school name share treatment records. Spelling must match exactly.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading
              ? mode === 'login' ? 'Signing in...' : 'Creating account...'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="login-toggle">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="link-btn"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
