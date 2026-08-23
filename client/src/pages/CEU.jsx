import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../lib/dateUtils.js';
import { readFileAsBase64 } from '../lib/files.js';
import './CEU.css';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const STATUS_LABEL = {
  on_track: 'On track',
  behind:   'Behind pace',
  critical: 'Critically behind',
};

function hoursLabel(n) {
  const num = Number(n);
  return `${num} hr${num !== 1 ? 's' : ''}`;
}

// ── Progress ring ────────────────────────────────────────────────────
function ProgressRing({ pct, status }) {
  const size = 140, stroke = 12, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, pct)));
  const color = status === 'on_track' ? '#27ae60' : status === 'behind' ? '#f59e0b' : status === 'critical' ? '#c0392b' : '#9ca3af';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ceu-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  );
}

// ── CEU card ─────────────────────────────────────────────────────────
function CeuCard({ ceu, onMarkComplete }) {
  return (
    <div className="ceu-card">
      <div className="ceu-card-header">
        <span className="ceu-card-title">{ceu.title}</span>
        <span className="ceu-card-provider">{ceu.provider}</span>
      </div>

      <div className="ceu-card-badges">
        <span className="ceu-badge ceu-badge--hours">{hoursLabel(ceu.credit_hours)}</span>
        {ceu.is_free ? (
          <span className="ceu-badge ceu-badge--free">Free</span>
        ) : (
          <span className="ceu-badge ceu-badge--cost">${Number(ceu.cost ?? 0).toFixed(2)}</span>
        )}
        {ceu.expiration_date && (
          <span className="ceu-badge ceu-badge--exp">Expires {formatDate(ceu.expiration_date)}</span>
        )}
      </div>

      {ceu.description && <p className="ceu-card-desc">{ceu.description}</p>}

      <div className="ceu-card-actions">
        <a href={ceu.url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--outline">
          View →
        </a>
        <button className="btn btn--sm btn--primary" onClick={() => onMarkComplete(ceu)}>
          Mark Complete
        </button>
      </div>
    </div>
  );
}

// ── Pending submissions list (used in both the Library banner and the Pending tab) ──
function PendingList({ items, onApprove, onDelete }) {
  if (items.length === 0) {
    return <p className="ceu-pending-empty">No submissions awaiting approval.</p>;
  }
  return (
    <div className="ceu-pending-list">
      {items.map((c) => (
        <div key={c.id} className="ceu-pending-card">
          <div className="ceu-pending-main">
            <span className="ceu-pending-title">{c.title}</span>
            <span className="ceu-pending-meta">
              {c.provider} · {hoursLabel(c.credit_hours)}
              {c.submitted_by_email ? ` · submitted by ${c.submitted_by_email}` : ''}
            </span>
            {c.description && <p className="ceu-pending-desc">{c.description}</p>}
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="ceu-pending-link">{c.url}</a>
          </div>
          <div className="ceu-pending-actions">
            <button className="btn btn--sm btn--primary" onClick={() => onApprove(c.id)}>Approve</button>
            <button className="btn btn--sm btn--danger-ghost" onClick={() => onDelete(c.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AI discovery modal ───────────────────────────────────────────────
function DiscoverModal({ onClose, onAddSuggestion }) {
  const [loading, setLoading]         = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError]             = useState(null);

  useEffect(() => {
    api.post('/api/ceu/discover')
      .then(({ data }) => setSuggestions(data.suggestions ?? []))
      .catch((err) => setError(err.response?.data?.error ?? err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ceu-discover-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Discover CEUs with AI</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ceu-discover-body">
          {loading && (
            <div className="state-msg">
              <div className="spinner" />
              <span>Searching the web for free CEU opportunities…</span>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          {!loading && !error && suggestions.length === 0 && (
            <p className="ceu-discover-empty">No suggestions found. Try again in a bit.</p>
          )}
          {!loading && suggestions.length > 0 && (
            <div className="ceu-suggestion-list">
              {suggestions.map((s, i) => (
                <div key={i} className="ceu-suggestion-card">
                  <div className="ceu-suggestion-main">
                    <span className="ceu-suggestion-title">{s.title}</span>
                    <span className="ceu-suggestion-provider">
                      {s.provider}{s.credit_hours ? ` · ${hoursLabel(s.credit_hours)}` : ''}
                    </span>
                    {s.description && <p className="ceu-suggestion-desc">{s.description}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="ceu-suggestion-link">
                        {s.url}
                      </a>
                    )}
                  </div>
                  <button className="btn btn--sm btn--primary" onClick={() => onAddSuggestion(s)}>
                    Add to Library
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Submit-a-CEU modal ───────────────────────────────────────────────
function emptySubmitForm(prefill) {
  return {
    title:            prefill?.title ?? '',
    provider:         prefill?.provider ?? '',
    credit_hours:     prefill?.credit_hours != null ? String(prefill.credit_hours) : '',
    url:              prefill?.url ?? '',
    description:      prefill?.description ?? '',
    is_free:          prefill?.is_free ?? true,
    cost:             prefill?.cost != null ? String(prefill.cost) : '',
    expiration_date:  prefill?.expiration_date ?? '',
  };
}

function SubmitCeuModal({ prefill, onClose, onSubmitted }) {
  const [form, setForm]   = useState(() => emptySubmitForm(prefill));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.provider.trim() || !form.credit_hours || !form.url.trim()) {
      setError('Title, provider, credit hours, and URL are required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post('/api/ceu/library', {
        title:            form.title.trim(),
        provider:         form.provider.trim(),
        credit_hours:     Number(form.credit_hours),
        url:              form.url.trim(),
        description:      form.description.trim() || null,
        is_free:          form.is_free,
        cost:             form.is_free ? null : (form.cost ? Number(form.cost) : null),
        expiration_date:  form.expiration_date || null,
      });
      onSubmitted(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Submit a CEU</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Title <span className="required">*</span></label>
            <input type="text" className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Provider <span className="required">*</span></label>
              <input type="text" className="form-input" value={form.provider} onChange={(e) => set('provider', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Credit Hours <span className="required">*</span></label>
              <input type="number" step="0.1" min="0" className="form-input" value={form.credit_hours} onChange={(e) => set('credit_hours', e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">URL <span className="required">*</span></label>
            <input type="url" className="form-input" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input form-textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Cost</label>
              <div className="ceu-cost-row">
                <label className="ceu-free-toggle">
                  <input type="checkbox" checked={form.is_free} onChange={(e) => set('is_free', e.target.checked)} />
                  Free
                </label>
                {!form.is_free && (
                  <input
                    type="number" step="0.01" min="0" className="form-input"
                    placeholder="Cost ($)" value={form.cost} onChange={(e) => set('cost', e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Expiration Date</label>
              <input type="date" className="form-input" value={form.expiration_date} onChange={(e) => set('expiration_date', e.target.value)} />
            </div>
          </div>

          <p className="ceu-submit-note">Submitted CEUs are reviewed before appearing in the library.</p>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Mark complete / log external CEU modal ──────────────────────────
function CompletionModal({ ceu, onClose, onLogged }) {
  const isFromLibrary = Boolean(ceu);
  const [form, setForm] = useState({
    title:           ceu?.title ?? '',
    provider:        ceu?.provider ?? '',
    credit_hours:    ceu?.credit_hours != null ? String(ceu.credit_hours) : '',
    completed_date:  new Date().toISOString().split('T')[0],
    notes:           '',
  });
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setFileError('File must be under 10 MB.'); return; }
    setFileError(null);
    try {
      const base64 = await readFileAsBase64(file);
      setPendingFile({ base64, file_name: file.name, file_type: file.type });
    } catch {
      setFileError('Could not read that file.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.credit_hours || !form.completed_date) {
      setError('Title, credit hours, and completed date are required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post('/api/ceu/completions', {
        ceu_id:         ceu?.id ?? null,
        title:          form.title.trim(),
        provider:       form.provider.trim() || null,
        credit_hours:   Number(form.credit_hours),
        completed_date: form.completed_date,
        notes:          form.notes.trim() || null,
      });

      let saved = data;
      if (pendingFile) {
        const { data: withFile } = await api.post(`/api/ceu/completions/${data.id}/upload`, pendingFile);
        saved = withFile;
      }

      onLogged(saved);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{isFromLibrary ? 'Mark Complete' : 'Log External CEU'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          {isFromLibrary ? (
            <div className="ceu-locked-summary">
              <strong>{form.title}</strong>
              <span>{form.provider} · {hoursLabel(form.credit_hours)}</span>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Title <span className="required">*</span></label>
                <input type="text" className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <input type="text" className="form-input" value={form.provider} onChange={(e) => set('provider', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Hours <span className="required">*</span></label>
                  <input type="number" step="0.1" min="0" className="form-input" value={form.credit_hours} onChange={(e) => set('credit_hours', e.target.value)} required />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Completion Date <span className="required">*</span></label>
            <input type="date" className="form-input" value={form.completed_date} onChange={(e) => set('completed_date', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Certificate (PDF, JPG, PNG)</label>
            <input type="file" className="form-input" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
            {fileError && <p className="vault-file-error">{fileError}</p>}
            {pendingFile && <p className="vault-file-selected">Selected: {pendingFile.file_name}</p>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Log Completion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── My Progress tab ──────────────────────────────────────────────────
function ProgressTab({ progress, completions, onDeleteCompletion, onLogExternal }) {
  return (
    <div className="ceu-progress-tab">
      <div className="ceu-boc-card">
        {!progress ? (
          <div className="ceu-ring-loading"><div className="spinner" /></div>
        ) : progress.has_boc_credential ? (
          <>
            <div className="ceu-ring-wrap">
              <ProgressRing pct={progress.hours_completed / progress.hours_required} status={progress.status} />
              <div className="ceu-ring-label">
                <span className="ceu-ring-value">{progress.hours_completed}</span>
                <span className="ceu-ring-total">/ {progress.hours_required} hrs</span>
              </div>
            </div>
            <div className="ceu-boc-details">
              <span className={`ceu-boc-status ceu-boc-status--${progress.status}`}>
                {STATUS_LABEL[progress.status]}
              </span>
              <p className="ceu-boc-period">
                Certification period: {formatDate(progress.period_start)} – {formatDate(progress.period_end)}
              </p>
              <p className="ceu-boc-remaining">{progress.hours_remaining} hours remaining</p>
            </div>
          </>
        ) : (
          <div className="ceu-boc-missing">
            <p>
              No BOC credential on file. Add your BOC certification in the{' '}
              <Link to="/vault">Document Vault</Link> to track recertification progress.
            </p>
            <p className="ceu-boc-alltime">{progress.hours_completed} hours logged all-time.</p>
          </div>
        )}
      </div>

      <div className="ceu-completions-header">
        <h2 className="ceu-section-title">Completed CEUs</h2>
        <button className="btn btn--sm btn--primary" onClick={onLogExternal}>+ Log External CEU</button>
      </div>

      {completions.length === 0 ? (
        <div className="state-msg state-msg--empty"><p>No CEUs logged yet.</p></div>
      ) : (
        <div className="ceu-completion-list">
          {completions.map((c) => (
            <div key={c.id} className="ceu-completion-row">
              <div className="ceu-completion-main">
                <span className="ceu-completion-title">{c.title}</span>
                <span className="ceu-completion-meta">
                  {c.provider ? `${c.provider} · ` : ''}{hoursLabel(c.credit_hours)} · {formatDate(c.completed_date)}
                </span>
              </div>
              <div className="ceu-completion-actions">
                {c.certificate_url && (
                  <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--outline">
                    Certificate
                  </a>
                )}
                <button className="btn btn--sm btn--danger-ghost" onClick={() => onDeleteCompletion(c.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function CEU() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [mainTab, setMainTab] = useState('library');

  const [library, setLibrary]               = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError]     = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState(null); // null = not searching

  const [pending, setPending] = useState([]);

  const [completions, setCompletions] = useState([]);
  const [progress, setProgress]       = useState(null);

  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal]     = useState(false);
  const [submitPrefill, setSubmitPrefill]         = useState(null);
  const [completingCeu, setCompletingCeu]         = useState(); // undefined = closed, null = external, object = from library

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const { data } = await api.get('/api/ceu/library');
      setLibrary(data);
    } catch (err) {
      setLibraryError(err.response?.data?.error ?? err.message);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const { data } = await api.get('/api/ceu/library/pending');
      setPending(data);
    } catch {
      // silent — pending list is a secondary panel
    }
  }, [isSuperAdmin]);

  const loadCompletions = useCallback(async () => {
    try {
      const { data } = await api.get('/api/ceu/completions');
      setCompletions(data);
    } catch {
      // silent
    }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const { data } = await api.get('/api/ceu/progress');
      setProgress(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadLibrary();
    loadPending();
    loadCompletions();
    loadProgress();
  }, [loadLibrary, loadPending, loadCompletions, loadProgress]);

  // Debounced library search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const handle = setTimeout(() => {
      api.get(`/api/ceu/library/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(({ data }) => setSearchResults(data))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const displayedLibrary = searchResults ?? library;

  function handleAddSuggestion(suggestion) {
    setSubmitPrefill(suggestion);
    setShowDiscoverModal(false);
    setShowSubmitModal(true);
  }

  function handleSubmitted(saved) {
    if (isSuperAdmin) setPending((prev) => [saved, ...prev]);
  }

  async function handleApprove(id) {
    try {
      const { data } = await api.post(`/api/ceu/library/${id}/approve`);
      setPending((prev) => prev.filter((c) => c.id !== id));
      setLibrary((prev) => [data, ...prev]);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  async function handleDeletePending(id) {
    if (!confirm('Delete this submission?')) return;
    try {
      await api.delete(`/api/ceu/library/${id}`);
      setPending((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  function handleLogged(saved) {
    setCompletions((prev) => [saved, ...prev]);
    loadProgress();
    setCompletingCeu(undefined);
  }

  async function handleDeleteCompletion(id) {
    if (!confirm('Delete this completion record?')) return;
    try {
      await api.delete(`/api/ceu/completions/${id}`);
      setCompletions((prev) => prev.filter((c) => c.id !== id));
      loadProgress();
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  const tabs = [
    { key: 'library',  label: 'Library' },
    { key: 'progress', label: 'My Progress' },
    ...(isSuperAdmin ? [{ key: 'pending', label: `Pending Approval${pending.length ? ` (${pending.length})` : ''}` }] : []),
  ];

  return (
    <div className="ceu-page">
      <div className="ceu-header">
        <h1 className="page-title">CEU Library</h1>
        <p className="page-subtitle">
          Free continuing education for athletic trainers, with personal tracking toward BOC recertification.
        </p>
      </div>

      <div className="ceu-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`ceu-tab${mainTab === t.key ? ' active' : ''}`}
            onClick={() => setMainTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'library' && (
        <div className="ceu-library-tab">
          {isSuperAdmin && pending.length > 0 && (
            <div className="ceu-awaiting-section">
              <h2 className="ceu-section-title">Awaiting Approval ({pending.length})</h2>
              <PendingList items={pending} onApprove={handleApprove} onDelete={handleDeletePending} />
            </div>
          )}

          <div className="ceu-library-toolbar">
            <input
              type="text"
              className="form-input ceu-search-input"
              placeholder="Search by title or provider…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="ceu-toolbar-actions">
              <button className="btn btn--outline" onClick={() => setShowDiscoverModal(true)}>
                ✨ Discover CEUs with AI
              </button>
              <button className="btn btn--primary" onClick={() => { setSubmitPrefill(null); setShowSubmitModal(true); }}>
                + Submit a CEU
              </button>
            </div>
          </div>

          {libraryError && <div className="page-error">{libraryError}</div>}

          {libraryLoading ? (
            <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
          ) : displayedLibrary.length === 0 ? (
            <div className="state-msg state-msg--empty">
              <p>{searchResults ? 'No CEUs match your search.' : 'No CEUs in the library yet.'}</p>
            </div>
          ) : (
            <div className="ceu-grid">
              {displayedLibrary.map((ceu) => (
                <CeuCard key={ceu.id} ceu={ceu} onMarkComplete={setCompletingCeu} />
              ))}
            </div>
          )}
        </div>
      )}

      {mainTab === 'progress' && (
        <ProgressTab
          progress={progress}
          completions={completions}
          onDeleteCompletion={handleDeleteCompletion}
          onLogExternal={() => setCompletingCeu(null)}
        />
      )}

      {mainTab === 'pending' && isSuperAdmin && (
        <div className="ceu-pending-tab">
          <PendingList items={pending} onApprove={handleApprove} onDelete={handleDeletePending} />
        </div>
      )}

      {showDiscoverModal && (
        <DiscoverModal onClose={() => setShowDiscoverModal(false)} onAddSuggestion={handleAddSuggestion} />
      )}

      {showSubmitModal && (
        <SubmitCeuModal
          prefill={submitPrefill}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={handleSubmitted}
        />
      )}

      {completingCeu !== undefined && (
        <CompletionModal
          ceu={completingCeu}
          onClose={() => setCompletingCeu(undefined)}
          onLogged={handleLogged}
        />
      )}
    </div>
  );
}
