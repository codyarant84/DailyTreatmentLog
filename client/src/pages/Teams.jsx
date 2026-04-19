import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';

import SportCombobox from '../components/SportCombobox.jsx';
import './Teams.css';

const RTP_COLORS = {
  'Full Participation':    { bg: '#d1fae5', color: '#065f46' },
  'Limited Participation': { bg: '#fef3c7', color: '#92400e' },
  'Out':                   { bg: '#fee2e2', color: '#991b1b' },
  'Cleared':               { bg: '#ede9fe', color: '#4c1d95' },
};

const RISK_LABEL = { red: 'High Risk', amber: 'Monitor', green: 'OK' };

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Add-athlete inline panel ───────────────────────────────────────────────

function AddAthletePanel({ teamId, existingIds, onAdded, onClose }) {
  const [allAthletes, setAllAthletes] = useState([]);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/api/athletes').then(({ data }) => setAllAthletes(data)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const available = allAthletes.filter(
    (a) => !existingIds.has(a.id) &&
      (a.name.toLowerCase().includes(search.toLowerCase()) ||
       (a.sport ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  async function handleAdd() {
    if (!selected) { setError('Select an athlete.'); return; }
    setError(null);
    setSaving(true);
    try {
      await api.post(`/api/teams/${teamId}/athletes`, {
        athlete_id: selected.id,
        jersey_number: jerseyNumber ? Number(jerseyNumber) : null,
        position: position.trim() || null,
      });
      onAdded(selected, jerseyNumber ? Number(jerseyNumber) : null, position.trim() || null);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSaving(false);
    }
  }

  return (
    <div className="add-athlete-panel">
      <div className="add-athlete-panel-header">
        <span className="add-athlete-panel-title">Add Athlete to Team</span>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">Search Athletes</label>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder="Name or sport…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
        />
      </div>

      <div className="athlete-pick-list">
        {available.length === 0 && (
          <p className="pick-empty">
            {allAthletes.length === 0 ? 'Loading…' : 'No athletes available to add.'}
          </p>
        )}
        {available.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`pick-option${selected?.id === a.id ? ' pick-option--selected' : ''}`}
            onClick={() => setSelected(a)}
          >
            <span className="pick-name">{a.name}</span>
            {a.sport && <span className="pick-sport">{a.sport}</span>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="add-athlete-fields">
          <div className="form-group">
            <label className="form-label">Jersey #</label>
            <input
              type="number"
              min="0"
              max="99"
              className="form-input"
              placeholder="—"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Position</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. QB"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="add-athlete-panel-actions">
        <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>Cancel</button>
        <button
          className="btn btn--primary btn--sm"
          onClick={handleAdd}
          disabled={!selected || saving}
        >
          {saving ? 'Adding…' : 'Add to Team'}
        </button>
      </div>
    </div>
  );
}

// ── Team list view ─────────────────────────────────────────────────────────

function TeamList({ onSelect }) {
  const [teams, setTeams]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', sport: '', season: '', is_active: true });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/teams');
      setTeams(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  function setField(field, val) {
    setForm((p) => ({ ...p, [field]: val }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Team name is required.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const { data } = await api.post('/api/teams', form);
      setTeams((prev) => [{ ...data, athlete_count: 0 }, ...prev]);
      setShowForm(false);
      setForm({ name: '', sport: '', season: '', is_active: true });
    } catch (err) {
      setFormError(err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="state-msg"><div className="spinner" /><span>Loading teams…</span></div>;
  if (error) return <div className="state-msg state-msg--error"><p>{error}</p></div>;

  return (
    <div className="teams-page">
      <div className="teams-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ New Team'}
        </button>
      </div>

      {showForm && (
        <form className="new-team-form" onSubmit={handleCreate} noValidate>
          <h2 className="new-team-form-title">New Team</h2>
          {formError && <div className="form-error">{formError}</div>}
          <div className="new-team-grid">
            <div className="form-group">
              <label className="form-label">Team Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Varsity Football"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sport</label>
              <SportCombobox value={form.sport} onChange={(v) => setField('sport', v)} />
            </div>
            <div className="form-group">
              <label className="form-label">Season</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Fall 2025"
                value={form.season}
                onChange={(e) => setField('season', e.target.value)}
              />
            </div>
            <div className="form-group form-group--toggle">
              <label className="form-label">Active</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          </div>
          <div className="new-team-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </form>
      )}

      {teams.length === 0 && !showForm && (
        <div className="state-msg state-msg--empty">
          <p>No teams yet. Create one to get started.</p>
        </div>
      )}

      <div className="team-grid">
        {teams.map((team) => (
          <button
            key={team.id}
            className="team-card"
            onClick={() => onSelect(team)}
          >
            <div className="team-card-top">
              <span className="team-card-name">{team.name}</span>
              <span className={`team-status-badge${team.is_active ? '' : ' team-status-badge--inactive'}`}>
                {team.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {(team.sport || team.season) && (
              <div className="team-card-meta">
                {team.sport && <span>{team.sport}</span>}
                {team.sport && team.season && <span className="meta-dot">·</span>}
                {team.season && <span>{team.season}</span>}
              </div>
            )}
            <div className="team-card-count">
              {team.athlete_count} athlete{team.athlete_count !== 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Team detail view ───────────────────────────────────────────────────────

function TeamDetail({ team: initialTeam, onBack }) {
  const [team, setTeam]               = useState(initialTeam);
  const [activeTab, setActiveTab]     = useState('roster');
  const [editing, setEditing]         = useState(false);
  const [editForm, setEditForm]       = useState({
    name: initialTeam.name,
    sport: initialTeam.sport ?? '',
    season: initialTeam.season ?? '',
    is_active: initialTeam.is_active,
  });
  const [savingEdit, setSavingEdit]   = useState(false);
  const [editError, setEditError]     = useState(null);

  // Roster state
  const [roster, setRoster]           = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [showAdd, setShowAdd]         = useState(false);

  // Overview state
  const [injuries, setInjuries]       = useState([]);
  const [gpsData, setGpsData]         = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLoaded, setOverviewLoaded]   = useState(false);

  useEffect(() => { loadRoster(); }, [team.id]);

  useEffect(() => {
    if (activeTab === 'overview' && !overviewLoaded) loadOverview();
  }, [activeTab]);

  async function loadRoster() {
    setRosterLoading(true);
    try {
      const { data } = await api.get(`/api/teams/${team.id}/athletes`);
      setRoster(data);
    } catch {
      // silently ignore
    } finally {
      setRosterLoading(false);
    }
  }

  async function loadOverview() {
    setOverviewLoading(true);
    try {
      const athleteIds = roster.map((a) => a.id);
      if (athleteIds.length === 0) { setOverviewLoaded(true); return; }

      const [injRes, gpsDashRes] = await Promise.all([
        api.get('/api/injuries?active=true'),
        api.get('/api/gps/dashboard'),
      ]);

      // Injuries: filter to team athletes
      const idSet = new Set(athleteIds);
      setInjuries((injRes.data ?? []).filter((inj) => {
        const matched = roster.find((a) => a.name === inj.athlete_name);
        return matched && idSet.has(matched.id);
      }));

      // GPS: dashboard already returns most recent load per athlete — filter to team roster
      const latestMap = {};
      (gpsDashRes.data.athletes ?? []).forEach((a) => { latestMap[a.id] = a; });
      const rosterWithGps = roster
        .map((a) => ({ ...a, gps: latestMap[a.id] ?? null }))
        .filter((a) => a.gps !== null);
      setGpsData(rosterWithGps);
      setOverviewLoaded(true);
    } catch {
      setOverviewLoaded(true);
    } finally {
      setOverviewLoading(false);
    }
  }

  function setEditField(field, val) {
    setEditForm((p) => ({ ...p, [field]: val }));
  }

  async function handleSaveEdit() {
    if (!editForm.name.trim()) { setEditError('Team name is required.'); return; }
    setEditError(null);
    setSavingEdit(true);
    try {
      const { data } = await api.put(`/api/teams/${team.id}`, editForm);
      setTeam(data);
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.error ?? err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  function handleAthleteAdded(athlete, jerseyNumber, position) {
    setRoster((prev) => [...prev, { ...athlete, jersey_number: jerseyNumber, position }]);
    setShowAdd(false);
    setOverviewLoaded(false); // invalidate overview so it reloads
  }

  async function handleRemove(athleteId) {
    try {
      await api.delete(`/api/teams/${team.id}/athletes/${athleteId}`);
      setRoster((prev) => prev.filter((a) => a.id !== athleteId));
      setOverviewLoaded(false);
    } catch {
      // silently ignore
    }
  }

  const existingIds = new Set(roster.map((a) => a.id));

  const rtpCounts = injuries.reduce((acc, inj) => {
    const s = inj.rtp_status ?? 'Unknown';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="teams-page">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Teams
        </button>

        <div className="detail-header-main">
          {editing ? (
            <div className="detail-edit-form">
              {editError && <div className="form-error">{editError}</div>}
              <div className="detail-edit-grid">
                <div className="form-group">
                  <label className="form-label">Team Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditField('name', e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sport</label>
                  <SportCombobox value={editForm.sport} onChange={(v) => setEditField('sport', v)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Season</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.season}
                    onChange={(e) => setEditField('season', e.target.value)}
                    placeholder="e.g. Fall 2025"
                  />
                </div>
                <div className="form-group form-group--toggle">
                  <label className="form-label">Active</label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditField('is_active', e.target.checked)}
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>
              <div className="detail-edit-actions">
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => { setEditing(false); setEditError(null); }}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-title-row">
              <div>
                <div className="detail-name-row">
                  <h1 className="detail-team-name">{team.name}</h1>
                  <span className={`team-status-badge${team.is_active ? '' : ' team-status-badge--inactive'}`}>
                    {team.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {(team.sport || team.season) && (
                  <p className="detail-subtitle">
                    {[team.sport, team.season].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setEditForm({
                    name: team.name,
                    sport: team.sport ?? '',
                    season: team.season ?? '',
                    is_active: team.is_active,
                  });
                  setEditing(true);
                }}
                aria-label="Edit team"
              >
                ✎ Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="team-tabs">
        <button
          className={`team-tab${activeTab === 'roster' ? ' team-tab--active' : ''}`}
          onClick={() => setActiveTab('roster')}
        >
          Roster
          <span className="tab-count">{roster.length}</span>
        </button>
        <button
          className={`team-tab${activeTab === 'overview' ? ' team-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
      </div>

      {/* Roster tab */}
      {activeTab === 'roster' && (
        <div className="roster-tab">
          <div className="roster-tab-header">
            <span className="roster-tab-count">
              {roster.length} athlete{roster.length !== 1 ? 's' : ''}
            </span>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowAdd((s) => !s)}
            >
              {showAdd ? 'Cancel' : '+ Add Athlete'}
            </button>
          </div>

          {showAdd && (
            <AddAthletePanel
              teamId={team.id}
              existingIds={existingIds}
              onAdded={handleAthleteAdded}
              onClose={() => setShowAdd(false)}
            />
          )}

          {rosterLoading ? (
            <div className="state-msg"><div className="spinner" /><span>Loading roster…</span></div>
          ) : roster.length === 0 ? (
            <div className="state-msg state-msg--empty">
              <p>No athletes on this team yet.</p>
            </div>
          ) : (
            <div className="roster-table-wrap">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Athlete</th>
                    <th>Position</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roster
                    .slice()
                    .sort((a, b) => {
                      if (a.jersey_number == null && b.jersey_number == null) return a.name.localeCompare(b.name);
                      if (a.jersey_number == null) return 1;
                      if (b.jersey_number == null) return -1;
                      return a.jersey_number - b.jersey_number;
                    })
                    .map((a) => (
                      <tr key={a.id} className="athlete-row">
                        <td className="jersey-cell">
                          {a.jersey_number != null ? (
                            <span className="jersey-badge">{a.jersey_number}</span>
                          ) : (
                            <span className="cell-empty">—</span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/athletes/${encodeURIComponent(a.name)}`}
                            className="athlete-name-link"
                          >
                            {a.name}
                          </Link>
                        </td>
                        <td>{a.position ?? <span className="cell-empty">—</span>}</td>
                        <td>
                          <button
                            className="btn btn--danger-ghost btn--sm"
                            onClick={() => handleRemove(a.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="overview-tab">
          {overviewLoading ? (
            <div className="state-msg"><div className="spinner" /><span>Loading overview…</span></div>
          ) : roster.length === 0 ? (
            <div className="state-msg state-msg--empty">
              <p>Add athletes to this team to see an overview.</p>
            </div>
          ) : (
            <>
              {/* Injury summary */}
              <section className="overview-section">
                <h2 className="overview-section-title">Injury Summary</h2>
                {injuries.length === 0 ? (
                  <p className="overview-empty">No active injuries for athletes on this team.</p>
                ) : (
                  <>
                    <div className="injury-summary-stats">
                      <div className="inj-stat">
                        <span className="inj-stat-value">{injuries.length}</span>
                        <span className="inj-stat-label">Active injuries</span>
                      </div>
                      {Object.entries(rtpCounts).map(([status, count]) => (
                        <div
                          key={status}
                          className="inj-stat"
                          style={RTP_COLORS[status]
                            ? { background: RTP_COLORS[status].bg, color: RTP_COLORS[status].color }
                            : {}}
                        >
                          <span className="inj-stat-value">{count}</span>
                          <span className="inj-stat-label">{status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="injury-list">
                      {injuries.map((inj) => (
                        <div key={inj.id} className="inj-row">
                          <span className="inj-athlete">{inj.athlete_name}</span>
                          <span className="inj-detail">{inj.injury_type} · {inj.body_part}</span>
                          {inj.rtp_status && (
                            <span
                              className="inj-rtp"
                              style={RTP_COLORS[inj.rtp_status]
                                ? { background: RTP_COLORS[inj.rtp_status].bg, color: RTP_COLORS[inj.rtp_status].color }
                                : {}}
                            >
                              {inj.rtp_status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* GPS summary */}
              <section className="overview-section">
                <div className="overview-section-header">
                  <h2 className="overview-section-title">GPS Load Summary</h2>
                  <Link to="/gps" className="overview-link">Full GPS Dashboard →</Link>
                </div>
                {gpsData.length === 0 ? (
                  <p className="overview-empty">No GPS data available for athletes on this team.</p>
                ) : (
                  <div className="gps-mini-grid">
                    {gpsData.map((a) => {
                      const risk = a.gps.risk_status ?? 'green';
                      const acwr = a.gps.acwr ?? 1;
                      return (
                        <div key={a.id} className={`gps-mini-card gps-mini-card--${risk}`}>
                          <div className="gps-mini-avatar">{getInitials(a.name)}</div>
                          <div className="gps-mini-info">
                            <span className="gps-mini-name">{a.name}</span>
                            <span className="gps-mini-acwr">ACWR {acwr.toFixed(2)}</span>
                          </div>
                          <span className={`gps-mini-risk gps-mini-risk--${risk}`}>
                            {RISK_LABEL[risk] ?? risk}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────

export default function Teams() {
  const [selectedTeam, setSelectedTeam] = useState(null);

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onBack={() => setSelectedTeam(null)}
      />
    );
  }

  return <TeamList onSelect={setSelectedTeam} />;
}
