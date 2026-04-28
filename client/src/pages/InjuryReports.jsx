import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';
import './InjuryReports.css';

const ROLES      = ['Head Coach', 'Assistant Coach', 'Team Physician', 'Athletic Director', 'Parent', 'Other'];
const DAYS       = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQ_OPTS  = [
  { key: 'daily',    label: 'Daily' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'weekdays', label: 'Weekdays (Mon–Fri)' },
];

const EMPTY_REC  = { name: '', phone: '', role: '' };
const EMPTY_LIST = { name: '', memberIds: [] };
const EMPTY_SCHED = { name: '', frequency: 'weekly', day_of_week: 1, send_time: '07:00', list_ids: [], include_notes: true, active: true };

// ── Sub-components ────────────────────────────────────────────────────

function RecipientForm({ initial = EMPTY_REC, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="ir-inline-form">
      <div className="ir-form-row">
        <div className="ir-form-group">
          <label className="ir-label">Name</label>
          <input className="ir-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Smith" />
        </div>
        <div className="ir-form-group">
          <label className="ir-label">Phone</label>
          <input className="ir-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
        </div>
      </div>
      <div className="ir-form-group">
        <label className="ir-label">Role</label>
        <select className="ir-input" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="">Select role…</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="ir-form-actions">
        <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn--primary btn--sm" disabled={saving || !form.name.trim() || !form.phone.trim() || !form.role}
          onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ListForm({ initial = EMPTY_LIST, recipients, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  function toggleMember(id) {
    setForm(p => ({
      ...p,
      memberIds: p.memberIds.includes(id) ? p.memberIds.filter(x => x !== id) : [...p.memberIds, id],
    }));
  }
  return (
    <div className="ir-inline-form">
      <div className="ir-form-group">
        <label className="ir-label">List Name</label>
        <input className="ir-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Coaching Staff" />
      </div>
      <div className="ir-form-group">
        <label className="ir-label">Members</label>
        {recipients.length === 0 ? (
          <p className="ir-hint">Add recipients first.</p>
        ) : (
          <div className="ir-member-checklist">
            {recipients.map(r => (
              <label key={r.id} className="ir-check-row">
                <input type="checkbox" checked={form.memberIds.includes(r.id)} onChange={() => toggleMember(r.id)} />
                <span className="ir-check-name">{r.name}</span>
                <span className="ir-check-meta">{r.role}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="ir-form-actions">
        <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn--primary btn--sm" disabled={saving || !form.name.trim()}
          onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ScheduleForm({ initial = EMPTY_SCHED, lists, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  function toggleList(id) {
    setForm(p => ({
      ...p,
      list_ids: p.list_ids.includes(id) ? p.list_ids.filter(x => x !== id) : [...p.list_ids, id],
    }));
  }
  return (
    <div className="ir-inline-form">
      <div className="ir-form-group">
        <label className="ir-label">Schedule Name</label>
        <input className="ir-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Daily Coaches Report" />
      </div>
      <div className="ir-form-row">
        <div className="ir-form-group">
          <label className="ir-label">Frequency</label>
          <select className="ir-input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQ_OPTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        {form.frequency === 'weekly' && (
          <div className="ir-form-group">
            <label className="ir-label">Day of Week</label>
            <select className="ir-input" value={form.day_of_week} onChange={e => set('day_of_week', Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
        <div className="ir-form-group">
          <label className="ir-label">Send Time</label>
          <input type="time" className="ir-input" value={form.send_time} onChange={e => set('send_time', e.target.value)} />
        </div>
      </div>
      <div className="ir-form-group">
        <label className="ir-label">Send To (lists)</label>
        {lists.length === 0 ? (
          <p className="ir-hint">Create recipient lists first.</p>
        ) : (
          <div className="ir-member-checklist">
            {lists.map(l => (
              <label key={l.id} className="ir-check-row">
                <input type="checkbox" checked={form.list_ids.includes(l.id)} onChange={() => toggleList(l.id)} />
                <span className="ir-check-name">{l.name}</span>
                <span className="ir-check-meta">{l.members?.length ?? 0} recipients</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="ir-form-row">
        <label className="ir-toggle-row">
          <input type="checkbox" checked={form.include_notes} onChange={e => set('include_notes', e.target.checked)} />
          <span>Include notes field</span>
        </label>
        <label className="ir-toggle-row">
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />
          <span>Active</span>
        </label>
      </div>
      <div className="ir-form-actions">
        <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn--primary btn--sm"
          disabled={saving || !form.name.trim() || !form.list_ids.length}
          onClick={() => onSave(form)}>
          {saving ? 'Saving…' : 'Save Schedule'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function InjuryReports() {
  const [tab, setTab] = useState('send');

  const [lists,      setLists]      = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [schedules,  setSchedules]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  const reload = useCallback(async () => {
    try {
      const [lr, rr, sr] = await Promise.all([
        api.get('/api/injury-reports/lists'),
        api.get('/api/injury-reports/recipients'),
        api.get('/api/injury-reports/schedules'),
      ]);
      setLists(lr.data ?? []);
      setRecipients(rr.data ?? []);
      setSchedules(sr.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Tab 1: Send ─────────────────────────────────────────────────
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [sendNotes,   setSendNotes]   = useState('');
  const [preview,     setPreview]     = useState(null);
  const [previewing,  setPreviewing]  = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sendResult,  setSendResult]  = useState(null);
  const [sendError,   setSendError]   = useState(null);

  function toggleList(id) {
    setSelectedListIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    setPreview(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreview(null);
    try {
      const { data } = await api.post('/api/injury-reports/preview', { listIds: selectedListIds, notes: sendNotes });
      setPreview(data);
    } catch (err) {
      setSendError(err.response?.data?.error ?? err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const { data } = await api.post('/api/injury-reports/send', { listIds: selectedListIds, notes: sendNotes });
      setSendResult(data);
      setPreview(null);
    } catch (err) {
      setSendError(err.response?.data?.error ?? err.message);
    } finally {
      setSending(false);
    }
  }

  // ── Tab 2: Recipients & Lists ────────────────────────────────────
  const [showRecForm,     setShowRecForm]     = useState(false);
  const [editingRec,      setEditingRec]      = useState(null);
  const [showListForm,    setShowListForm]    = useState(false);
  const [editingList,     setEditingList]     = useState(null);
  const [tab2Saving,      setTab2Saving]      = useState(false);
  const [tab2Error,       setTab2Error]       = useState(null);

  async function saveRecipient(form) {
    setTab2Saving(true); setTab2Error(null);
    try {
      if (editingRec) {
        await api.put(`/api/injury-reports/recipients/${editingRec.id}`, form);
      } else {
        await api.post('/api/injury-reports/recipients', form);
      }
      setShowRecForm(false); setEditingRec(null);
      await reload();
    } catch (err) {
      setTab2Error(err.response?.data?.error ?? err.message);
    } finally {
      setTab2Saving(false);
    }
  }

  async function deleteRecipient(id) {
    if (!window.confirm('Remove this recipient?')) return;
    try { await api.delete(`/api/injury-reports/recipients/${id}`); await reload(); }
    catch (err) { setTab2Error(err.response?.data?.error ?? err.message); }
  }

  async function saveList(form) {
    setTab2Saving(true); setTab2Error(null);
    try {
      const payload = { name: form.name, recipientIds: form.memberIds };
      if (editingList) {
        await api.put(`/api/injury-reports/lists/${editingList.id}`, payload);
      } else {
        await api.post('/api/injury-reports/lists', payload);
      }
      setShowListForm(false); setEditingList(null);
      await reload();
    } catch (err) {
      setTab2Error(err.response?.data?.error ?? err.message);
    } finally {
      setTab2Saving(false);
    }
  }

  async function deleteList(id) {
    if (!window.confirm('Delete this list?')) return;
    try { await api.delete(`/api/injury-reports/lists/${id}`); await reload(); }
    catch (err) { setTab2Error(err.response?.data?.error ?? err.message); }
  }

  // ── Tab 3: Schedules ─────────────────────────────────────────────
  const [showSchedForm,  setShowSchedForm]  = useState(false);
  const [editingSched,   setEditingSched]   = useState(null);
  const [schedSaving,    setSchedSaving]    = useState(false);
  const [schedError,     setSchedError]     = useState(null);

  async function saveSchedule(form) {
    setSchedSaving(true); setSchedError(null);
    try {
      if (editingSched) {
        await api.put(`/api/injury-reports/schedules/${editingSched.id}`, form);
      } else {
        await api.post('/api/injury-reports/schedules', form);
      }
      setShowSchedForm(false); setEditingSched(null);
      await reload();
    } catch (err) {
      setSchedError(err.response?.data?.error ?? err.message);
    } finally {
      setSchedSaving(false);
    }
  }

  async function deleteSchedule(id) {
    if (!window.confirm('Delete this schedule?')) return;
    try { await api.delete(`/api/injury-reports/schedules/${id}`); await reload(); }
    catch (err) { setSchedError(err.response?.data?.error ?? err.message); }
  }

  function freqLabel(s) {
    if (s.frequency === 'weekly') return `Weekly · ${DAYS[s.day_of_week ?? 0]}`;
    if (s.frequency === 'weekdays') return 'Weekdays (Mon–Fri)';
    return 'Daily';
  }

  function listNamesFor(ids) {
    return (ids ?? []).map(id => lists.find(l => l.id === id)?.name).filter(Boolean).join(', ') || '—';
  }

  if (loading) {
    return (
      <div className="ir-page">
        <div className="state-msg"><div className="spinner" /><span>Loading…</span></div>
      </div>
    );
  }

  return (
    <div className="ir-page">
      <div className="ir-header">
        <h1 className="ir-title">Injury Reports</h1>
        <p className="ir-subtitle">Send SMS injury status reports to coaches, physicians, and staff.</p>
      </div>

      {/* Tab bar */}
      <div className="ir-tabs">
        {[
          { key: 'send',       label: 'Send Report' },
          { key: 'recipients', label: 'Recipients & Lists' },
          { key: 'schedules',  label: 'Schedules' },
        ].map(t => (
          <button
            key={t.key}
            className={`ir-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Send Report ── */}
      {tab === 'send' && (
        <div className="ir-card">
          {lists.length === 0 ? (
            <div className="ir-empty-state">
              <p>No recipient lists yet.</p>
              <button className="btn btn--ghost btn--sm" onClick={() => setTab('recipients')}>
                Set up recipients →
              </button>
            </div>
          ) : (
            <>
              <div className="ir-section-label">Send to</div>
              <div className="ir-list-checks">
                {lists.map(l => (
                  <label key={l.id} className={`ir-list-check${selectedListIds.includes(l.id) ? ' checked' : ''}`}>
                    <input type="checkbox" checked={selectedListIds.includes(l.id)} onChange={() => toggleList(l.id)} />
                    <span className="ir-list-name">{l.name}</span>
                    <span className="ir-list-count">{l.members?.length ?? 0} recipient{l.members?.length !== 1 ? 's' : ''}</span>
                  </label>
                ))}
              </div>

              <div className="ir-form-group">
                <label className="ir-label">Notes <span className="ir-optional">(optional)</span></label>
                <textarea
                  className="ir-input ir-textarea"
                  rows={3}
                  placeholder="Any additional context for this report…"
                  value={sendNotes}
                  onChange={e => setSendNotes(e.target.value)}
                />
              </div>

              {preview && (
                <div className="ir-preview">
                  <div className="ir-preview-header">
                    <span className="ir-preview-title">Preview</span>
                    <span className="ir-preview-meta">
                      Will be sent to {preview.recipients.length} recipient{preview.recipients.length !== 1 ? 's' : ''}
                      {preview.recipients.length > 0 && (
                        <> ({preview.recipients.map(r => r.name).join(', ')})</>
                      )}
                    </span>
                  </div>
                  <pre className="ir-preview-body">{preview.message}</pre>
                </div>
              )}

              {sendError && <div className="ir-error">{sendError}</div>}

              {sendResult && (
                <div className={`ir-result${sendResult.failed > 0 ? ' partial' : ''}`}>
                  {sendResult.failed === 0
                    ? `✓ Report sent to ${sendResult.sent} recipient${sendResult.sent !== 1 ? 's' : ''}.`
                    : `Sent to ${sendResult.sent}, failed for ${sendResult.failed}. Check phone numbers.`}
                  {sendResult.errors?.length > 0 && (
                    <ul className="ir-error-list">
                      {sendResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="ir-send-actions">
                <button
                  className="btn btn--ghost"
                  onClick={handlePreview}
                  disabled={!selectedListIds.length || previewing || sending}
                >
                  {previewing ? 'Loading…' : 'Preview Message'}
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleSend}
                  disabled={!selectedListIds.length || sending || previewing}
                >
                  {sending ? 'Sending…' : 'Send Now'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab 2: Recipients & Lists ── */}
      {tab === 'recipients' && (
        <div className="ir-two-col">

          {/* Left: Recipients */}
          <div className="ir-col-card">
            <div className="ir-col-header">
              <h2 className="ir-col-title">Recipients</h2>
              {!showRecForm && (
                <button className="btn btn--primary btn--sm" onClick={() => { setShowRecForm(true); setEditingRec(null); }}>
                  + Add
                </button>
              )}
            </div>

            {tab2Error && <div className="ir-error">{tab2Error}</div>}

            {(showRecForm && !editingRec) && (
              <RecipientForm
                onSave={saveRecipient}
                onCancel={() => setShowRecForm(false)}
                saving={tab2Saving}
              />
            )}

            {recipients.length === 0 && !showRecForm ? (
              <p className="ir-hint">No recipients added yet.</p>
            ) : (
              <div className="ir-item-list">
                {recipients.map(r => (
                  <div key={r.id} className="ir-item">
                    {editingRec?.id === r.id ? (
                      <RecipientForm
                        initial={{ name: r.name, phone: r.phone, role: r.role }}
                        onSave={saveRecipient}
                        onCancel={() => setEditingRec(null)}
                        saving={tab2Saving}
                      />
                    ) : (
                      <>
                        <div className="ir-item-info">
                          <span className="ir-item-name">{r.name}</span>
                          <span className="ir-item-meta">{r.role} · {r.phone}</span>
                        </div>
                        <div className="ir-item-actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditingRec(r); setShowRecForm(false); }}>Edit</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => deleteRecipient(r.id)}>Remove</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Lists */}
          <div className="ir-col-card">
            <div className="ir-col-header">
              <h2 className="ir-col-title">Lists</h2>
              {!showListForm && (
                <button className="btn btn--primary btn--sm" onClick={() => { setShowListForm(true); setEditingList(null); }}>
                  + Add
                </button>
              )}
            </div>

            {(showListForm && !editingList) && (
              <ListForm
                recipients={recipients}
                onSave={saveList}
                onCancel={() => setShowListForm(false)}
                saving={tab2Saving}
              />
            )}

            {lists.length === 0 && !showListForm ? (
              <p className="ir-hint">No lists created yet.</p>
            ) : (
              <div className="ir-item-list">
                {lists.map(l => (
                  <div key={l.id} className="ir-item">
                    {editingList?.id === l.id ? (
                      <ListForm
                        initial={{ name: l.name, memberIds: l.members.map(m => m.id) }}
                        recipients={recipients}
                        onSave={saveList}
                        onCancel={() => setEditingList(null)}
                        saving={tab2Saving}
                      />
                    ) : (
                      <>
                        <div className="ir-item-info">
                          <span className="ir-item-name">{l.name}</span>
                          <span className="ir-item-meta">
                            {l.members?.length ?? 0} member{l.members?.length !== 1 ? 's' : ''}
                            {l.members?.length > 0 && ` — ${l.members.map(m => m.name).join(', ')}`}
                          </span>
                        </div>
                        <div className="ir-item-actions">
                          <button className="btn btn--ghost btn--sm"
                            onClick={() => { setEditingList(l); setShowListForm(false); }}>Edit</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => deleteList(l.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Schedules ── */}
      {tab === 'schedules' && (
        <div className="ir-card">
          <div className="ir-col-header">
            <h2 className="ir-col-title">Scheduled Reports</h2>
            {!showSchedForm && (
              <button className="btn btn--primary btn--sm" onClick={() => { setShowSchedForm(true); setEditingSched(null); }}>
                + Add Schedule
              </button>
            )}
          </div>

          <p className="ir-hint" style={{ marginTop: 0 }}>
            Schedules store your report configuration. Automated sending requires a cron job or external scheduler to call the send endpoint.
          </p>

          {schedError && <div className="ir-error">{schedError}</div>}

          {(showSchedForm && !editingSched) && (
            <ScheduleForm
              lists={lists}
              onSave={saveSchedule}
              onCancel={() => setShowSchedForm(false)}
              saving={schedSaving}
            />
          )}

          {schedules.length === 0 && !showSchedForm ? (
            <p className="ir-hint">No schedules configured.</p>
          ) : (
            <div className="ir-item-list">
              {schedules.map(s => (
                <div key={s.id} className="ir-item">
                  {editingSched?.id === s.id ? (
                    <ScheduleForm
                      initial={{
                        name: s.name, frequency: s.frequency,
                        day_of_week: s.day_of_week ?? 1,
                        send_time: s.send_time?.slice(0, 5) ?? '07:00',
                        list_ids: s.list_ids ?? [],
                        include_notes: s.include_notes ?? true,
                        active: s.active ?? true,
                      }}
                      lists={lists}
                      onSave={saveSchedule}
                      onCancel={() => setEditingSched(null)}
                      saving={schedSaving}
                    />
                  ) : (
                    <>
                      <div className="ir-item-info">
                        <div className="ir-sched-top">
                          <span className="ir-item-name">{s.name}</span>
                          <span className={`ir-sched-badge${s.active ? ' active' : ''}`}>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <span className="ir-item-meta">
                          {freqLabel(s)} · {s.send_time?.slice(0, 5)} · {listNamesFor(s.list_ids)}
                          {s.include_notes ? ' · Includes notes' : ''}
                        </span>
                      </div>
                      <div className="ir-item-actions">
                        <button className="btn btn--ghost btn--sm"
                          onClick={() => { setEditingSched(s); setShowSchedForm(false); }}>Edit</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => deleteSchedule(s.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
