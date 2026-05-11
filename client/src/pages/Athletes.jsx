import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import SportCombobox from '../components/SportCombobox.jsx';
import './Athletes.css';

function formatDob(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  sport: '',
  grade: '',
  date_of_birth: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

function AddAthleteModal({ onClose, onAdded }) {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(false);

  function set(field, val) {
    setForm((p) => ({ ...p, [field]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.first_name.trim()) { setError('First name is required.'); return; }
    if (!form.last_name.trim())  { setError('Last name is required.'); return; }
    if (!form.sport)             { setError('Sport is required.'); return; }
    if (!form.grade)             { setError('Grade is required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post('/api/athletes', form);
      setSuccess(true);
      onAdded(data);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">Add Athlete</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {success ? (
          <div className="modal-success">
            <span className="modal-success-icon">✓</span>
            <p>{form.first_name} {form.last_name} added to roster!</p>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="form-error">{error}</div>}

            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">First Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  placeholder="First"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  placeholder="Last"
                  required
                />
              </div>
            </div>

            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">Sport <span className="required">*</span></label>
                <SportCombobox value={form.sport} onChange={(v) => set('sport', v)} />
              </div>
              <div className="form-group">
                <label className="form-label">Grade <span className="required">*</span></label>
                <select
                  className="form-input"
                  value={form.grade}
                  onChange={(e) => set('grade', e.target.value)}
                  required
                >
                  <option value="">Select grade…</option>
                  <option value="9th">9th</option>
                  <option value="10th">10th</option>
                  <option value="11th">11th</option>
                  <option value="12th">12th</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={form.date_of_birth}
                onChange={(e) => set('date_of_birth', e.target.value)}
              />
            </div>

            <div className="modal-row">
              <div className="form-group">
                <label className="form-label">Emergency Contact Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.emergency_contact_name}
                  onChange={(e) => set('emergency_contact_name', e.target.value)}
                  placeholder="Parent / Guardian name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.emergency_contact_phone}
                  onChange={(e) => set('emergency_contact_phone', e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add Athlete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ArchiveConfirmDialog({ athlete, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Archive Athlete</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
            <strong>{athlete.name}</strong> has existing records and cannot be permanently deleted.
          </p>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Would you like to archive them instead? Archived athletes are hidden from active lists but their records are preserved.
          </p>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={onConfirm} disabled={loading}>
              {loading ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Athletes() {
  const [athletes, setAthletes]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleting, setDeleting]         = useState(null);
  const [archivePending, setArchivePending] = useState(null); // athlete awaiting archive confirm
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [successMsg, setSuccessMsg]     = useState(null);

  const fetchAthletes = useCallback((includeArchived) => {
    setLoading(true);
    const url = includeArchived ? '/api/athletes?include_archived=true' : '/api/athletes';
    api.get(url)
      .then(({ data }) => setAthletes(data))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load roster.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAthletes(showArchived);
  }, [showArchived, fetchAthletes]);

  function handleAthleteAdded(newAthlete) {
    setAthletes((prev) => [...prev, newAthlete].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDelete(athlete) {
    if (!window.confirm(`Delete ${athlete.name}? If they have no records this is permanent.`)) return;
    setDeleting(athlete.id);
    try {
      const { data } = await api.delete(`/api/athletes/${athlete.id}`);
      if (data.archived) {
        // Server archived instead of deleted — show the explanation dialog
        setDeleting(null);
        setArchivePending(athlete);
        return;
      }
      // Hard deleted
      setAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      showSuccess(`${athlete.name} deleted.`);
    } catch (err) {
      showError(err.response?.data?.error ?? 'Failed to delete athlete.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleArchiveConfirm() {
    const athlete = archivePending;
    setArchiveLoading(true);
    try {
      // The server already archived on the DELETE call — just update local state
      if (!showArchived) {
        setAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      } else {
        setAthletes((prev) =>
          prev.map((a) => a.id === athlete.id ? { ...a, archived: true } : a)
        );
      }
      setArchivePending(null);
      showSuccess(`${athlete.name} archived.`);
    } finally {
      setArchiveLoading(false);
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  function showError(msg) {
    setSuccessMsg({ error: msg });
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  const filtered = athletes.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.sport?.toLowerCase().includes(q) ||
      a.grade?.toLowerCase().includes(q)
    );
  });

  // Group by first letter of name
  const grouped = filtered.reduce((acc, a) => {
    const letter = a.name[0].toUpperCase();
    (acc[letter] = acc[letter] ?? []).push(a);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort();

  const activeCount   = athletes.filter((a) => !a.archived).length;
  const archivedCount = athletes.filter((a) => a.archived).length;

  return (
    <div className="athletes-page">
      <div className="athletes-header">
        <div>
          <h1 className="page-title">Athletes</h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading…'
              : `${activeCount} active${archivedCount > 0 ? ` · ${archivedCount} archived` : ''}`}
          </p>
        </div>
        <div className="athletes-header-actions">
          <button className="btn btn--secondary" onClick={() => setShowModal(true)}>
            + Add Athlete
          </button>
          <Link to="/athletes/import" className="btn btn--primary">
            Import CSV
          </Link>
        </div>
      </div>

      {showModal && (
        <AddAthleteModal
          onClose={() => setShowModal(false)}
          onAdded={handleAthleteAdded}
        />
      )}

      {archivePending && (
        <ArchiveConfirmDialog
          athlete={archivePending}
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchivePending(null)}
          loading={archiveLoading}
        />
      )}

      {successMsg && (
        <div
          style={{
            padding: '0.65rem 1rem',
            marginBottom: '1rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.9rem',
            background: typeof successMsg === 'string' ? '#d1fae5' : '#fdf0ed',
            color: typeof successMsg === 'string' ? '#166534' : '#c0392b',
            border: `1px solid ${typeof successMsg === 'string' ? '#6ee7b7' : 'rgba(192,57,43,0.3)'}`,
          }}
        >
          {typeof successMsg === 'string' ? successMsg : successMsg.error}
        </div>
      )}

      {!loading && !error && athletes.length > 0 && (
        <div className="athletes-controls">
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, sport, or grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="athletes-archived-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
      )}

      {loading && (
        <div className="state-msg">
          <div className="spinner" />
          <span>Loading roster…</span>
        </div>
      )}

      {!loading && error && (
        <div className="state-msg state-msg--error"><p>{error}</p></div>
      )}

      {!loading && !error && athletes.length === 0 && !showArchived && (
        <div className="state-msg state-msg--empty">
          <p>No athletes on the roster yet.</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn--secondary" onClick={() => setShowModal(true)}>+ Add Athlete</button>
            <Link to="/athletes/import" className="btn btn--primary">Import CSV</Link>
          </div>
        </div>
      )}

      {!loading && !error && athletes.length === 0 && showArchived && (
        <div className="state-msg state-msg--empty">
          <p>No archived athletes.</p>
        </div>
      )}

      {!loading && !error && athletes.length > 0 && filtered.length === 0 && (
        <div className="state-msg state-msg--empty">
          <p>No athletes match your search.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Sport</th>
                <th>Grade</th>
                <th>Date of Birth</th>
                <th></th>
              </tr>
            </thead>
            {letters.map((letter) => (
              <tbody key={letter}>
                <tr className="letter-row">
                  <td colSpan={5} className="letter-cell">{letter}</td>
                </tr>
                {grouped[letter].map((a) => (
                  <tr key={a.id} className={`athlete-row${a.archived ? ' athlete-row--archived' : ''}`}>
                    <td>
                      <Link
                        to={`/athletes/${encodeURIComponent(a.name)}`}
                        className="athlete-name-link"
                      >
                        {a.name}
                      </Link>
                      {a.archived && <span className="athlete-archived-badge">Archived</span>}
                    </td>
                    <td>{a.sport ?? <span className="cell-empty">—</span>}</td>
                    <td>{a.grade ?? <span className="cell-empty">—</span>}</td>
                    <td>{formatDob(a.date_of_birth)}</td>
                    <td className="athlete-row-actions">
                      <Link
                        to={`/athletes/${encodeURIComponent(a.name)}`}
                        className="view-link"
                      >
                        Treatment history →
                      </Link>
                      {!a.archived && (
                        <button
                          className="btn-delete-athlete"
                          onClick={() => handleDelete(a)}
                          disabled={deleting === a.id}
                          aria-label={`Delete ${a.name}`}
                        >
                          {deleting === a.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
