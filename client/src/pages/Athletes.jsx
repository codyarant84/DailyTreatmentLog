import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import SportCombobox from '../components/SportCombobox.jsx';
import { formatDate as formatDob } from '../lib/dateUtils.js';
import { WarningIcon } from '../components/Icons.jsx';
import './Athletes.css';

function riskFlagsTooltip(flags) {
  return flags.map((f) => `${f.label}: ${f.description}`).join('\n');
}

// archived_at is a timestamptz, not a date-only column — format it directly
// rather than through dateUtils' date-only parseLocalDate/formatDate.
function formatArchivedAt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ARCHIVE_REASON_LABELS = {
  graduated: 'Graduated',
};
function archiveReasonLabel(reason) {
  return ARCHIVE_REASON_LABELS[reason] ?? 'Manually Archived';
}

const HS_GRADES = ['6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const COLLEGE_GRADES = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6+'];

// Returns the grade dropdown options for an organization type, or null if
// the grade field should be hidden entirely (semi_pro / club).
function gradeOptionsFor(orgType) {
  if (orgType === 'college') return COLLEGE_GRADES;
  if (orgType === 'semi_pro' || orgType === 'club') return null;
  return HS_GRADES;
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

function AddAthleteModal({ orgType, onClose, onAdded }) {
  const gradeOptions = gradeOptionsFor(orgType);
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
    if (gradeOptions && !form.grade) { setError('Grade is required.'); return; }

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
              {gradeOptions && (
                <div className="form-group">
                  <label className="form-label">{orgType === 'college' ? 'Year' : 'Grade'} <span className="required">*</span></label>
                  <select
                    className="form-input"
                    value={form.grade}
                    onChange={(e) => set('grade', e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
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

function EditAthleteModal({ athlete, orgType, onClose, onSaved }) {
  const gradeOptions = gradeOptionsFor(orgType);
  const [sport, setSport]       = useState(athlete.sport ?? '');
  const [grade, setGrade]       = useState(athlete.grade ?? '');
  const [dob, setDob]           = useState(athlete.date_of_birth ? athlete.date_of_birth.split('T')[0] : '');
  const [ecName, setEcName]     = useState(athlete.emergency_contact_name ?? '');
  const [ecPhone, setEcPhone]   = useState(athlete.emergency_contact_phone ?? '');
  const [eligibilityOverride, setEligibilityOverride] = useState(!!athlete.eligibility_override);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.put(`/api/athletes/${athlete.id}`, {
        sport,
        grade: gradeOptions ? grade : null,
        date_of_birth: dob || null,
        emergency_contact_name: ecName,
        emergency_contact_phone: ecPhone,
        eligibility_override: orgType === 'college' ? eligibilityOverride : undefined,
      });
      onSaved({ ...athlete, ...data });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        <div className="modal-header">
          <h2 id="edit-modal-title" className="modal-title">Edit {athlete.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Sport</label>
              <SportCombobox value={sport} onChange={setSport} />
            </div>
            {gradeOptions && (
              <div className="form-group">
                <label className="form-label">{orgType === 'college' ? 'Year' : 'Grade'}</label>
                <select className="form-input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="">Select…</option>
                  {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input type="date" className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input type="text" className="form-input" value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Parent / Guardian name" />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Contact Phone</label>
              <input type="tel" className="form-input" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>

          {orgType === 'college' && (
            <label className="eligibility-override-toggle">
              <input
                type="checkbox"
                checked={eligibilityOverride}
                onChange={(e) => setEligibilityOverride(e.target.checked)}
              />
              <span>
                Eligibility Override
                <span className="eligibility-override-hint">
                  Redshirt / Graduate Transfer / Medical Hardship — keep on roster beyond standard years
                </span>
              </span>
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
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

function PermanentDeleteConfirmDialog({ athlete, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Permanently Delete Athlete</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
            This will permanently delete <strong>{athlete.name}</strong> and all associated records —
            injuries, treatments, concussion cases, general medical, and more. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn--danger-ghost" onClick={onConfirm} disabled={loading}>
              {loading ? 'Deleting…' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const RETENTION_MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export default function Athletes() {
  const { branding } = useAuth();
  const orgType = branding?.organizationType ?? 'high_school';
  const retentionYears = branding?.archiveRetentionYears ?? 3;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'archived' ? 'archived' : searchParams.get('tab') === 'all' ? 'all' : 'active';
  const [tab, setTab] = useState(initialTab);

  const [athletes, setAthletes]         = useState([]);
  const [archivedAthletes, setArchivedAthletes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editingAthlete, setEditingAthlete] = useState(null);
  const [deleting, setDeleting]         = useState(null);
  const [archivePending, setArchivePending] = useState(null); // athlete awaiting archive confirm
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [unarchiving, setUnarchiving]   = useState(null);
  const [deletePending, setDeletePending] = useState(null); // athlete awaiting permanent-delete confirm
  const [permDeleting, setPermDeleting] = useState(false);
  const [successMsg, setSuccessMsg]     = useState(null);
  const [riskFlagsById, setRiskFlagsById] = useState({});

  function selectTab(next) {
    setTab(next);
    setSearchParams(next === 'active' ? {} : { tab: next });
  }

  const fetchAthletes = useCallback((currentTab) => {
    setLoading(true);
    setError(null);
    if (currentTab === 'archived') {
      api.get('/api/athletes/archived')
        .then(({ data }) => setArchivedAthletes(data))
        .catch((err) => setError(err.response?.data?.error ?? 'Failed to load archived athletes.'))
        .finally(() => setLoading(false));
    } else {
      const url = currentTab === 'all' ? '/api/athletes?include_archived=true' : '/api/athletes';
      api.get(url)
        .then(({ data }) => setAthletes(data))
        .catch((err) => setError(err.response?.data?.error ?? 'Failed to load roster.'))
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    fetchAthletes(tab);
  }, [tab, fetchAthletes]);

  useEffect(() => {
    api.get('/api/athletes/high-risk')
      .then(({ data }) => {
        setRiskFlagsById(Object.fromEntries(data.map((a) => [a.id, a.flags])));
      })
      .catch(() => {});
  }, []);

  function handleAthleteAdded(newAthlete) {
    setAthletes((prev) => [...prev, newAthlete].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleAthleteSaved(updated) {
    setAthletes((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a));
    showSuccess(`${updated.name} updated.`);
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
      setAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      setArchivePending(null);
      showSuccess(`${athlete.name} archived.`);
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleUnarchive(athlete) {
    setUnarchiving(athlete.id);
    try {
      await api.post(`/api/athletes/${athlete.id}/unarchive`);
      setArchivedAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      showSuccess(`${athlete.name} unarchived.`);
    } catch (err) {
      showError(err.response?.data?.error ?? 'Failed to unarchive athlete.');
    } finally {
      setUnarchiving(null);
    }
  }

  async function handlePermanentDeleteConfirm() {
    const athlete = deletePending;
    setPermDeleting(true);
    try {
      await api.delete(`/api/athletes/${athlete.id}/permanent`, { data: { confirm: true } });
      setArchivedAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
      setDeletePending(null);
      showSuccess(`${athlete.name} permanently deleted.`);
    } catch (err) {
      showError(err.response?.data?.error ?? 'Failed to permanently delete athlete.');
    } finally {
      setPermDeleting(false);
    }
  }

  function isEligibleForDeletion(archivedAt) {
    if (retentionYears == null || !archivedAt) return false;
    return Date.now() - new Date(archivedAt).getTime() > retentionYears * RETENTION_MS_PER_YEAR;
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  function showError(msg) {
    setSuccessMsg({ error: msg });
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  const activeList = tab === 'archived' ? archivedAthletes : athletes;
  const filtered = activeList.filter((a) => {
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

  return (
    <div className="athletes-page">
      <div className="athletes-header">
        <div>
          <h1 className="page-title">Athletes</h1>
          <p className="page-subtitle">
            {tab === 'active' && 'Active roster'}
            {tab === 'archived' && 'Archived athletes'}
            {tab === 'all' && 'Active and archived athletes'}
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

      <div className="athletes-tabs">
        <button className={`athletes-tab${tab === 'active' ? ' athletes-tab--active' : ''}`} onClick={() => selectTab('active')}>
          Active
        </button>
        <button className={`athletes-tab${tab === 'archived' ? ' athletes-tab--active' : ''}`} onClick={() => selectTab('archived')}>
          Archived
        </button>
        <button className={`athletes-tab${tab === 'all' ? ' athletes-tab--active' : ''}`} onClick={() => selectTab('all')}>
          All
        </button>
      </div>

      {showModal && (
        <AddAthleteModal
          orgType={orgType}
          onClose={() => setShowModal(false)}
          onAdded={handleAthleteAdded}
        />
      )}

      {editingAthlete && (
        <EditAthleteModal
          athlete={editingAthlete}
          orgType={orgType}
          onClose={() => setEditingAthlete(null)}
          onSaved={handleAthleteSaved}
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

      {deletePending && (
        <PermanentDeleteConfirmDialog
          athlete={deletePending}
          onConfirm={handlePermanentDeleteConfirm}
          onCancel={() => setDeletePending(null)}
          loading={permDeleting}
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

      {!loading && !error && activeList.length > 0 && (
        <div className="athletes-controls">
          <input
            type="search"
            className="search-input"
            placeholder="Search by name, sport, or grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading && (
        <div className="state-msg">
          <div className="spinner" />
          <span>Loading…</span>
        </div>
      )}

      {!loading && error && (
        <div className="state-msg state-msg--error"><p>{error}</p></div>
      )}

      {!loading && !error && activeList.length === 0 && tab === 'active' && (
        <div className="state-msg state-msg--empty">
          <p>No athletes on the roster yet.</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn--secondary" onClick={() => setShowModal(true)}>+ Add Athlete</button>
            <Link to="/athletes/import" className="btn btn--primary">Import CSV</Link>
          </div>
        </div>
      )}

      {!loading && !error && activeList.length === 0 && tab !== 'active' && (
        <div className="state-msg state-msg--empty">
          <p>No archived athletes.</p>
        </div>
      )}

      {!loading && !error && activeList.length > 0 && filtered.length === 0 && (
        <div className="state-msg state-msg--empty">
          <p>No athletes match your search.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && tab === 'archived' && (
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Sport</th>
                <th>Grade/Year at Archive</th>
                <th>Archive Date</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            {letters.map((letter) => (
              <tbody key={letter}>
                <tr className="letter-row">
                  <td colSpan={6} className="letter-cell">{letter}</td>
                </tr>
                {grouped[letter].map((a) => (
                  <tr key={a.id} className="athlete-row athlete-row--archived">
                    <td>{a.name}</td>
                    <td>{a.sport ?? <span className="cell-empty">—</span>}</td>
                    <td>{a.grade ?? <span className="cell-empty">—</span>}</td>
                    <td>{formatArchivedAt(a.archived_at)}</td>
                    <td>{archiveReasonLabel(a.archived_reason)}</td>
                    <td className="athlete-row-actions">
                      <button
                        className="btn btn--sm btn--outline"
                        onClick={() => handleUnarchive(a)}
                        disabled={unarchiving === a.id}
                      >
                        {unarchiving === a.id ? '…' : 'Unarchive'}
                      </button>
                      {isEligibleForDeletion(a.archived_at) && (
                        <button
                          className="btn-delete-athlete"
                          onClick={() => setDeletePending(a)}
                          aria-label={`Permanently delete ${a.name}`}
                        >
                          Permanently Delete
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

      {!loading && !error && filtered.length > 0 && tab !== 'archived' && (
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Sport</th>
                <th>{orgType === 'college' ? 'Year' : 'Grade'}</th>
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
                      {riskFlagsById[a.id]?.length > 0 && (
                        <span
                          className="risk-flag-icon"
                          title={riskFlagsTooltip(riskFlagsById[a.id])}
                          aria-label={`${riskFlagsById[a.id].length} active risk flag${riskFlagsById[a.id].length !== 1 ? 's' : ''}`}
                        >
                          <WarningIcon />
                        </span>
                      )}
                      {a.archived && <span className="athlete-archived-badge">Archived</span>}
                      {a.eligibility_override && <span className="athlete-archived-badge">Eligibility Override</span>}
                      {a.top_flag_severity && (
                        <span
                          className={`flag-badge flag-badge--${a.top_flag_severity}`}
                          title={`${a.flag_count} flag${a.flag_count !== 1 ? 's' : ''} · highest: ${a.top_flag_severity}`}
                        >
                          {a.flag_count}
                        </span>
                      )}
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
                        <>
                          <button className="btn btn--sm btn--outline" onClick={() => setEditingAthlete(a)}>
                            Edit
                          </button>
                          <button
                            className="btn-delete-athlete"
                            onClick={() => handleDelete(a)}
                            disabled={deleting === a.id}
                            aria-label={`Delete ${a.name}`}
                          >
                            {deleting === a.id ? '…' : 'Delete'}
                          </button>
                        </>
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
