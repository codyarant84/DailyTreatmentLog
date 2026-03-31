import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api.js';
import './ExerciseLibrary.css';

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export const BODY_PARTS = [
  'Knee',
  'Hip',
  'Ankle & Foot',
  'Shoulder',
  'Elbow, Wrist & Hand',
  'Core & Low Back',
  'Upper Back & Thoracic',
  'Cervical (Neck)',
];

const EMPTY_FORM = { name: '', description: '', video_url: '', body_parts: '' };

function parseBodyParts(str) {
  if (!str) return [];
  return str.split(',').map((p) => p.trim()).filter(Boolean);
}

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterPart, setFilterPart] = useState('');
  // Set of body part names that are collapsed
  const [collapsed, setCollapsed] = useState(new Set());

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

  // Group exercises into sections by body part
  const grouped = useMemo(() => {
    const sections = [];
    const seen = new Set(); // track which exercises appear in at least one section

    for (const part of BODY_PARTS) {
      if (filterPart && filterPart !== part) continue;
      const exes = exercises
        .filter((ex) => parseBodyParts(ex.body_parts).includes(part))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (exes.length > 0) {
        exes.forEach((ex) => seen.add(ex.id));
        sections.push({ part, exercises: exes });
      }
    }

    // Uncategorized — exercises with no body_parts assigned
    if (!filterPart) {
      const uncategorized = exercises.filter((ex) => !seen.has(ex.id));
      if (uncategorized.length > 0) {
        sections.push({ part: 'Other', exercises: uncategorized.sort((a, b) => a.name.localeCompare(b.name)) });
      }
    }

    return sections;
  }, [exercises, filterPart]);

  const totalShown = useMemo(() => {
    const ids = new Set(grouped.flatMap((s) => s.exercises.map((e) => e.id)));
    return ids.size;
  }, [grouped]);

  function toggleCollapse(part) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(part) ? next.delete(part) : next.add(part);
      return next;
    });
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpenForm('new');
  }

  function openEdit(ex) {
    setForm({
      name: ex.name,
      description: ex.description ?? '',
      video_url: ex.video_url ?? '',
      body_parts: ex.body_parts ?? '',
    });
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
        setExercises((prev) => [...prev, data]);
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

      {/* Header */}
      <div className="lib-header">
        <div>
          <h1 className="page-title">Exercise Library</h1>
          <p className="page-subtitle">Browse and reference exercises by body part. Add to athlete treatment notes or rehab programs.</p>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            {filterPart && ` · ${totalShown} in ${filterPart}`}
          </p>
        </div>
        <button className="btn btn--primary" onClick={openNew}>+ Add Exercise</button>
      </div>

      {/* Filter dropdown */}
      <div className="lib-filter-bar">
        <label className="lib-filter-label" htmlFor="bp-filter">Body Part</label>
        <select
          id="bp-filter"
          className="lib-filter-select"
          value={filterPart}
          onChange={(e) => setFilterPart(e.target.value)}
        >
          <option value="">All Body Parts</option>
          {BODY_PARTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {filterPart && (
          <button className="btn btn--ghost btn--sm" onClick={() => setFilterPart('')}>
            Clear
          </button>
        )}
      </div>

      {/* Add form (full-width, above sections) */}
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

      {/* Accordion sections */}
      <div className="lib-sections">
        {grouped.map(({ part, exercises: exes }) => {
          const isCollapsed = collapsed.has(part);
          return (
            <div key={part} className="lib-section">
              <button
                className="lib-section-header"
                onClick={() => toggleCollapse(part)}
                aria-expanded={!isCollapsed}
              >
                <span className="lib-section-title">{part}</span>
                <span className="lib-section-meta">{exes.length} exercise{exes.length !== 1 ? 's' : ''}</span>
                <span className={`lib-chevron ${isCollapsed ? 'lib-chevron--collapsed' : ''}`}>▾</span>
              </button>

              {!isCollapsed && (
                <div className="exercise-grid">
                  {exes.map((ex) => {
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
  const selectedParts = parseBodyParts(form.body_parts);

  function togglePart(part) {
    const next = selectedParts.includes(part)
      ? selectedParts.filter((p) => p !== part)
      : [...selectedParts, part];
    setForm((p) => ({ ...p, body_parts: next.join(', ') }));
  }

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
        <label className="form-label">Body Part(s)</label>
        <div className="body-part-checks">
          {BODY_PARTS.map((part) => (
            <label key={part} className={`bp-check ${selectedParts.includes(part) ? 'bp-check--active' : ''}`}>
              <input
                type="checkbox"
                checked={selectedParts.includes(part)}
                onChange={() => togglePart(part)}
              />
              {part}
            </label>
          ))}
        </div>
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
