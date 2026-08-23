import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';
import { formatDate, parseLocalDate } from '../lib/dateUtils.js';
import './Forms.css';

const FIELD_TYPES = [
  { type: 'text',      label: 'Text Input',      icon: 'T'  },
  { type: 'textarea',  label: 'Long Text',        icon: 'Tl' },
  { type: 'checkbox',  label: 'Checkbox',         icon: 'C'  },
  { type: 'date',      label: 'Date',             icon: 'D'  },
  { type: 'select',    label: 'Dropdown',         icon: 'V'  },
  { type: 'heading',   label: 'Section Heading',  icon: 'H'  },
  { type: 'paragraph', label: 'Paragraph Text',   icon: 'P'  },
];

let _tid = 0;
function tmpId() { return `tmp-${++_tid}`; }

function fieldKey(f) { return f.id ?? f._tid; }

// ── Field row in editor ────────────────────────────────────────────
function FieldRow({ field, isEditing, onEdit, onSave, onCancel, onDelete, onMove, isFirst, isLast }) {
  const [draft, setDraft] = useState(field);
  const [newOption, setNewOption] = useState('');

  useEffect(() => { setDraft(field); }, [field]);

  const icon = FIELD_TYPES.find(t => t.type === field.field_type)?.icon ?? '?';
  const hasPlaceholder = ['text', 'textarea'].includes(field.field_type);
  const isLayout = ['heading', 'paragraph'].includes(field.field_type);

  return (
    <div className={`fe-field${isEditing ? ' editing' : ''}`}>
      <div className="fe-field-row">
        <span className="fe-field-icon">{icon}</span>
        <span className="fe-field-label">{field.label}</span>
        {field.required && !isLayout && <span className="fe-field-req">Required</span>}
        <div className="fe-field-actions">
          <button className="fe-icon-btn" onClick={() => onMove(-1)} disabled={isFirst} title="Move up">↑</button>
          <button className="fe-icon-btn" onClick={() => onMove(1)}  disabled={isLast}  title="Move down">↓</button>
          <button className="fe-icon-btn" onClick={() => isEditing ? onCancel() : onEdit()} title="Edit">✎</button>
          <button className="fe-icon-btn fe-icon-btn--danger" onClick={onDelete} title="Delete">×</button>
        </div>
      </div>

      {isEditing && (
        <div className="fe-field-editor">
          <div className="fe-field-editor-row">
            <label className="fe-label">Label</label>
            <input
              className="fe-input"
              value={draft.label}
              onChange={e => setDraft(p => ({ ...p, label: e.target.value }))}
            />
          </div>
          {hasPlaceholder && (
            <div className="fe-field-editor-row">
              <label className="fe-label">Placeholder</label>
              <input
                className="fe-input"
                value={draft.placeholder ?? ''}
                onChange={e => setDraft(p => ({ ...p, placeholder: e.target.value }))}
              />
            </div>
          )}
          {field.field_type === 'select' && (
            <div className="fe-field-editor-row">
              <label className="fe-label">Options</label>
              <div className="fe-options-list">
                {(draft.options ?? []).map((opt, i) => (
                  <div key={i} className="fe-option-item">
                    <span>{opt}</span>
                    <button className="fe-icon-btn fe-icon-btn--danger"
                      onClick={() => setDraft(p => ({ ...p, options: p.options.filter((_, j) => j !== i) }))}>×</button>
                  </div>
                ))}
                <div className="fe-option-add">
                  <input
                    className="fe-input"
                    placeholder="New option..."
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newOption.trim()) {
                        setDraft(p => ({ ...p, options: [...(p.options ?? []), newOption.trim()] }));
                        setNewOption('');
                      }
                    }}
                  />
                  <button className="btn btn--outline btn--sm" onClick={() => {
                    if (newOption.trim()) {
                      setDraft(p => ({ ...p, options: [...(p.options ?? []), newOption.trim()] }));
                      setNewOption('');
                    }
                  }}>Add</button>
                </div>
              </div>
            </div>
          )}
          {!isLayout && (
            <label className="fe-toggle-row">
              <input type="checkbox" checked={draft.required} onChange={e => setDraft(p => ({ ...p, required: e.target.checked }))} />
              Required
            </label>
          )}
          <div className="fe-field-editor-actions">
            <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary btn--sm" onClick={() => onSave(draft)}>Save Field</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field type picker ──────────────────────────────────────────────
function FieldTypePicker({ onSelect, onClose }) {
  return (
    <div className="fe-type-picker">
      <div className="fe-type-picker-header">
        <span>Add Field</span>
        <button className="fe-icon-btn" onClick={onClose}>×</button>
      </div>
      <div className="fe-type-grid">
        {FIELD_TYPES.map(ft => (
          <button key={ft.type} className="fe-type-btn" onClick={() => onSelect(ft.type)}>
            <span className="fe-type-btn-icon">{ft.icon}</span>
            <span>{ft.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Form editor ────────────────────────────────────────────────────
function FormEditor({ editor, onEditorChange, onSave, onCancel, saving, saveError }) {
  const [editingKey, setEditingKey] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const visibleFields = editor.fields.filter(f => !f._deleted);

  function addField(type) {
    const tid = tmpId();
    const defaultLabel = FIELD_TYPES.find(t => t.type === type)?.label ?? type;
    onEditorChange(prev => ({
      ...prev,
      fields: [...prev.fields, {
        _tid: tid, id: null, field_type: type,
        label: defaultLabel, placeholder: '', options: type === 'select' ? [] : null,
        required: false, sort_order: visibleFields.length, _deleted: false,
      }],
    }));
    setEditingKey(tid);
    setShowPicker(false);
  }

  function saveField(key, draft) {
    onEditorChange(prev => ({
      ...prev,
      fields: prev.fields.map(f => fieldKey(f) === key ? { ...f, ...draft } : f),
    }));
    setEditingKey(null);
  }

  function deleteField(key) {
    onEditorChange(prev => ({
      ...prev,
      fields: prev.fields.map(f => {
        if (fieldKey(f) !== key) return f;
        return f.id ? { ...f, _deleted: true } : null;
      }).filter(Boolean),
    }));
    if (editingKey === key) setEditingKey(null);
  }

  function moveField(key, dir) {
    const vis = editor.fields.filter(f => !f._deleted);
    const idx = vis.findIndex(f => fieldKey(f) === key);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= vis.length) return;
    const reordered = [...vis];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const deleted = editor.fields.filter(f => f._deleted);
    onEditorChange(prev => ({ ...prev, fields: [...reordered, ...deleted] }));
  }

  return (
    <div className="forms-page">
      <div className="forms-header">
        <div>
          <h1 className="forms-title">{editor.id ? 'Edit Form' : 'New Form'}</h1>
          <p className="forms-subtitle">Define fields, then assign to athletes from the Assignments tab.</p>
        </div>
        <div className="forms-header-actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>

      {saveError && <p className="forms-error">{saveError}</p>}

      <div className="fe-meta-card">
        <div className="fe-meta-row">
          <label className="fe-label">Form Title *</label>
          <input
            className="fe-input fe-input--wide"
            value={editor.title}
            onChange={e => onEditorChange(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Concussion Return-to-Play Clearance"
          />
        </div>
        <div className="fe-meta-row">
          <label className="fe-label">Description</label>
          <textarea
            className="fe-input fe-input--wide fe-textarea"
            value={editor.description}
            onChange={e => onEditorChange(p => ({ ...p, description: e.target.value }))}
            placeholder="Instructions shown to the person filling out the form"
            rows={2}
          />
        </div>
        <div className="fe-toggles">
          <label className="fe-toggle-row">
            <input type="checkbox" checked={editor.requires_signature}
              onChange={e => onEditorChange(p => ({ ...p, requires_signature: e.target.checked }))} />
            Requires signature
          </label>
          <label className="fe-toggle-row">
            <input type="checkbox" checked={editor.requires_athlete}
              onChange={e => onEditorChange(p => ({ ...p, requires_athlete: e.target.checked }))} />
            Athlete must complete
          </label>
          <label className="fe-toggle-row">
            <input type="checkbox" checked={editor.requires_parent}
              onChange={e => onEditorChange(p => ({ ...p, requires_parent: e.target.checked }))} />
            Parent must complete
          </label>
        </div>
      </div>

      <div className="fe-fields-section">
        <div className="fe-fields-header">
          <span className="fe-section-label">Fields</span>
          <button className="btn btn--outline btn--sm" onClick={() => setShowPicker(p => !p)}>
            + Add Field
          </button>
        </div>

        {showPicker && (
          <FieldTypePicker onSelect={addField} onClose={() => setShowPicker(false)} />
        )}

        {visibleFields.length === 0 && !showPicker && (
          <p className="fe-empty">No fields yet. Click &quot;Add Field&quot; to get started.</p>
        )}

        <div className="fe-field-list">
          {visibleFields.map((f, i) => {
            const key = fieldKey(f);
            return (
              <FieldRow
                key={key}
                field={f}
                isEditing={editingKey === key}
                onEdit={() => setEditingKey(key)}
                onSave={draft => saveField(key, draft)}
                onCancel={() => setEditingKey(null)}
                onDelete={() => deleteField(key)}
                onMove={dir => moveField(key, dir)}
                isFirst={i === 0}
                isLast={i === visibleFields.length - 1}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Assign modal ───────────────────────────────────────────────────
function AssignModal({ forms, athletes, onClose, onAssigned }) {
  const [formId, setFormId] = useState('');
  const [athleteIds, setAthleteIds] = useState([]);
  const [assignedTo, setAssignedTo] = useState('athlete');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function toggleAthlete(id) {
    setAthleteIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formId) { setError('Select a form'); return; }
    if (!athleteIds.length) { setError('Select at least one athlete'); return; }
    setError(null);
    setSaving(true);
    try {
      await api.post(`/api/portal/forms/${formId}/assign`, {
        athleteIds, assignedTo, dueDate: dueDate || null,
      });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="modal-title">Assign Form</h2>
          <button className="fe-icon-btn" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          {error && <p className="forms-error">{error}</p>}

          <div className="fe-meta-row">
            <label className="fe-label">Form</label>
            <select className="fe-input fe-input--wide" value={formId} onChange={e => setFormId(e.target.value)}>
              <option value="">Select a form...</option>
              {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>

          <div className="fe-meta-row">
            <label className="fe-label">Assign to</label>
            <div className="fe-toggles fe-toggles--row">
              {['athlete', 'parent', 'both'].map(v => (
                <label key={v} className="fe-toggle-row">
                  <input type="radio" name="assignedTo" value={v}
                    checked={assignedTo === v} onChange={() => setAssignedTo(v)} />
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="fe-meta-row">
            <label className="fe-label">Due date <span className="fe-optional">(optional)</span></label>
            <input type="date" className="fe-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="fe-meta-row">
            <label className="fe-label">Athletes</label>
            <div className="fe-athlete-list">
              {athletes.map(a => (
                <label key={a.id} className="fe-check-row">
                  <input type="checkbox" checked={athleteIds.includes(a.id)} onChange={() => toggleAthlete(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Submission modal ───────────────────────────────────────────────
function SubmissionModal({ assignment, fields, onClose }) {
  const responses    = assignment.submission_responses ?? {};
  const signature    = assignment.submission_signature;
  const pdfUrl       = assignment.submission_pdf_url;
  const submittedAt  = assignment.submitted_at;
  const submittedBy  = assignment.submitted_by_role;

  const inputFields = fields.filter(f => !['heading', 'paragraph'].includes(f.field_type));

  function formatValue(field) {
    const val = responses[field.id];
    if (val === undefined || val === null || val === '') return <em className="sub-empty">—</em>;
    if (field.field_type === 'checkbox') return val ? 'Yes' : 'No';
    return String(val);
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-box modal-box--wide">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{assignment.form_title}</h2>
            <p className="sub-modal-athlete">{assignment.athlete_name ?? '—'}</p>
          </div>
          <button className="fe-icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="sub-meta-bar">
            <span className="sub-meta-item">
              <span className="sub-meta-label">Submitted</span>
              {submittedAt ? new Date(submittedAt).toLocaleString() : '—'}
            </span>
            <span className="sub-meta-item">
              <span className="sub-meta-label">By</span>
              {submittedBy ? submittedBy.charAt(0).toUpperCase() + submittedBy.slice(1) : '—'}
            </span>
          </div>

          {pdfUrl ? (
            <div className="sub-section">
              <p className="sub-section-label">Submitted PDF</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--outline btn--sm"
              >
                View / Download PDF
              </a>
            </div>
          ) : (
            <>
              <div className="sub-section">
                <p className="sub-section-label">Responses</p>
                {inputFields.length === 0 ? (
                  <p className="sub-no-fields">This form has no input fields.</p>
                ) : (
                  <div className="sub-response-list">
                    {inputFields.map(field => (
                      <div key={field.id} className="sub-response-row">
                        <span className="sub-response-label">
                          {field.label}
                          {field.required && <span className="sub-required"> *</span>}
                        </span>
                        <span className="sub-response-val">{formatValue(field)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {signature && (
                <div className="sub-section">
                  <p className="sub-section-label">Signature</p>
                  <div className="sub-signature-wrap">
                    <img src={signature} alt="Athlete signature" className="sub-signature-img" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Status badge ───────────────────────────────────────────────────
function statusBadge(a) {
  if (a.completed) return <span className="forms-badge forms-badge--complete">Complete</span>;
  if (a.due_date && parseLocalDate(a.due_date) < new Date()) return <span className="forms-badge forms-badge--overdue">Overdue</span>;
  return <span className="forms-badge forms-badge--pending">Pending</span>;
}

// ── Main component ─────────────────────────────────────────────────
export default function Forms() {
  const [tab, setTab] = useState('builder');
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [viewingSubmission, setViewingSubmission] = useState(null); // { assignment, fields }
  const [loadingSubId, setLoadingSubId] = useState(null);

  const fetchForms = useCallback(async () => {
    setFormsLoading(true);
    try {
      const { data } = await api.get('/api/portal/forms');
      setForms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const [{ data: asgn }, { data: ath }] = await Promise.all([
        api.get('/api/portal/assignments'),
        api.get('/api/athletes'),
      ]);
      setAssignments(asgn);
      setAthletes(ath.filter(a => !a.archived));
    } catch (err) {
      console.error(err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'assignments') fetchAssignments();
  }, [tab, fetchAssignments]);

  function openNewForm() {
    setEditor({ id: null, title: '', description: '', requires_signature: true, requires_parent: false, requires_athlete: false, fields: [] });
    setSaveError(null);
  }

  async function openEditForm(form) {
    try {
      const { data } = await api.get(`/api/portal/forms/${form.id}`);
      setEditor({
        id: data.id,
        title: data.title,
        description: data.description ?? '',
        requires_signature: data.requires_signature,
        requires_parent: data.requires_parent,
        requires_athlete: data.requires_athlete,
        fields: data.fields.map(f => ({ ...f, _tid: null, _deleted: false })),
      });
      setSaveError(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave() {
    if (!editor.title.trim()) { setSaveError('Title is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      let formId = editor.id;
      const meta = {
        title: editor.title.trim(),
        description: editor.description || null,
        requires_signature: editor.requires_signature,
        requires_parent: editor.requires_parent,
        requires_athlete: editor.requires_athlete,
      };

      if (!formId) {
        const { data } = await api.post('/api/portal/forms', meta);
        formId = data.id;
      } else {
        await api.put(`/api/portal/forms/${formId}`, meta);
      }

      const active  = editor.fields.filter(f => !f._deleted);
      const deleted = editor.fields.filter(f => f._deleted && f.id);

      // Delete removed fields
      await Promise.all(deleted.map(f => api.delete(`/api/portal/forms/${formId}/fields/${f.id}`)));

      // Create new fields + update existing, both with sort_order
      await Promise.all(active.map((f, i) => {
        const payload = { label: f.label, placeholder: f.placeholder || null, options: f.options, required: f.required, sort_order: i };
        if (!f.id) {
          return api.post(`/api/portal/forms/${formId}/fields`, { field_type: f.field_type, ...payload });
        }
        return api.put(`/api/portal/forms/${formId}/fields/${f.id}`, payload);
      }));

      await fetchForms();
      setEditor(null);
    } catch (err) {
      setSaveError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openSubmission(assignment) {
    if (!assignment.completed) return;
    setLoadingSubId(assignment.id);
    try {
      const { data: formData } = await api.get(`/api/portal/forms/${assignment.form_id}`);
      setViewingSubmission({ assignment, fields: formData.fields });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubId(null);
    }
  }

  async function handleDeleteForm(id) {
    if (!confirm('Delete this form? This cannot be undone.')) return;
    try {
      await api.delete(`/api/portal/forms/${id}`);
      setForms(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  if (editor) {
    return (
      <FormEditor
        editor={editor}
        onEditorChange={setEditor}
        onSave={handleSave}
        onCancel={() => setEditor(null)}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  return (
    <div className="forms-page">
      <div className="forms-header">
        <div>
          <h1 className="forms-title">Forms</h1>
          <p className="forms-subtitle">Build forms and assign them to athletes and parents.</p>
        </div>
        {tab === 'builder' && (
          <button className="btn btn--primary" onClick={openNewForm}>+ New Form</button>
        )}
        {tab === 'assignments' && (
          <button className="btn btn--primary" onClick={() => setShowAssignModal(true)}>+ Assign Form</button>
        )}
      </div>

      <div className="forms-tabs">
        <button className={`forms-tab${tab === 'builder' ? ' active' : ''}`} onClick={() => setTab('builder')}>Form Builder</button>
        <button className={`forms-tab${tab === 'assignments' ? ' active' : ''}`} onClick={() => setTab('assignments')}>Assignments</button>
      </div>

      {tab === 'builder' && (
        <div className="forms-list">
          {formsLoading ? (
            <p className="forms-empty">Loading...</p>
          ) : forms.length === 0 ? (
            <div className="forms-empty-state">
              <p>No forms yet. Create your first form to get started.</p>
              <button className="btn btn--outline" onClick={openNewForm}>+ New Form</button>
            </div>
          ) : (
            forms.map(f => (
              <div key={f.id} className="forms-card">
                <div className="forms-card-info">
                  <p className="forms-card-title">{f.title}</p>
                  <p className="forms-card-meta">
                    {f.field_count} field{f.field_count !== 1 ? 's' : ''} &middot;{' '}
                    {f.assignment_count} assignment{f.assignment_count !== 1 ? 's' : ''}
                    {f.requires_signature && ' · Signature required'}
                  </p>
                </div>
                <div className="forms-card-actions">
                  <button className="btn btn--outline btn--sm" onClick={() => openEditForm(f)}>Edit</button>
                  <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDeleteForm(f.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <div className="forms-table-wrap">
          {assignmentsLoading ? (
            <p className="forms-empty">Loading...</p>
          ) : assignments.length === 0 ? (
            <p className="forms-empty">No assignments yet.</p>
          ) : (
            <table className="forms-table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Athlete</th>
                  <th>Assigned To</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr
                    key={a.id}
                    className={a.completed ? 'forms-row--clickable' : ''}
                    onClick={() => openSubmission(a)}
                    title={a.completed ? 'Click to view submission' : undefined}
                  >
                    <td>{a.form_title}</td>
                    <td>{a.athlete_name ?? '—'}</td>
                    <td className="forms-assigned-to">{a.assigned_to}</td>
                    <td>{formatDate(a.due_date)}</td>
                    <td>
                      {loadingSubId === a.id
                        ? <span className="forms-badge forms-badge--pending">Loading…</span>
                        : statusBadge(a)
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAssignModal && (
        <AssignModal
          forms={forms}
          athletes={athletes}
          onClose={() => setShowAssignModal(false)}
          onAssigned={fetchAssignments}
        />
      )}

      {viewingSubmission && (
        <SubmissionModal
          assignment={viewingSubmission.assignment}
          fields={viewingSubmission.fields}
          onClose={() => setViewingSubmission(null)}
        />
      )}
    </div>
  );
}
