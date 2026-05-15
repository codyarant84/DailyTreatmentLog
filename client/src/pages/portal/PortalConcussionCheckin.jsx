import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalConcussionCheckin.css';

const SYMPTOM_CATEGORIES = [
  {
    label: 'Physical',
    symptoms: [
      { key: 'headache',             label: 'Headache' },
      { key: 'pressure_in_head',     label: 'Pressure in Head' },
      { key: 'neck_pain',            label: 'Neck Pain' },
      { key: 'nausea_or_vomiting',   label: 'Nausea or Vomiting' },
      { key: 'dizziness',            label: 'Dizziness' },
      { key: 'blurred_vision',       label: 'Blurred Vision' },
      { key: 'balance_problems',     label: 'Balance Problems' },
      { key: 'sensitivity_to_light', label: 'Sensitivity to Light' },
      { key: 'sensitivity_to_noise', label: 'Sensitivity to Noise' },
      { key: 'visual_problems',      label: 'Visual Problems' },
    ],
  },
  {
    label: 'Cognitive',
    symptoms: [
      { key: 'feeling_slowed_down',      label: 'Feeling Slowed Down' },
      { key: 'feeling_in_fog',           label: 'Feeling in a Fog' },
      { key: 'dont_feel_right',          label: "Don't Feel Right" },
      { key: 'difficulty_concentrating', label: 'Difficulty Concentrating' },
      { key: 'difficulty_remembering',   label: 'Difficulty Remembering' },
    ],
  },
  {
    label: 'Fatigue / Sleep',
    symptoms: [
      { key: 'fatigue_or_low_energy', label: 'Fatigue or Low Energy' },
      { key: 'drowsiness',            label: 'Drowsiness' },
      { key: 'confusion',             label: 'Confusion' },
    ],
  },
  {
    label: 'Emotional',
    symptoms: [
      { key: 'more_emotional',    label: 'More Emotional' },
      { key: 'irritability',      label: 'Irritability' },
      { key: 'sadness',           label: 'Sadness' },
      { key: 'nervous_or_anxious', label: 'Nervous or Anxious' },
    ],
  },
];

const ALL_SYMPTOM_KEYS = SYMPTOM_CATEGORIES.flatMap(c => c.symptoms.map(s => s.key));
const BLANK_SYMPTOMS   = Object.fromEntries(ALL_SYMPTOM_KEYS.map(k => [k, 0]));

export default function PortalConcussionCheckin() {
  const { portalSignOut, getToken } = usePortalAuth();
  const navigate = useNavigate();

  const [symptoms, setSymptoms]       = useState({ ...BLANK_SYMPTOMS });
  const [sleepQuality, setSleepQuality] = useState('');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [submitted, setSubmitted]     = useState(false);

  const totalScore = Object.values(symptoms).reduce((sum, v) => sum + (v || 0), 0);

  function setSymptom(key, raw) {
    const val = Math.min(6, Math.max(0, parseInt(raw, 10) || 0));
    setSymptoms(s => ({ ...s, [key]: val }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/api/portal/concussion-checkin',
        { symptoms, sleep_quality: sleepQuality ? parseInt(sleepQuality, 10) : null, notes: notes || null },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    portalSignOut();
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="cc-page">
      <header className="cc-header">
        <div className="cc-header-left">
          <button className="cc-back-btn" onClick={() => navigate('/portal/home')}>
            ← Back
          </button>
          <div className="cc-brand">
            <span className="cc-brand-icon">+</span>
            <span className="cc-brand-name">Fieldside</span>
          </div>
        </div>
        <button className="cc-signout" onClick={handleSignOut}>Sign Out</button>
      </header>

      <main className="cc-main">
        {submitted ? (
          <div className="cc-card cc-success-card">
            <div className="cc-success-icon">✓</div>
            <h1 className="cc-success-title">Check-in Submitted</h1>
            <p className="cc-success-text">
              Your symptom scores have been recorded. Your athletic trainer will review your progress.
            </p>
            <button className="btn btn--primary" onClick={() => navigate('/portal/home', { replace: true })}>
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="cc-card">
            <div className="cc-card-head">
              <h1 className="cc-card-title">Daily Symptom Check-in</h1>
              <p className="cc-card-subtitle">
                Rate each symptom from 0 (none) to 6 (severe).
              </p>
            </div>

            <div className="cc-score-bar">
              <span className="cc-score-label">Total Symptom Score</span>
              <span className={`cc-score-value${totalScore > 0 ? ' cc-score-value--active' : ''}`}>
                {totalScore} / 132
              </span>
            </div>

            {SYMPTOM_CATEGORIES.map(cat => (
              <div key={cat.label} className="cc-category">
                <h2 className="cc-category-title">{cat.label}</h2>
                <div className="cc-symptom-list">
                  {cat.symptoms.map(({ key, label }) => (
                    <div key={key} className="cc-symptom-row">
                      <span className="cc-symptom-label">{label}</span>
                      <div className="cc-symptom-input-wrap">
                        <input
                          type="range"
                          min="0"
                          max="6"
                          step="1"
                          className="cc-slider"
                          value={symptoms[key]}
                          onChange={e => setSymptom(key, e.target.value)}
                        />
                        <span className={`cc-symptom-score${symptoms[key] > 0 ? ' active' : ''}`}>
                          {symptoms[key]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="cc-extra">
              <div className="cc-field">
                <label className="cc-label">Sleep Quality <span className="cc-optional">(0–10, optional)</span></label>
                <input
                  type="number"
                  className="cc-input cc-input--sm"
                  min="0" max="10"
                  value={sleepQuality}
                  onChange={e => setSleepQuality(e.target.value)}
                  placeholder="e.g. 7"
                />
              </div>
              <div className="cc-field">
                <label className="cc-label">Notes <span className="cc-optional">(optional)</span></label>
                <textarea
                  className="cc-input cc-textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any other symptoms or comments..."
                  rows={3}
                />
              </div>
            </div>

            {error && <p className="cc-error">{error}</p>}

            <div className="cc-actions">
              <button
                className="btn btn--primary cc-submit-btn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Check-in'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
