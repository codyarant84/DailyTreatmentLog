import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import './Admin.css';

export default function Admin() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track which school's invite form is open: schoolId → email string
  const [inviteForms, setInviteForms] = useState({});
  // Track which schools are expanded
  const [expanded, setExpanded] = useState({});
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    loadSchools();
  }, []);

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

  function openInvite(schoolId) {
    setInviteForms((prev) => ({ ...prev, [schoolId]: '' }));
    setExpanded((prev) => ({ ...prev, [schoolId]: true }));
  }

  function closeInvite(schoolId) {
    setInviteForms((prev) => {
      const next = { ...prev };
      delete next[schoolId];
      return next;
    });
  }

  async function handleInvite(e, schoolId) {
    e.preventDefault();
    const email = inviteForms[schoolId]?.trim();
    if (!email) return;
    setActionError(null);
    try {
      await api.post('/api/admin/invite', {
        email,
        school_id: schoolId,
        redirect_origin: window.location.origin,
      });
      closeInvite(schoolId);
      await loadSchools();
    } catch (err) {
      setActionError(err.response?.data?.error ?? err.message);
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
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">{schools.length} school{schools.length !== 1 ? 's' : ''} registered</p>
      </div>

      {actionError && (
        <div className="form-error" role="alert">{actionError}</div>
      )}

      {schools.length === 0 && (
        <p className="admin-empty">No schools yet.</p>
      )}

      <div className="admin-schools">
        {schools.map((school) => {
          const isExpanded = expanded[school.id];
          const inviteEmail = inviteForms[school.id];
          const hasInviteForm = inviteEmail !== undefined;

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
                </div>
                <div className="school-actions">
                  <button
                    className="btn btn--sm btn--outline"
                    onClick={() => hasInviteForm ? closeInvite(school.id) : openInvite(school.id)}
                  >
                    {hasInviteForm ? 'Cancel Invite' : 'Invite User'}
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => handleDeleteSchool(school.id, school.name)}
                  >
                    Delete School
                  </button>
                </div>
              </div>

              {/* Invite form */}
              {hasInviteForm && (
                <form
                  className="invite-form"
                  onSubmit={(e) => handleInvite(e, school.id)}
                >
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Email address to invite"
                    value={inviteEmail}
                    onChange={(e) =>
                      setInviteForms((prev) => ({ ...prev, [school.id]: e.target.value }))
                    }
                    required
                    autoFocus
                  />
                  <button type="submit" className="btn btn--sm btn--primary">
                    Send Invite
                  </button>
                </form>
              )}

              {/* Expanded user + invite list */}
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
                      <button
                        className="btn btn--sm btn--danger-ghost"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {school.pending_invites.map((inv) => (
                    <div key={inv.id} className="user-row user-row--invite">
                      <div className="user-info">
                        <span className="user-email">{inv.email}</span>
                        <span className="pending-badge">invite pending</span>
                      </div>
                      <button
                        className="btn btn--sm btn--danger-ghost"
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
