import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';
import AthleteCombobox from '../components/AthleteCombobox.jsx';
import './ProgramBuilder.css';

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

let tempId = 0;
function nextId() { return `tmp-${++tempId}`; }

export default function ProgramBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([]); // { _id, exercise_id, name, video_url, sets, reps, duration_seconds, notes }

  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/exercises').then(({ data }) => setExerciseLibrary(data)).catch(() => {});
    api.get('/api/daily-treatments/athletes').then(({ data }) => setAthletes(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api.get(`/api/rehab-programs/${id}`)
      .then(({ data }) => {
        setName(data.name);
        setAthleteName(data.athlete_name ?? '');
        setDescription(data.description ?? '');
        setRows(data.program_exercises.map((pe) => ({
          _id: nextId(),
          exercise_id: pe.exercises.id,
          name: pe.exercises.name,
          video_url: pe.exercises.video_url ?? '',
          sets: pe.sets ?? '',
          reps: pe.reps ?? '',
          duration_seconds: pe.duration_seconds ?? '',
          notes: pe.notes ?? '',
        })));
      })
      .catch((err) => setError(err.response?.data?.error ?? err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function addRow() {
    setRows((prev) => [...prev, {
      _id: nextId(), exercise_id: '', name: '', video_url: '',
      sets: '', reps: '', duration_seconds: '', notes: '',
    }]);
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r._id !== rowId));
  }

  function moveRow(rowId, dir) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === rowId);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function updateRow(rowId, field, value) {
    setRows((prev) => prev.map((r) => r._id === rowId ? { ...r, [field]: value } : r));
  }

  function selectExercise(rowId, exerciseId) {
    const ex = exerciseLibrary.find((e) => e.id === exerciseId);
    if (!ex) return;
    setRows((prev) => prev.map((r) =>
      r._id === rowId
        ? { ...r, exercise_id: ex.id, name: ex.name, video_url: ex.video_url ?? '' }
        : r
    ));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Program name is required.'); return; }
    const incomplete = rows.find((r) => !r.exercise_id);
    if (incomplete) { setError('Select an exercise for every row, or remove empty ones.'); return; }

    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      athlete_name: athleteName.trim() || null,
      description: description.trim() || null,
      exercises: rows.map((r) => ({
        exercise_id: r.exercise_id,
        sets: r.sets ? Number(r.sets) : null,
        reps: r.reps ? Number(r.reps) : null,
        duration_seconds: r.duration_seconds ? Number(r.duration_seconds) : null,
        notes: r.notes || null,
      })),
    };

    try {
      if (isNew) {
        await api.post('/api/rehab-programs', payload);
      } else {
        await api.put(`/api/rehab-programs/${id}`, payload);
      }
      navigate('/programs');
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div className="program-builder">
      <div className="pb-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Program' : 'Edit Program'}</h1>
          <p className="page-subtitle">Build a rehab exercise program</p>
        </div>
        <Link to="/programs" className="back-link">&larr; All Programs</Link>
      </div>

      <form onSubmit={handleSave} noValidate>
        {error && <div className="form-error" role="alert">{error}</div>}

        {/* Program info */}
        <div className="pb-card">
          <h2 className="pb-section-title">Program Details</h2>
          <div className="pb-info-grid">
            <div className="form-group">
              <label className="form-label">Program Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ACL Recovery — Week 1"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Athlete</label>
              <AthleteCombobox
                value={athleteName}
                onChange={setAthleteName}
                athletes={athletes}
              />
            </div>
            <div className="form-group form-group--full">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Goals, notes, or instructions for this program..."
              />
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="pb-card">
          <div className="pb-exercises-header">
            <h2 className="pb-section-title">Exercises ({rows.length})</h2>
            <button type="button" className="btn btn--sm btn--outline" onClick={addRow}>
              + Add Exercise
            </button>
          </div>

          {rows.length === 0 && (
            <p className="pb-empty">No exercises yet. Click "Add Exercise" to begin.</p>
          )}

          <div className="exercise-rows">
            {rows.map((row, idx) => {
              const ytId = getYouTubeId(row.video_url);
              return (
                <div key={row._id} className="exercise-row">
                  <div className="row-order">
                    <button
                      type="button"
                      className="order-btn"
                      onClick={() => moveRow(row._id, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                    >▲</button>
                    <span className="order-num">{idx + 1}</span>
                    <button
                      type="button"
                      className="order-btn"
                      onClick={() => moveRow(row._id, 1)}
                      disabled={idx === rows.length - 1}
                      aria-label="Move down"
                    >▼</button>
                  </div>

                  <div className="row-content">
                    <div className="row-top">
                      <div className="form-group exercise-select-group">
                        <label className="form-label">Exercise <span className="required">*</span></label>
                        <select
                          className="form-input form-select"
                          value={row.exercise_id}
                          onChange={(e) => selectExercise(row._id, e.target.value)}
                          required
                        >
                          <option value="">— Select exercise —</option>
                          {exerciseLibrary.map((ex) => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))}
                        </select>
                      </div>

                      {ytId && (
                        <a
                          href={row.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="row-video-thumb"
                          title="Watch video"
                        >
                          <img src={`https://img.youtube.com/vi/${ytId}/default.jpg`} alt="video" />
                          <span className="row-play">▶</span>
                        </a>
                      )}
                    </div>

                    <div className="row-params">
                      <div className="form-group param-group">
                        <label className="form-label">Sets</label>
                        <input
                          type="number" min="1" max="99"
                          className="form-input"
                          value={row.sets}
                          onChange={(e) => updateRow(row._id, 'sets', e.target.value)}
                          placeholder="—"
                        />
                      </div>
                      <div className="form-group param-group">
                        <label className="form-label">Reps</label>
                        <input
                          type="number" min="1" max="999"
                          className="form-input"
                          value={row.reps}
                          onChange={(e) => updateRow(row._id, 'reps', e.target.value)}
                          placeholder="—"
                        />
                      </div>
                      <div className="form-group param-group">
                        <label className="form-label">Duration (sec)</label>
                        <input
                          type="number" min="1"
                          className="form-input"
                          value={row.duration_seconds}
                          onChange={(e) => updateRow(row._id, 'duration_seconds', e.target.value)}
                          placeholder="—"
                        />
                      </div>
                      <div className="form-group param-group param-group--notes">
                        <label className="form-label">Notes</label>
                        <input
                          type="text"
                          className="form-input"
                          value={row.notes}
                          onChange={(e) => updateRow(row._id, 'notes', e.target.value)}
                          placeholder="Optional cue or note"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="row-delete"
                    onClick={() => removeRow(row._id)}
                    aria-label="Remove exercise"
                    title="Remove"
                  >&times;</button>
                </div>
              );
            })}
          </div>

          {rows.length > 0 && (
            <button type="button" className="btn btn--sm btn--outline add-more-btn" onClick={addRow}>
              + Add Exercise
            </button>
          )}
        </div>

        <div className="pb-actions">
          <Link to="/programs" className="btn btn--ghost">Cancel</Link>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Program' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
