import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import './Admin.css';

export default function Admin() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track generated invite links: schoolId → url string
  const [inviteLinks, setInviteLinks] = useState({});
  const [inviteGenerating, setInviteGenerating] = useState({});
  const [copiedId, setCopiedId] = useState(null);

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

  async function handleGenerateInvite(schoolId) {
    setInviteGenerating((prev) => ({ ...prev, [schoolId]: true }));
    setActionError(null);
    try {
      const { data } = await api.post('/api/admin/invite', {
        school_id: schoolId,
        redirect_origin: window.location.origin,
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
      // Fallback: select the text
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
          const inviteLink = inviteLinks[school.id];
          const isGenerating = inviteGenerating[school.id];

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
                      <button
                        className="btn--danger-ghost"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {school.pending_invites.map((inv) => (
                    <div key={inv.id} className="user-row user-row--invite">
                      <div className="user-info">
                        <span className="user-email invite-token-label">Invite link</span>
                        <span className="pending-badge">pending</span>
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
