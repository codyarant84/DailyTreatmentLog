import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';
import {
  CREDENTIAL_TYPES, credentialTypeMeta, daysUntil, expirationStatus,
} from '../lib/credentials.js';
import { formatDate as formatCredentialDate } from '../lib/dateUtils.js';
import { readFileAsBase64 } from '../lib/files.js';
import { WarningIcon } from '../components/Icons.jsx';
import './Vault.css';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const EMPTY_FORM = {
  credential_type:    '',
  credential_name:    '',
  credential_number:  '',
  issuing_state:      '',
  issued_date:        '',
  expiration_date:    '',
  notes:              '',
};

function CredentialFormModal({ credential, onClose, onSaved }) {
  const isEdit = Boolean(credential);
  const [form, setForm] = useState(
    isEdit
      ? {
          credential_type:   credential.credential_type,
          credential_name:   credential.credential_name   ?? '',
          credential_number: credential.credential_number ?? '',
          issuing_state:     credential.issuing_state      ?? '',
          issued_date:       credential.issued_date        ?? '',
          expiration_date:   credential.expiration_date    ?? '',
          notes:             credential.notes              ?? '',
        }
      : EMPTY_FORM
  );
  const [nameManuallyEdited, setNameManuallyEdited] = useState(isEdit);
  const [pendingFile, setPendingFile] = useState(null); // { base64, file_name, file_type }
  const [fileError, setFileError]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  function set(field, val) { setForm((p) => ({ ...p, [field]: val })); }

  function handleTypeChange(type) {
    setForm((p) => ({
      ...p,
      credential_type: type,
      credential_name: nameManuallyEdited ? p.credential_name : credentialTypeMeta(type).label,
    }));
  }

  function handleNameChange(val) {
    setNameManuallyEdited(true);
    set('credential_name', val);
  }

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
    if (!form.credential_type) { setError('Credential type is required.'); return; }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        credential_name:   form.credential_name.trim()   || null,
        credential_number: form.credential_number.trim() || null,
        issuing_state:     form.issuing_state.trim()     || null,
        issued_date:       form.issued_date              || null,
        expiration_date:   form.expiration_date          || null,
        notes:             form.notes.trim()              || null,
      };

      let saved;
      if (isEdit) {
        const { data } = await api.put(`/api/credentials/${credential.id}`, payload);
        saved = data;
        if (pendingFile) {
          const { data: withFile } = await api.post(`/api/credentials/${credential.id}/upload`, pendingFile);
          saved = withFile;
        }
      } else {
        const { data } = await api.post('/api/credentials', { ...payload, ...(pendingFile ?? {}) });
        saved = data;
      }

      onSaved(saved, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  const showIssuingState = form.credential_type === 'state_licensure';

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Credential' : 'Add Credential'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Credential Type <span className="required">*</span></label>
            <select
              className="form-input"
              value={form.credential_type}
              onChange={(e) => handleTypeChange(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Credential Name</label>
            <input
              type="text"
              className="form-input"
              value={form.credential_name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. BOC Certification"
            />
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Credential / License Number</label>
              <input
                type="text"
                className="form-input"
                value={form.credential_number}
                onChange={(e) => set('credential_number', e.target.value)}
              />
            </div>
            {showIssuingState && (
              <div className="form-group">
                <label className="form-label">Issuing State</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.issuing_state}
                  onChange={(e) => set('issuing_state', e.target.value)}
                  placeholder="e.g. TX"
                />
              </div>
            )}
          </div>

          <div className="modal-row">
            <div className="form-group">
              <label className="form-label">Issue Date</label>
              <input
                type="date"
                className="form-input"
                value={form.issued_date}
                onChange={(e) => set('issued_date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiration Date</label>
              <input
                type="date"
                className="form-input"
                value={form.expiration_date}
                onChange={(e) => set('expiration_date', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input form-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Document (PDF, JPG, PNG)</label>
            <input
              type="file"
              className="form-input"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            {fileError && <p className="vault-file-error">{fileError}</p>}
            {pendingFile && <p className="vault-file-selected">Selected: {pendingFile.file_name}</p>}
            {isEdit && credential.file_name && !pendingFile && (
              <p className="vault-file-selected">Current file: {credential.file_name}</p>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CredentialCard({ credential, onEdit, onDelete }) {
  const meta = credentialTypeMeta(credential.credential_type);
  const status = expirationStatus(credential.expiration_date);
  const days = daysUntil(credential.expiration_date);

  async function handleDelete() {
    if (!confirm('Permanently delete this credential?')) return;
    try {
      await api.delete(`/api/credentials/${credential.id}`);
      onDelete(credential.id);
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  return (
    <div className="vault-card">
      <div className="vault-card-header">
        <span className="vault-card-name">{credential.credential_name || meta.label}</span>
      </div>

      {credential.credential_number && (
        <p className="vault-card-number">{credential.credential_number}</p>
      )}

      <div className="vault-card-exp" style={{ background: status.bg, color: status.color, borderColor: status.border }}>
        {!credential.expiration_date
          ? 'No expiration'
          : days === null
            ? 'Invalid expiration date'
            : `${days < 0 ? 'Expired' : 'Expires'} ${formatCredentialDate(credential.expiration_date)} (${days}d)`}
      </div>

      {credential.file_name && (
        <div className="vault-card-file">{credential.file_name}</div>
      )}

      <div className="vault-card-actions">
        {credential.file_url && (
          <a href={credential.file_url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--outline">
            Download
          </a>
        )}
        <button className="btn btn--sm btn--ghost" onClick={() => onEdit(credential)}>Edit</button>
        <button className="btn btn--sm btn--danger-ghost" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}

export default function Vault() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/credentials');
      setCredentials(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    setCredentials((prev) => (
      isEdit ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]
    ));
  }

  function handleDelete(id) {
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }

  const expiringSoon = credentials
    .filter((c) => daysUntil(c.expiration_date) !== null && daysUntil(c.expiration_date) <= 60)
    .sort((a, b) => daysUntil(a.expiration_date) - daysUntil(b.expiration_date));

  const grouped = CREDENTIAL_TYPES
    .map((t) => ({ type: t, items: credentials.filter((c) => c.credential_type === t.key) }))
    .filter((g) => g.items.length > 0);

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>;

  return (
    <div className="vault-page">
      <div className="vault-header">
        <div>
          <h1 className="page-title">Document Vault</h1>
          <p className="page-subtitle">Your certifications, licenses, and credential documents in one place.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>+ Add Credential</button>
      </div>

      {error && <div className="page-error">{error}</div>}

      {expiringSoon.length > 0 && (
        <div className="vault-banner">
          <div className="vault-banner-title"><WarningIcon /> Expiring Soon</div>
          <ul className="vault-banner-list">
            {expiringSoon.map((c) => {
              const days = daysUntil(c.expiration_date);
              const meta = credentialTypeMeta(c.credential_type);
              return (
                <li key={c.id}>
                  <span className="vault-banner-name">{c.credential_name || meta.label}</span>
                  <span className="vault-banner-days">
                    {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days} day${days !== 1 ? 's' : ''} left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="state-msg state-msg--empty">
          <p>No credentials on file yet.</p>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>Add Your First Credential</button>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.type.key} className="vault-group">
            <h2 className="vault-group-title">{g.type.label}</h2>
            <div className="vault-grid">
              {g.items.map((c) => (
                <CredentialCard
                  key={c.id}
                  credential={c}
                  onEdit={setEditTarget}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {(showModal || editTarget) && (
        <CredentialFormModal
          credential={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
