import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import AthleteCombobox from '../components/AthleteCombobox.jsx';
import SelectWithOther from '../components/SelectWithOther.jsx';
import { CategoryBadge, DispositionBadge } from '../components/GeneralMedicalBadges.jsx';
import { CATEGORIES, SUBCATEGORY_OPTIONS, DISPOSITIONS } from '../lib/generalMedical.js';
import { formatDate } from '../lib/dateUtils.js';
import './GeneralMedical.css';

function emptyForm() {
  return {
    event_date:             new Date().toISOString().split('T')[0],
    event_time:             '',
    category:               '',
    subcategory:            '',
    chief_complaint:        '',
    treatment_administered: '',
    disposition:            '',
    follow_up_required:     false,
    notes:                  '',
  };
}

function LogEntryTab({ event, athletes, athleteNames, onSaved, onCancelEdit }) {
  const isEdit = Boolean(event);
  const [athleteName, setAthleteName] = useState(isEdit ? event.athlete_name : '');
  const [form, setForm] = useState(
    isEdit
      ? {
          event_date:             event.event_date,
          event_time:             event.event_time ?? '',
          category:               event.category,
          subcategory:            event.subcategory ?? '',
          chief_complaint:        event.chief_complaint,
          treatment_administered: event.treatment_administered ?? '',
          disposition:            event.disposition,
          follow_up_required:     event.follow_up_required ?? false,
          notes:                  event.notes ?? '',
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [saved, setSaved]   = useState(false);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  function setCategory(cat) {
    setForm((p) => ({ ...p, category: cat, subcategory: '' }));
  }

  const selectedAthlete = athletes.find((a) => a.name === athleteName);
  const subcategoryOptions = SUBCATEGORY_OPTIONS[form.category];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit && !selectedAthlete)  { setError('Select an athlete from the list.'); return; }
    if (!form.event_date)             { setError('Event date is required.'); return; }
    if (!form.category)               { setError('Category is required.'); return; }
    if (!form.chief_complaint.trim()) { setError('Chief complaint is required.'); return; }
    if (!form.disposition)            { setError('Disposition is required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        event_time:             form.event_time || null,
        subcategory:            form.subcategory || null,
        treatment_administered: form.treatment_administered || null,
        notes:                  form.notes || null,
      };
      const { data } = isEdit
        ? await api.put(`/api/general-medical/${event.id}`, payload)
        : await api.post('/api/general-medical', { ...payload, athlete_id: selectedAthlete.id });

      onSaved(data, isEdit);

      if (!isEdit) {
        setAthleteName('');
        setForm(emptyForm());
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}
      {saved && <div className="gm-success">Event logged.</div>}

      <div className="form-group">
        <label className="form-label">Athlete <span className="required">*</span></label>
        {isEdit ? (
          <div className="gm-locked-athlete">{event.athlete_name}</div>
        ) : (
          <AthleteCombobox value={athleteName} onChange={setAthleteName} athletes={athleteNames} />
        )}
      </div>

      <div className="modal-row">
        <div className="form-group">
          <label className="form-label">Date <span className="required">*</span></label>
          <input
            type="date"
            className="form-input"
            value={form.event_date}
            onChange={(e) => set('event_date', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Time</label>
          <input
            type="time"
            className="form-input"
            value={form.event_time}
            onChange={(e) => set('event_time', e.target.value)}
          />
        </div>
      </div>

      <div className="modal-row">
        <div className="form-group">
          <label className="form-label">Category <span className="required">*</span></label>
          <select
            className="form-input"
            value={form.category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Subcategory</label>
          {subcategoryOptions ? (
            <SelectWithOther
              options={subcategoryOptions}
              value={form.subcategory}
              onChange={(v) => set('subcategory', v)}
              placeholder="Select…"
            />
          ) : (
            <input
              type="text"
              className="form-input"
              value={form.subcategory}
              onChange={(e) => set('subcategory', e.target.value)}
              placeholder={form.category ? 'Describe subcategory…' : 'Select a category first'}
              disabled={!form.category}
            />
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Chief Complaint <span className="required">*</span></label>
        <textarea
          className="form-input form-textarea"
          rows={2}
          value={form.chief_complaint}
          onChange={(e) => set('chief_complaint', e.target.value)}
          placeholder="What brought the athlete in…"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Treatment Administered</label>
        <textarea
          className="form-input form-textarea"
          rows={2}
          value={form.treatment_administered}
          onChange={(e) => set('treatment_administered', e.target.value)}
          placeholder="Care provided on site…"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Disposition <span className="required">*</span></label>
        <select
          className="form-input"
          value={form.disposition}
          onChange={(e) => set('disposition', e.target.value)}
          required
        >
          <option value="">Select…</option>
          {DISPOSITIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>

      <label className="gm-toggle">
        <input
          type="checkbox"
          checked={form.follow_up_required}
          onChange={(e) => set('follow_up_required', e.target.checked)}
        />
        <span className="gm-toggle-track"><span className="gm-toggle-thumb" /></span>
        <span className="gm-toggle-text">Follow-up required</span>
      </label>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-input form-textarea"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Additional notes…"
        />
      </div>

      <div className="gm-form-actions">
        {isEdit && (
          <button type="button" className="btn btn--ghost" onClick={onCancelEdit} disabled={saving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Event'}
        </button>
      </div>
    </form>
  );
}

function HistoryTab({ events, expandedId, onToggleExpand, onEdit, onDelete }) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');

  const filtered = useMemo(() => events.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (dateFrom && e.event_date < dateFrom) return false;
    if (dateTo && e.event_date > dateTo) return false;
    return true;
  }), [events, categoryFilter, dateFrom, dateTo]);

  const hasFilters = Boolean(categoryFilter || dateFrom || dateTo);

  function clearFilters() {
    setCategoryFilter('');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div className="gm-history">
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="gm-filter-category">Category</label>
          <select
            id="gm-filter-category"
            className="filter-input filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="gm-filter-from">From</label>
          <input id="gm-filter-from" type="date" className="filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="gm-filter-to">To</label>
          <input id="gm-filter-to" type="date" className="filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {hasFilters && (
          <button className="btn btn--ghost filter-clear" onClick={clearFilters}>Clear Filters</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>{events.length === 0 ? 'No general medical events logged yet.' : 'No events match these filters.'}</p>
        </div>
      ) : (
        <div className="gm-list">
          {filtered.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <div key={e.id} id={`gm-event-${e.id}`} className={`gm-card${expanded ? ' gm-card--expanded' : ''}`}>
                <div
                  className="gm-card-header"
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => onToggleExpand(e.id)}
                  onKeyDown={(evt) => {
                    if (evt.key === 'Enter' || evt.key === ' ') {
                      evt.preventDefault();
                      onToggleExpand(e.id);
                    }
                  }}
                >
                  <div className="gm-card-header-main">
                    <Link
                      to={`/athletes/${encodeURIComponent(e.athlete_name)}`}
                      className="gm-athlete-name"
                      onClick={(evt) => evt.stopPropagation()}
                    >
                      {e.athlete_name}
                    </Link>
                    <span className="gm-date">{formatDate(e.event_date)}</span>
                  </div>
                  <div className="gm-card-header-badges">
                    <CategoryBadge category={e.category} />
                    {e.subcategory && <span className="gm-subcategory">{e.subcategory}</span>}
                    <DispositionBadge disposition={e.disposition} />
                    {e.follow_up_required && <span className="gm-followup-flag">Follow-up</span>}
                    <span className="gm-expand-icon" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="gm-card-detail">
                    <div className="gm-detail-row">
                      <span className="gm-detail-label">Chief Complaint</span>
                      <p className="gm-detail-value">{e.chief_complaint}</p>
                    </div>
                    {e.treatment_administered && (
                      <div className="gm-detail-row">
                        <span className="gm-detail-label">Treatment Administered</span>
                        <p className="gm-detail-value">{e.treatment_administered}</p>
                      </div>
                    )}
                    {e.notes && (
                      <div className="gm-detail-row">
                        <span className="gm-detail-label">Notes</span>
                        <p className="gm-detail-value">{e.notes}</p>
                      </div>
                    )}
                    <div className="gm-card-detail-actions">
                      <button className="btn btn--sm btn--ghost" onClick={() => onEdit(e)}>Edit</button>
                      <button className="btn btn--sm btn--danger-ghost" onClick={() => onDelete(e.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GeneralMedical() {
  const [searchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState(
    searchParams.get('tab') === 'history' || searchParams.get('highlight') ? 'history' : 'log'
  );
  const [athletes, setAthletes]         = useState([]);
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedId, setExpandedId]     = useState(searchParams.get('highlight') || null);

  const athleteNames = useMemo(() => athletes.map((a) => a.name), [athletes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, athRes] = await Promise.all([
        api.get('/api/general-medical'),
        api.get('/api/athletes'),
      ]);
      setEvents(evRes.data);
      setAthletes(athRes.data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Scroll a deep-linked event (e.g. from the Today dashboard) into view once loaded
  useEffect(() => {
    if (!expandedId || loading) return;
    document.getElementById(`gm-event-${expandedId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [expandedId, loading]);

  function handleSaved(saved, isEdit) {
    setEvents((prev) => (
      isEdit ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]
    ));
    setEditingEvent(null);
    if (isEdit) {
      setMainTab('history');
      setExpandedId(saved.id);
    }
  }

  function handleEdit(event) {
    setEditingEvent(event);
    setMainTab('log');
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this general medical record?')) return;
    try {
      await api.delete(`/api/general-medical/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setExpandedId((cur) => (cur === id ? null : cur));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  function switchTab(tab) {
    setMainTab(tab);
    if (tab === 'log') setEditingEvent(null);
  }

  return (
    <div className="gm-page">
      <div className="gm-header">
        <h1 className="page-title">General Medical</h1>
        <p className="page-subtitle">
          Log and review non-injury medical events — illness, heat illness, skin conditions, and more.
        </p>
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="gm-tabs">
        <button className={`gm-tab${mainTab === 'log' ? ' active' : ''}`} onClick={() => switchTab('log')}>
          {editingEvent ? 'Edit Entry' : 'Log Entry'}
        </button>
        <button className={`gm-tab${mainTab === 'history' ? ' active' : ''}`} onClick={() => switchTab('history')}>
          History{events.length > 0 ? ` (${events.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      ) : mainTab === 'log' ? (
        <LogEntryTab
          key={editingEvent?.id ?? 'new'}
          event={editingEvent}
          athletes={athletes}
          athleteNames={athleteNames}
          onSaved={handleSaved}
          onCancelEdit={() => switchTab('log')}
        />
      ) : (
        <HistoryTab
          events={events}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
