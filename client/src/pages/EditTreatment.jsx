import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import AthleteCombobox from '../components/AthleteCombobox.jsx';
import SportCombobox from '../components/SportCombobox.jsx';
import './NewTreatment.css';

const TREATMENT_TYPES = ['Ice', 'Heat', 'Ultrasound', 'E-Stim', 'Massage', 'Taping', 'Cupping', 'Exercise'];

const BODY_PARTS = [
  'Head / Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand / Fingers',
  'Chest', 'Upper Back', 'Lower Back', 'Hip', 'Groin', 'Quadriceps', 'Hamstring',
  'Knee', 'Shin', 'Calf', 'Ankle', 'Foot / Toes', 'Other',
];

export default function EditTreatment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loadingRecord, setLoadingRecord] = useState(true);
  const [athletes, setAthletes] = useState([]);

  const [athleteName, setAthleteName] = useState('');
  const [sport, setSport] = useState('');
  const [date, setDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [bodyPart, setBodyPart] = useState('');
  const [notes, setNotes] = useState('');

  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const exerciseRef = useRef(null);

  const [injuryId, setInjuryId] = useState('');
  const [activeInjuries, setActiveInjuries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const exerciseSelected = selectedTypes.includes('Exercise');

  // Fetch existing record + athlete list
  useEffect(() => {
    Promise.all([
      api.get(`/api/daily-treatments/${id}`),
      api.get('/api/daily-treatments/athletes'),
    ]).then(([recordRes, athletesRes]) => {
      const record = recordRes.data;
      setAthletes(athletesRes.data);
      setAthleteName(record.athlete_name ?? '');
      setSport(record.sport ?? '');
      setDate(record.date ?? '');
      setDurationMinutes(record.duration_minutes ? String(record.duration_minutes) : '');
      setSelectedTypes(record.treatment_type ? record.treatment_type.split(',').map((t) => t.trim()).filter(Boolean) : []);
      setBodyPart(record.body_part ?? '');
      setNotes(record.notes ?? '');
      setSelectedExercises(record.exercises_performed ? record.exercises_performed.split(',').map((e) => e.trim()).filter(Boolean) : []);
      setInjuryId(record.injury_id ?? '');
      // Fetch active injuries for this athlete
      if (record.athlete_name) {
        api.get(`/api/injuries?active=true&athlete_name=${encodeURIComponent(record.athlete_name)}`)
          .then(({ data }) => setActiveInjuries(data))
          .catch(() => {});
      }
      setLoadingRecord(false);
    }).catch(() => { setError('Failed to load treatment.'); setLoadingRecord(false); });
  }, [id]);

  useEffect(() => {
    if (!exerciseSelected) return;
    api.get('/api/exercises').then(({ data }) => setExerciseLibrary(data.map((e) => e.name))).catch(() => {});
  }, [exerciseSelected]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (exerciseRef.current && !exerciseRef.current.contains(e.target)) setExerciseOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleType(type) {
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
    if (type === 'Exercise') { setSelectedExercises([]); setExerciseSearch(''); setExerciseOpen(false); }
  }

  function toggleExercise(name) {
    setSelectedExercises((prev) => prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]);
  }

  async function handleAddExercise() {
    const name = exerciseSearch.trim();
    if (!name) return;
    if (exerciseLibrary.map((e) => e.toLowerCase()).includes(name.toLowerCase())) {
      if (!selectedExercises.includes(name)) setSelectedExercises((prev) => [...prev, name]);
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

  const filteredExercises = exerciseLibrary.filter((e) => e.toLowerCase().includes(exerciseSearch.toLowerCase()));
  const showAddNew = exerciseSearch.trim() && !exerciseLibrary.some((e) => e.toLowerCase() === exerciseSearch.trim().toLowerCase());

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!athleteName.trim() || !sport || !date || selectedTypes.length === 0 || !bodyPart) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      setSubmitting(true);
      await api.put(`/api/daily-treatments/${id}`, {
        athlete_name: athleteName.trim(),
        sport,
        date,
        treatment_type: selectedTypes.join(', '),
        body_part: bodyPart,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        notes: notes || null,
        exercises_performed: selectedExercises.length > 0 ? selectedExercises.join(', ') : null,
        injury_id: injuryId || null,
      });
      navigate(-1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update treatment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRecord) {
    return <div className="state-msg"><div className="spinner" /><span>Loading...</span></div>;
  }

  return (
    <div className="new-treatment">
      <div className="form-header">
        <div>
          <h1 className="page-title">Edit Treatment</h1>
          <p className="page-subtitle">Update this treatment record</p>
        </div>
        <button className="back-link" onClick={() => navigate(-1)}>&larr; Back</button>
      </div>

      <form className="treatment-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="form-grid">
          {/* Athlete Name */}
          <div className="form-group form-group--full">
            <label className="form-label">Athlete Name <span className="required">*</span></label>
            <AthleteCombobox value={athleteName} onChange={setAthleteName} athletes={athletes} />
          </div>

          {/* Sport */}
          <div className="form-group form-group--full">
            <label className="form-label">Sport <span className="required">*</span></label>
            <SportCombobox value={sport} onChange={setSport} />
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="et-date" className="form-label">Date <span className="required">*</span></label>
            <input id="et-date" type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          {/* Duration */}
          <div className="form-group">
            <label htmlFor="et-duration" className="form-label">Duration (minutes)</label>
            <input id="et-duration" type="number" className="form-input" placeholder="e.g. 20" min="1" max="480" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
          </div>

          {/* Treatment Type */}
          <div className="form-group form-group--full">
            <label className="form-label">Treatment Type <span className="required">*</span></label>
            <div className="type-checklist">
              {TREATMENT_TYPES.map((type) => (
                <button key={type} type="button" className={`type-pill ${selectedTypes.includes(type) ? 'type-pill--selected' : ''}`} onClick={() => toggleType(type)}>
                  {selectedTypes.includes(type) && <span className="pill-check">✓</span>}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise selector */}
          {exerciseSelected && (
            <div className="form-group form-group--full">
              <label className="form-label">Exercises</label>
              <div className="exercise-selector" ref={exerciseRef}>
                {selectedExercises.length > 0 && (
                  <div className="exercise-chips">
                    {selectedExercises.map((ex) => (
                      <span key={ex} className="exercise-chip">
                        {ex}
                        <button type="button" className="chip-remove" onClick={() => toggleExercise(ex)} aria-label={`Remove ${ex}`}>&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <button type="button" className="exercise-toggle" onClick={() => setExerciseOpen((o) => !o)}>
                  {exerciseOpen ? 'Close' : 'Select exercises...'}
                  <span className="toggle-caret">{exerciseOpen ? '▲' : '▼'}</span>
                </button>
                {exerciseOpen && (
                  <div className="exercise-dropdown">
                    <div className="exercise-search-row">
                      <input type="text" className="form-input exercise-search" placeholder="Search or add new..." value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (showAddNew) handleAddExercise(); } }}
                        autoFocus />
                    </div>
                    <div className="exercise-list">
                      {filteredExercises.length === 0 && !showAddNew && <p className="exercise-empty">No exercises found.</p>}
                      {filteredExercises.map((ex) => (
                        <label key={ex} className="exercise-option">
                          <input type="checkbox" checked={selectedExercises.includes(ex)} onChange={() => toggleExercise(ex)} />
                          <span>{ex}</span>
                        </label>
                      ))}
                    </div>
                    {showAddNew && (
                      <button type="button" className="exercise-add-new" onClick={handleAddExercise} disabled={addingExercise}>
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
            <label htmlFor="et-body" className="form-label">Body Part <span className="required">*</span></label>
            <select id="et-body" className="form-input form-select" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} required>
              <option value="">-- Select body part --</option>
              {BODY_PARTS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Link to Injury */}
          {activeInjuries.length > 0 && (
            <div className="form-group form-group--full">
              <label htmlFor="et-injury" className="form-label">Link to Injury</label>
              <select
                id="et-injury"
                className="form-input form-select"
                value={injuryId}
                onChange={(e) => setInjuryId(e.target.value)}
              >
                <option value="">— General treatment (no linked injury) —</option>
                {activeInjuries.map((inj) => (
                  <option key={inj.id} value={inj.id}>
                    {inj.injury_type} · {inj.body_part}
                    {inj.injury_date ? ` (${new Date(inj.injury_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="form-group form-group--full">
            <label htmlFor="et-notes" className="form-label">Notes</label>
            <textarea id="et-notes" className="form-input form-textarea" placeholder="Additional details..." rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
