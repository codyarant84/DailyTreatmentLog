import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import AthleteCombobox from '../components/AthleteCombobox.jsx';
import './NewTreatment.css';

const TREATMENT_TYPES = [
  'Ice',
  'Heat',
  'Ultrasound',
  'E-Stim',
  'Massage',
  'Taping',
  'Exercise',
];

const BODY_PARTS = [
  'Head / Neck',
  'Shoulder',
  'Upper Arm',
  'Elbow',
  'Forearm',
  'Wrist',
  'Hand / Fingers',
  'Chest',
  'Upper Back',
  'Lower Back',
  'Hip',
  'Groin',
  'Quadriceps',
  'Hamstring',
  'Knee',
  'Shin',
  'Calf',
  'Ankle',
  'Foot / Toes',
  'Other',
];

const today = new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
  athlete_name: '',
  date: today,
  treatment_type: '',
  body_part: '',
  duration_minutes: '',
  notes: '',
};

function NewTreatment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    ...INITIAL_FORM,
    athlete_name: searchParams.get('athlete') ?? '',
  });
  const [athletes, setAthletes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/daily-treatments/athletes')
      .then(({ data }) => setAthletes(data))
      .catch(() => {/* non-fatal — combobox works without suggestions */});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.athlete_name.trim() || !form.date || !form.treatment_type || !form.body_part) {
      setError('Please fill in all required fields.');
      return;
    }

    const payload = {
      ...form,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    };

    try {
      setSubmitting(true);
      await api.post('/api/daily-treatments', payload);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save treatment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="new-treatment">
      <div className="form-header">
        <div>
          <h1 className="page-title">New Treatment</h1>
          <p className="page-subtitle">Log a new athletic training treatment</p>
        </div>
        <Link to="/" className="back-link">
          &larr; Back to Log
        </Link>
      </div>

      <form className="treatment-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-grid">
          {/* Athlete Name — searchable combobox */}
          <div className="form-group form-group--full">
            <label className="form-label">
              Athlete Name <span className="required">*</span>
            </label>
            <AthleteCombobox
              value={form.athlete_name}
              onChange={(val) => setForm((prev) => ({ ...prev, athlete_name: val }))}
              athletes={athletes}
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="date" className="form-label">
              Date <span className="required">*</span>
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className="form-input"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Duration */}
          <div className="form-group">
            <label htmlFor="duration_minutes" className="form-label">
              Duration (minutes)
            </label>
            <input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              className="form-input"
              placeholder="e.g. 20"
              min="1"
              max="480"
              value={form.duration_minutes}
              onChange={handleChange}
            />
          </div>

          {/* Treatment Type */}
          <div className="form-group">
            <label htmlFor="treatment_type" className="form-label">
              Treatment Type <span className="required">*</span>
            </label>
            <select
              id="treatment_type"
              name="treatment_type"
              className="form-input form-select"
              value={form.treatment_type}
              onChange={handleChange}
              required
            >
              <option value="">-- Select type --</option>
              {TREATMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Body Part */}
          <div className="form-group">
            <label htmlFor="body_part" className="form-label">
              Body Part <span className="required">*</span>
            </label>
            <select
              id="body_part"
              name="body_part"
              className="form-input form-select"
              value={form.body_part}
              onChange={handleChange}
              required
            >
              <option value="">-- Select body part --</option>
              {BODY_PARTS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="form-group form-group--full">
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              className="form-input form-textarea"
              placeholder="Additional details, observations, or follow-up instructions..."
              rows={4}
              value={form.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <Link to="/" className="btn btn--ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Treatment'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewTreatment;
