import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalRehabView.css';

function formatDuration(seconds) {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function ExerciseDetail({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <span className="rv-ex-detail">
      <span className="rv-ex-detail-label">{label}</span>
      {value}
    </span>
  );
}

export default function PortalRehabView() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { portalSignOut, getToken } = usePortalAuth();

  const [program, setProgram] = useState(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/portal/rehab/${programId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        setProgram(data);
      } catch (err) {
        setError(err.response?.data?.error ?? err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [programId, getToken]);

  function handleSignOut() {
    portalSignOut();
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="rv-page">
      <header className="rv-header">
        <div className="rv-header-left">
          <button className="rv-back-btn" onClick={() => navigate('/portal/home')}>
            ← Back
          </button>
          <div className="rv-brand">
            <span className="rv-brand-icon">+</span>
            <span className="rv-brand-name">Fieldside</span>
          </div>
        </div>
        <button className="rv-signout" onClick={handleSignOut}>Sign Out</button>
      </header>

      <main className="rv-main">
        {loading ? (
          <p className="rv-loading">Loading program...</p>
        ) : error ? (
          <div className="rv-error">{error}</div>
        ) : !program ? null : (
          <div className="rv-content">
            <div className="rv-program-head">
              <h1 className="rv-program-title">{program.name}</h1>
              {program.description && (
                <p className="rv-program-desc">{program.description}</p>
              )}
              <p className="rv-program-meta">
                {program.exercises.length} exercise{program.exercises.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="rv-exercise-list">
              {program.exercises.map((ex, i) => (
                <div key={i} className="rv-exercise-card">
                  <div className="rv-ex-number">{i + 1}</div>
                  <div className="rv-ex-body">
                    <p className="rv-ex-name">{ex.exercise_name}</p>

                    <div className="rv-ex-details">
                      <ExerciseDetail label="Sets"     value={ex.sets} />
                      <ExerciseDetail label="Reps"     value={ex.reps} />
                      <ExerciseDetail label="Duration" value={formatDuration(ex.duration_seconds)} />
                    </div>

                    {ex.exercise_description && (
                      <p className="rv-ex-desc">{ex.exercise_description}</p>
                    )}
                    {ex.program_notes && (
                      <p className="rv-ex-notes">{ex.program_notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {program.exercises.length === 0 && (
              <p className="rv-empty">No exercises added to this program yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
