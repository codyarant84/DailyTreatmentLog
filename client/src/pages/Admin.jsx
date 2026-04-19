import { useState, useEffect, useRef } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Admin.css';

const BLANK_SCHOOL = { name: '', primary_color: '#cc0000', cost_per_visit: 50, logoFile: null };

export default function Admin() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track generated invite links: schoolId → url string
  const [inviteLinks, setInviteLinks] = useState({});
  const [inviteGenerating, setInviteGenerating] = useState({});
  const [inviteRoles, setInviteRoles] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Track which schools are expanded
  const [expanded, setExpanded] = useState({});
  const [actionError, setActionError] = useState(null);

  // Add new school form
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchool, setNewSchool] = useState(BLANK_SCHOOL);
  const [addingSchool, setAddingSchool] = useState(false);
  const [addSchoolError, setAddSchoolError] = useState(null);
  const newLogoRef = useRef(null);

  // Per-school inline edit state: schoolId → { color, saving, error } | null
  const [editingColor, setEditingColor] = useState({});
  // Per-school logo upload: schoolId → { uploading, error } | null
  const [editingLogo, setEditingLogo] = useState({});
  const logoRefs = useRef({});

  useEffect(() => { loadSchools(); }, []);

  async function loadSchools() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/schools');
      setSchools(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Add new school ──────────────────────────────────────────────────

  async function handleCreateSchool(e) {
    e.preventDefault();
    setAddSchoolError(null);
    if (!newSchool.name.trim()) { setAddSchoolError('School name is required.'); return; }
    setAddingSchool(true);
    try {
      const { data } = await api.post('/api/admin/schools', {
        name: newSchool.name.trim(),
        primary_color: newSchool.primary_color,
        cost_per_visit: Number(newSchool.cost_per_visit),
      });

      if (newSchool.logoFile) {
        await uploadLogoForSchool(data.id, newSchool.logoFile);
      }

      setNewSchool(BLANK_SCHOOL);
      setShowAddSchool(false);
      await loadSchools();
    } catch (err) {
      setAddSchoolError(err.response?.data?.error ?? err.message);
    } finally {
      setAddingSchool(false);
    }
  }

  // ── Per-school branding edit ────────────────────────────────────────

  function startEditColor(school) {
    setEditingColor((prev) => ({ ...prev, [school.id]: { color: school.primary_color ?? '#cc0000', saving: false, error: null } }));
  }

  async function handleSaveColor(schoolId) {
    const state = editingColor[schoolId];
    if (!state) return;
    setEditingColor((prev) => ({ ...prev, [schoolId]: { ...state, saving: true, error: null } }));
    try {
      await api.put(`/api/admin/schools/${schoolId}/branding`, { primary_color: state.color });
      setEditingColor((prev) => { const n = { ...prev }; delete n[schoolId]; return n; });
      await loadSchools();
    } catch (err) {
      setEditingColor((prev) => ({ ...prev, [schoolId]: { ...state, saving: false, error: err.response?.data?.error ?? err.message } }));
    }
  }

  // ── Per-school logo upload ──────────────────────────────────────────

  async function uploadLogoForSchool(schoolId, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api.post(`/api/admin/schools/${schoolId}/logo`, {
            base64: reader.result,
            mime_type: file.type,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleLogoFileChange(schoolId, file) {
    if (!file) return;
    setEditingLogo((prev) => ({ ...prev, [schoolId]: { uploading: true, error: null } }));
    try {
      await uploadLogoForSchool(schoolId, file);
      setEditingLogo((prev) => { const n = { ...prev }; delete n[schoolId]; return n; });
      await loadSchools();
    } catch (err) {
      setEditingLogo((prev) => ({ ...prev, [schoolId]: { uploading: false, error: err.response?.data?.error ?? err.message } }));
    }
  }

  // ── Invite / user management ────────────────────────────────────────

  async function handleGenerateInvite(schoolId) {
    setInviteGenerating((prev) => ({ ...prev, [schoolId]: true }));
    setActionError(null);
    try {
      const { data } = await api.post('/api/admin/invite', {
        school_id: schoolId,
        role: inviteRoles[schoolId] ?? 'trainer',
      });
      setInviteLinks((prev) => ({ ...prev, [schoolId]: data.invite_url }));
      setExpanded((prev) => ({ ...prev, [schoolId]: true }));
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    } finally {
      setInviteGenerating((prev) => ({ ...prev, [schoolId]: false }));
    }
  }

  async function handleCopyLink(schoolId, url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(schoolId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.getElementById(`invite-link-${schoolId}`);
      el?.select();
    }
  }

  async function handleDeleteUser(userId, userEmail) {
    if (!confirm(`Remove user "${userEmail}"? Their treatment records will remain.`)) return;
    setActionError(null);
    try {
      await api.delete(`/api/admin/users/${userId}`);
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  async function handleDeleteSchool(schoolId, schoolName) {
    if (!confirm(`Delete "${schoolName}" and ALL its data (athletes, treatments, users)? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await api.delete(`/api/admin/schools/${schoolId}`);
      setInviteLinks((prev) => { const n = { ...prev }; delete n[schoolId]; return n; });
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  async function handleUpdateUserRole(userId, role) {
    setActionError(null);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  async function handleCancelInvite(inviteId) {
    setActionError(null);
    try {
      await api.delete(`/api/admin/invites/${inviteId}`);
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
    }
  }

  if (loading) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return <div className="admin-error">Failed to load: {error}</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">{schools.length} school{schools.length !== 1 ? 's' : ''} registered</p>
        </div>
        {isSuperAdmin && (
          <button
            className="btn btn--primary"
            onClick={() => { setShowAddSchool((v) => !v); setAddSchoolError(null); }}
          >
            {showAddSchool ? 'Cancel' : '+ Add School'}
          </button>
        )}
      </div>

      {/* Add new school form */}
      {isSuperAdmin && showAddSchool && (
        <form className="add-school-form" onSubmit={handleCreateSchool}>
          <h2 className="add-school-title">New School</h2>
          {addSchoolError && <div className="form-error" role="alert">{addSchoolError}</div>}

          <div className="add-school-fields">
            <div className="form-group">
              <label className="form-label">School Name *</label>
              <input
                type="text"
                className="form-input"
                value={newSchool.name}
                onChange={(e) => setNewSchool((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Hewitt-Trussville"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <div className="color-row">
                <input
                  type="color"
                  className="color-picker"
                  value={newSchool.primary_color}
                  onChange={(e) => setNewSchool((p) => ({ ...p, primary_color: e.target.value }))}
                />
                <span className="color-hex">{newSchool.primary_color}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Cost Per Visit ($)</label>
              <input
                type="number"
                className="form-input"
                value={newSchool.cost_per_visit}
                onChange={(e) => setNewSchool((p) => ({ ...p, cost_per_visit: e.target.value }))}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Logo (optional)</label>
              <input
                ref={newLogoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => setNewSchool((p) => ({ ...p, logoFile: e.target.files?.[0] ?? null }))}
              />
              <button type="button" className="btn btn--sm btn--outline" onClick={() => newLogoRef.current?.click()}>
                {newSchool.logoFile ? newSchool.logoFile.name : 'Choose file'}
              </button>
            </div>
          </div>

          <div className="add-school-actions">
            <button type="submit" className="btn btn--primary" disabled={addingSchool}>
              {addingSchool ? 'Saving...' : 'Save School'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => { setShowAddSchool(false); setNewSchool(BLANK_SCHOOL); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="form-error" role="alert">{actionError}</div>
      )}

      {schools.length === 0 && (
        <p className="admin-empty">No schools yet.</p>
      )}

      <div className="admin-schools">
        {schools.map((school) => {
          const isExpanded = expanded[school.id];
          const inviteLink = inviteLinks[school.id];
          const isGenerating = inviteGenerating[school.id];
          const colorEdit = editingColor[school.id];
          const logoState = editingLogo[school.id];

          return (
            <div key={school.id} className="school-card">
              <div className="school-card-header">
                <div className="school-info">
                  <button
                    className="school-name-btn"
                    onClick={() => toggleExpand(school.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="school-caret">{isExpanded ? '▼' : '▶'}</span>
                    <span className="school-name">{school.name}</span>
                  </button>
                  <span className="school-meta">
                    {school.users.length} user{school.users.length !== 1 ? 's' : ''}
                    {school.pending_invites.length > 0 && (
                      <span className="invite-badge">{school.pending_invites.length} pending</span>
                    )}
                  </span>
                  {isSuperAdmin && (
                    <div className="school-branding-actions">
                      <button
                        className="btn btn--sm btn--outline"
                        onClick={() => colorEdit ? setEditingColor((p) => { const n = { ...p }; delete n[school.id]; return n; }) : startEditColor(school)}
                      >
                        {colorEdit ? 'Cancel' : 'Edit Color'}
                      </button>
                      <button
                        className="btn btn--sm btn--outline"
                        onClick={() => {
                          if (!logoRefs.current[school.id]) logoRefs.current[school.id] = document.createElement('input');
                          const inp = logoRefs.current[school.id];
                          inp.type = 'file';
                          inp.accept = 'image/*';
                          inp.onchange = (e) => handleLogoFileChange(school.id, e.target.files?.[0]);
                          inp.click();
                        }}
                        disabled={logoState?.uploading}
                      >
                        {logoState?.uploading ? 'Uploading...' : 'Edit Logo'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="school-actions">
                  <select
                    className="form-input form-input--sm"
                    value={inviteRoles[school.id] ?? 'trainer'}
                    onChange={(e) => setInviteRoles((prev) => ({ ...prev, [school.id]: e.target.value }))}
                  >
                    <option value="trainer">Athletic Trainer</option>
                    <option value="coach">Coach</option>
                    <option value="admin">School Admin</option>
                  </select>
                  <button
                    className="btn btn--sm btn--outline"
                    onClick={() => handleGenerateInvite(school.id)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Generating...' : '+ Invite Link'}
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => handleDeleteSchool(school.id, school.name)}
                  >
                    Delete School
                  </button>
                </div>
              </div>

              {/* Inline color editor */}
              {colorEdit && (
                <div className="inline-color-edit">
                  <div className="color-row">
                    <input
                      type="color"
                      className="color-picker"
                      value={colorEdit.color}
                      onChange={(e) => setEditingColor((p) => ({ ...p, [school.id]: { ...colorEdit, color: e.target.value } }))}
                    />
                    <span className="color-hex">{colorEdit.color}</span>
                  </div>
                  {colorEdit.error && <span className="inline-error">{colorEdit.error}</span>}
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => handleSaveColor(school.id)}
                    disabled={colorEdit.saving}
                  >
                    {colorEdit.saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}

              {logoState?.error && (
                <div className="inline-error" style={{ padding: '0.4rem 1rem' }}>{logoState.error}</div>
              )}

              {/* Generated invite link */}
              {inviteLink && (
                <div className="invite-link-row">
                  <span className="invite-link-label">Share this link:</span>
                  <input
                    id={`invite-link-${school.id}`}
                    type="text"
                    className="form-input invite-link-input"
                    value={inviteLink}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => handleCopyLink(school.id, inviteLink)}
                  >
                    {copiedId === school.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Expanded user + pending invite list */}
              {isExpanded && (
                <div className="school-detail">
                  {school.users.length === 0 && school.pending_invites.length === 0 && (
                    <p className="detail-empty">No users yet.</p>
                  )}

                  {school.users.map((user) => (
                    <div key={user.id} className="user-row">
                      <div className="user-info">
                        <span className="user-email">{user.email}</span>
                        {user.is_admin && <span className="admin-badge">admin</span>}
                      </div>
                      <div className="user-actions">
                        <select
                          className="form-input form-input--sm"
                          value={user.role ?? 'trainer'}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                        >
                          <option value="trainer">Athletic Trainer</option>
                          <option value="coach">Coach</option>
                          <option value="admin">School Admin</option>
                        </select>
                        <button
                          className="btn--danger-ghost"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {school.pending_invites.map((inv) => (
                    <div key={inv.id} className="user-row user-row--invite">
                      <div className="user-info">
                        <span className="user-email invite-token-label">Invite link</span>
                        <span className="pending-badge">pending</span>
                        <span className="role-badge">
                          {inv.role === 'coach' ? 'Coach' : inv.role === 'admin' ? 'School Admin' : 'Athletic Trainer'}
                        </span>
                      </div>
                      <button
                        className="btn--danger-ghost"
                        onClick={() => handleCancelInvite(inv.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
