import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import './SetupProfile.css';

export default function SetupProfile() {
  const navigate = useNavigate();
  const { session, hasProfile } = useAuth();
  const [schoolName, setSchoolName] = useState(
    () => localStorage.getItem('pendingSchoolName') ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Already has a profile — nothing to do here
  if (hasProfile === true) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!schoolName.trim()) {
      setError('School name is required.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await axios.post(
        '/api/auth/setup-profile',
        { school_name: schoolName.trim() },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      localStorage.removeItem('pendingSchoolName');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setLoading(false);
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Daily Treatment Log</span>
        </div>

        <h1 className="login-title">One last step</h1>
        <p className="setup-subtitle">
          Your email is confirmed. Enter your school name to finish setting up your account.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="schoolName" className="form-label">School Name</label>
            <input
              id="schoolName"
              type="text"
              className="form-input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Westview High School"
            />
            <p className="form-hint">
              Users with the same school name share treatment records. Spelling must match exactly.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Finish Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
