import { useState, useEffect, useRef } from 'react';
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
  'Cupping',
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

function NewTreatment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [athleteName, setAthleteName] = useState(searchParams.get('athlete') ?? '');
  const [date, setDate] = useState(today);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [bodyPart, setBodyPart] = useState('');
  const [notes, setNotes] = useState('');

  // Exercise library
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const exerciseRef = useRef(null);

  const [athletes, setAthletes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const exerciseSelected = selectedTypes.includes('Exercise');

  useEffect(() => {
    api.get('/api/daily-treatments/athletes')
      .then(({ data }) => setAthletes(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!exerciseSelected) return;
    api.get('/api/exercises')
      .then(({ data }) => setExerciseLibrary(data.map((e) => e.name)))
      .catch(() => {});
  }, [exerciseSelected]);

  // Close exercise dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (exerciseRef.current && !exerciseRef.current.contains(e.target)) {
        setExerciseOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleType(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    if (type === 'Exercise') {
      setSelectedExercises([]);
      setExerciseSearch('');
      setExerciseOpen(false);
    }
  }

  function toggleExercise(name) {
    setSelectedExercises((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );
  }

  async function handleAddExercise() {
    const name = exerciseSearch.trim();
    if (!name) return;
    if (exerciseLibrary.map((e) => e.toLowerCase()).includes(name.toLowerCase())) {
      // Already exists — just select it
      if (!selectedExercises.includes(name)) {
        setSelectedExercises((prev) => [...prev, name]);
      }
      setExerciseSearch('');
      return;
    }
    setAddingExercise(true);
    try {
      await api.post('/api/exercises', { name });
      setExerciseLibrary((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
      setSelectedExercises((prev) => [...prev, name]);
      setExerciseSearch('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add exercise.');
    } finally {
      setAddingExercise(false);
    }
  }

  const filteredExercises = exerciseLibrary.filter((e) =>
    e.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const showAddNew =
    exerciseSearch.trim() &&
    !exerciseLibrary.some((e) => e.toLowerCase() === exerciseSearch.trim().toLowerCase());

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!athleteName.trim() || !date || selectedTypes.length === 0 || !bodyPart) {
      setError('Please fill in all required fields.');
      return;
    }

    const payload = {
      athlete_name: athleteName.trim(),
      date,
      treatment_type: selectedTypes.join(', '),
      body_part: bodyPart,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      notes: notes || null,
      exercises_performed: selectedExercises.length > 0 ? selectedExercises.join(', ') : null,
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
          {/* Athlete Name */}
          <div className="form-group form-group--full">
            <label className="form-label">
              Athlete Name <span className="required">*</span>
            </label>
            <AthleteCombobox
              value={athleteName}
              onChange={setAthleteName}
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
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
              type="number"
              className="form-input"
              placeholder="e.g. 20"
              min="1"
              max="480"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>

          {/* Treatment Type — checklist */}
          <div className="form-group form-group--full">
            <label className="form-label">
              Treatment Type <span className="required">*</span>
            </label>
            <div className="type-checklist">
              {TREATMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`type-pill ${selectedTypes.includes(type) ? 'type-pill--selected' : ''}`}
                  onClick={() => toggleType(type)}
                >
                  {selectedTypes.includes(type) && <span className="pill-check">✓</span>}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise selector — shown only when Exercise is checked */}
          {exerciseSelected && (
            <div className="form-group form-group--full">
              <label className="form-label">Exercises</label>
              <div className="exercise-selector" ref={exerciseRef}>
                {/* Selected chips */}
                {selectedExercises.length > 0 && (
                  <div className="exercise-chips">
                    {selectedExercises.map((ex) => (
                      <span key={ex} className="exercise-chip">
                        {ex}
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => toggleExercise(ex)}
                          aria-label={`Remove ${ex}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown toggle */}
                <button
                  type="button"
                  className="exercise-toggle"
                  onClick={() => setExerciseOpen((o) => !o)}
                >
                  {exerciseOpen ? 'Close' : 'Select exercises...'}
                  <span className="toggle-caret">{exerciseOpen ? '▲' : '▼'}</span>
                </button>

                {exerciseOpen && (
                  <div className="exercise-dropdown">
                    <div className="exercise-search-row">
                      <input
                        type="text"
                        className="form-input exercise-search"
                        placeholder="Search or add new..."
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (showAddNew) handleAddExercise();
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div className="exercise-list">
                      {filteredExercises.length === 0 && !showAddNew && (
                        <p className="exercise-empty">No exercises found.</p>
                      )}
                      {filteredExercises.map((ex) => (
                        <label key={ex} className="exercise-option">
                          <input
                            type="checkbox"
                            checked={selectedExercises.includes(ex)}
                            onChange={() => toggleExercise(ex)}
                          />
                          <span>{ex}</span>
                        </label>
                      ))}
                    </div>

                    {showAddNew && (
                      <button
                        type="button"
                        className="exercise-add-new"
                        onClick={handleAddExercise}
                        disabled={addingExercise}
                      >
                        {addingExercise ? 'Adding...' : `+ Add "${exerciseSearch.trim()}" to library`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Body Part */}
          <div className="form-group">
            <label htmlFor="body_part" className="form-label">
              Body Part <span className="required">*</span>
            </label>
            <select
              id="body_part"
              className="form-input form-select"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
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
            <label htmlFor="notes" className="form-label">Notes</label>
            <textarea
              id="notes"
              className="form-input form-textarea"
              placeholder="Additional details, observations, or follow-up instructions..."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
