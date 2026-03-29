import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import './ExerciseLibrary.css';

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

const EMPTY_FORM = { name: '', description: '', video_url: '' };

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // null = closed, 'new' = add form, exerciseId = edit form
  const [openForm, setOpenForm] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/exercises');
      setExercises(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpenForm('new');
  }

  function openEdit(ex) {
    setForm({ name: ex.name, description: ex.description ?? '', video_url: ex.video_url ?? '' });
    setFormError(null);
    setOpenForm(ex.id);
  }

  function closeForm() {
    setOpenForm(null);
    setFormError(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      if (openForm === 'new') {
        const { data } = await api.post('/api/exercises', form);
        setExercises((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const { data } = await api.put(`/api/exercises/${openForm}`, form);
        setExercises((prev) => prev.map((ex) => ex.id === openForm ? data : ex));
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? It will be removed from any rehab programs too.`)) return;
    try {
      await api.delete(`/api/exercises/${id}`);
      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      if (openForm === id) closeForm();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    }
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading...</span></div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="exercise-library">
      <div className="lib-header">
        <div>
          <h1 className="page-title">Exercise Library</h1>
          <p className="page-subtitle">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn--primary" onClick={openNew}>+ Add Exercise</button>
      </div>

      {/* Add form */}
      {openForm === 'new' && (
        <ExerciseForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
          error={formError}
          title="New Exercise"
        />
      )}

      {exercises.length === 0 && openForm !== 'new' && (
        <p className="lib-empty">No exercises yet. Add one to get started.</p>
      )}

      <div className="exercise-grid">
        {exercises.map((ex) => {
          const ytId = getYouTubeId(ex.video_url);
          const isEditing = openForm === ex.id;

          return (
            <div key={ex.id} className={`exercise-card ${isEditing ? 'exercise-card--editing' : ''}`}>
              {isEditing ? (
                <ExerciseForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={closeForm}
                  saving={saving}
                  error={formError}
                  title="Edit Exercise"
                />
              ) : (
                <>
                  {ytId && (
                    <a
                      href={ex.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-thumb-link"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        alt={`${ex.name} video`}
                        className="video-thumb"
                      />
                      <span className="play-badge">▶ Watch</span>
                    </a>
                  )}
                  <div className="exercise-card-body">
                    <h3 className="exercise-name">{ex.name}</h3>
                    {ex.description && <p className="exercise-desc">{ex.description}</p>}
                    {ex.video_url && !ytId && (
                      <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="video-link">
                        🔗 Video
                      </a>
                    )}
                  </div>
                  <div className="exercise-card-actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => openEdit(ex)}>Edit</button>
                    <button className="btn btn--sm btn--danger-ghost" onClick={() => handleDelete(ex.id, ex.name)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseForm({ form, setForm, onSave, onCancel, saving, error, title }) {
  const ytId = getYouTubeId(form.video_url);

  return (
    <form className="exercise-form-card" onSubmit={onSave} noValidate>
      <h3 className="exercise-form-title">{title}</h3>
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">Name <span className="required">*</span></label>
        <input
          type="text"
          className="form-input"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Quad Sets"
          autoFocus
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-input form-textarea"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Cues, technique notes, or instructions..."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Video URL</label>
        <input
          type="url"
          className="form-input"
          value={form.video_url}
          onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
          placeholder="https://youtube.com/watch?v=..."
        />
        {ytId && (
          <div className="video-preview-inline">
            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="Preview" />
            <span className="preview-label">YouTube video detected</span>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Exercise'}
        </button>
      </div>
    </form>
  );
}
