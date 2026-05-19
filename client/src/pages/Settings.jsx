import { useState, useRef, useEffect } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Settings.css';

const DEFAULT_COLOR = '#1d6fa5';

const SPORTS = [
  'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
  'Volleyball', 'Tennis', 'Track & Field', 'Cross Country', 'Swimming & Diving',
  'Wrestling', 'Golf', 'Lacrosse', 'Ice Hockey', 'Gymnastics',
  'Cheerleading', 'Dance', 'Bowling', 'Rugby', 'Water Polo',
  'Field Hockey', 'Skiing / Snowboarding', 'Other',
];

export default function Settings() {
  const { branding, setBranding, isAdmin } = useAuth();

  const [color, setColor] = useState(branding?.primaryColor ?? DEFAULT_COLOR);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const [colorError, setColorError] = useState(null);

  const [costPerVisit, setCostPerVisit] = useState(String(branding?.costPerVisit ?? 50));
  const [costSaving, setCostSaving] = useState(false);
  const [costSaved, setCostSaved] = useState(false);
  const [costError, setCostError] = useState(null);

  const [studentDomain, setStudentDomain] = useState(branding?.studentEmailDomain ?? '');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);
  const [domainError, setDomainError] = useState(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoRemoving, setLogoRemoving] = useState(false);

  const fileInputRef = useRef(null);

  // ── Coaches ────────────────────────────────────────────────────────
  const [coaches, setCoaches] = useState([]);
  const [coachSportSaving, setCoachSportSaving] = useState({});

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/api/school/coaches').then(({ data }) => setCoaches(data)).catch(() => {});
  }, [isAdmin]);

  async function handleCoachSportChange(coachId, sport) {
    setCoaches((prev) => prev.map((c) => c.id === coachId ? { ...c, sport } : c));
    setCoachSportSaving((prev) => ({ ...prev, [coachId]: true }));
    try {
      await api.put(`/api/school/coaches/${coachId}/sport`, { sport });
    } catch {
      // revert on error is a nice-to-have; skip for now
    } finally {
      setCoachSportSaving((prev) => ({ ...prev, [coachId]: false }));
    }
  }

  // ── Auto Report ────────────────────────────────────────────────────
  const [reportEnabled, setReportEnabled] = useState(false);
  const [reportTime, setReportTime] = useState('17:00');
  const [reportRecipients, setReportRecipients] = useState(['', '', '', '', '']);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [reportSending, setReportSending] = useState(false);
  const [reportSendMsg, setReportSendMsg] = useState(null);

  useEffect(() => {
    api.get('/api/reports/auto-settings')
      .then(({ data }) => {
        setReportEnabled(data.enabled ?? false);
        setReportTime(data.send_time ?? '17:00');
        const filled = [...(data.recipients ?? [])];
        while (filled.length < 5) filled.push('');
        setReportRecipients(filled);
      })
      .catch(() => {});
  }, []);

  async function handleSaveReport(e) {
    e.preventDefault();
    setReportError(null);
    setReportSaved(false);
    setReportSaving(true);
    try {
      const recipients = reportRecipients.map((r) => r.trim()).filter(Boolean);
      await api.put('/api/reports/auto-settings', { enabled: reportEnabled, send_time: reportTime, recipients });
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 2500);
    } catch (err) {
      setReportError(err.response?.data?.error ?? err.message);
    } finally {
      setReportSaving(false);
    }
  }

  async function handleSendNow() {
    setReportSendMsg(null);
    setReportSending(true);
    try {
      const recipients = reportRecipients.map((r) => r.trim()).filter(Boolean);
      const { data } = await api.post('/api/reports/send-daily', { recipients });
      setReportSendMsg(data.sent
        ? `Sent to ${data.recipients} recipient${data.recipients !== 1 ? 's' : ''} (${data.injuries} active injur${data.injuries !== 1 ? 'ies' : 'y'}).`
        : data.message);
      setTimeout(() => setReportSendMsg(null), 5000);
    } catch (err) {
      setReportSendMsg(err.response?.data?.error ?? err.message);
    } finally {
      setReportSending(false);
    }
  }

  async function handleSaveDomain(e) {
    e.preventDefault();
    setDomainError(null);
    setDomainSaved(false);
    setDomainSaving(true);
    try {
      const { data } = await api.put('/api/school/portal-domain', { student_email_domain: studentDomain });
      setBranding((prev) => ({ ...prev, studentEmailDomain: data.student_email_domain }));
      setDomainSaved(true);
      setTimeout(() => setDomainSaved(false), 2500);
    } catch (err) {
      setDomainError(err.response?.data?.error ?? err.message);
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleSaveColor(e) {
    e.preventDefault();
    setColorError(null);
    setColorSaved(false);
    setColorSaving(true);
    try {
      const { data } = await api.put('/api/school/branding', { primary_color: color });
      setBranding((prev) => ({ ...prev, primaryColor: data.primary_color }));
      setColorSaved(true);
      setTimeout(() => setColorSaved(false), 2500);
    } catch (err) {
      setColorError(err.response?.data?.error ?? err.message);
    } finally {
      setColorSaving(false);
    }
  }

  async function handleSaveCost(e) {
    e.preventDefault();
    const rate = Number(costPerVisit);
    if (isNaN(rate) || rate < 0) { setCostError('Enter a valid dollar amount.'); return; }
    setCostError(null);
    setCostSaved(false);
    setCostSaving(true);
    try {
      const { data } = await api.put('/api/school/branding', { primary_color: color, cost_per_visit: rate });
      setBranding((prev) => ({ ...prev, costPerVisit: data.cost_per_visit }));
      setCostSaved(true);
      setTimeout(() => setCostSaved(false), 2500);
    } catch (err) {
      setCostError(err.response?.data?.error ?? err.message);
    } finally {
      setCostSaving(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxBytes) {
      setLogoError('Logo must be under 2 MB.');
      return;
    }

    setLogoError(null);
    setLogoUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await api.post('/api/school/logo', {
          base64: reader.result,
          mime_type: file.type,
        });
        setBranding((prev) => ({ ...prev, logoUrl: data.logo_url }));
      } catch (err) {
        setLogoError(err.response?.data?.error ?? err.message);
      } finally {
        setLogoUploading(false);
        // Reset file input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveLogo() {
    if (!confirm('Remove the school logo?')) return;
    setLogoError(null);
    setLogoRemoving(true);
    try {
      await api.delete('/api/school/logo');
      setBranding((prev) => ({ ...prev, logoUrl: null }));
    } catch (err) {
      setLogoError(err.response?.data?.error ?? err.message);
    } finally {
      setLogoRemoving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize the appearance for your school</p>
      </div>

      <div className="settings-card">
        <h2 className="settings-section-title">School Color</h2>
        <p className="settings-hint">
          Sets the primary color used throughout the app — buttons, links, tags, and accents.
        </p>

        <form className="color-form" onSubmit={handleSaveColor}>
          <div className="color-row">
            <input
              type="color"
              className="color-picker"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              type="text"
              className="form-input color-hex"
              value={color}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setColor(val);
              }}
              maxLength={7}
              spellCheck={false}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={colorSaving}
            >
              {colorSaving ? 'Saving...' : colorSaved ? 'Saved!' : 'Save Color'}
            </button>
          </div>
          {colorError && <p className="settings-error">{colorError}</p>}
        </form>

        <button
          type="button"
          className="btn btn--ghost btn--sm reset-btn"
          onClick={() => setColor(DEFAULT_COLOR)}
        >
          Reset to default
        </button>
      </div>

      <div className="settings-card">
        <h2 className="settings-section-title">Program Reporting</h2>
        <p className="settings-hint">
          Controls how estimated cost savings are calculated and displayed throughout the app —
          on treatment log cards, athlete profiles, and the Insights dashboard.
        </p>
        <form onSubmit={handleSaveCost}>
          <div className="cost-field">
            <label className="cost-label" htmlFor="cost-per-visit">
              Estimated cost per visit ($)
            </label>
            <div className="cost-input-row">
              <div className="cost-input-wrap">
                <span className="cost-prefix">$</span>
                <input
                  id="cost-per-visit"
                  type="number"
                  className="form-input cost-input"
                  min="0"
                  step="1"
                  value={costPerVisit}
                  onChange={(e) => setCostPerVisit(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn--primary" disabled={costSaving}>
                {costSaving ? 'Saving...' : costSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
            <p className="cost-hint">Per-visit rate used to estimate the cost of care provided. Default is $50.</p>
          </div>
          {costError && <p className="settings-error">{costError}</p>}
        </form>
      </div>

      <div className="settings-card">
        <h2 className="settings-section-title">School Logo</h2>
        <p className="settings-hint">
          Appears in the top-left corner of the navigation bar. PNG, JPG, WebP, or SVG. Max 2 MB.
        </p>

        <div className="logo-section">
          {branding?.logoUrl ? (
            <div className="logo-preview-row">
              <div className="logo-preview">
                <img src={branding.logoUrl} alt="School logo" />
              </div>
              <div className="logo-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? 'Uploading...' : 'Replace Logo'}
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={handleRemoveLogo}
                  disabled={logoRemoving}
                >
                  {logoRemoving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--outline logo-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
            >
              {logoUploading ? 'Uploading...' : '+ Upload Logo'}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="file-input-hidden"
            onChange={handleFileChange}
          />

          {logoError && <p className="settings-error">{logoError}</p>}
        </div>
      </div>
      <div className="settings-card">
        <h2 className="settings-section-title">Athlete Portal</h2>
        <p className="settings-hint">
          Athletes whose school email domain matches will be auto-associated with your school when
          they sign in with Google. Leave blank to disable domain-based auto-join.
        </p>
        <form onSubmit={handleSaveDomain}>
          <div className="cost-field">
            <label className="cost-label" htmlFor="student-domain">
              Student email domain
            </label>
            <div className="cost-input-row">
              <input
                id="student-domain"
                type="text"
                className="form-input"
                placeholder="e.g. students.schoolname.edu"
                value={studentDomain}
                onChange={(e) => setStudentDomain(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn--primary" disabled={domainSaving}>
                {domainSaving ? 'Saving...' : domainSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
          {domainError && <p className="settings-error">{domainError}</p>}
        </form>
      </div>

      {isAdmin && (
        <div className="settings-card">
          <h2 className="settings-section-title">Coach Sport Assignment</h2>
          <p className="settings-hint">
            Assign a sport to each coach account so they only see athletes, injuries, and treatments
            for their sport when they log in.
          </p>
          {coaches.length === 0 ? (
            <p className="settings-hint" style={{ fontStyle: 'italic' }}>No coach accounts at this school yet.</p>
          ) : (
            <div className="coach-list">
              {coaches.map((coach) => (
                <div key={coach.id} className="coach-row">
                  <span className="coach-email">{coach.email}</span>
                  <select
                    className="form-input coach-sport-select"
                    value={coach.sport ?? ''}
                    onChange={(e) => handleCoachSportChange(coach.id, e.target.value || null)}
                    disabled={coachSportSaving[coach.id]}
                  >
                    <option value="">No sport assigned</option>
                    {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {coachSportSaving[coach.id] && <span className="coach-saving">Saving…</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="settings-card">
        <h2 className="settings-section-title">Auto Daily Report</h2>
        <p className="settings-hint">
          Automatically email a daily injury summary at a set time. Up to 5 recipient addresses.
          Use <strong>Send Now</strong> to test the report immediately.
        </p>
        <form onSubmit={handleSaveReport}>
          <div className="report-toggle-row">
            <label className="coach-email" htmlFor="report-enabled" style={{ cursor: 'pointer' }}>
              Enable auto report
            </label>
            <input
              id="report-enabled"
              type="checkbox"
              checked={reportEnabled}
              onChange={(e) => setReportEnabled(e.target.checked)}
            />
          </div>

          <div className="cost-field" style={{ marginTop: '0.75rem' }}>
            <label className="cost-label" htmlFor="report-time">Send time</label>
            <input
              id="report-time"
              type="time"
              className="form-input"
              value={reportTime}
              onChange={(e) => setReportTime(e.target.value)}
              style={{ width: 140 }}
            />
          </div>

          <div className="cost-field" style={{ marginTop: '0.75rem' }}>
            <label className="cost-label">Recipient email addresses</label>
            {reportRecipients.map((r, i) => (
              <input
                key={i}
                type="email"
                className="form-input"
                style={{ marginBottom: '0.4rem' }}
                placeholder={`Recipient ${i + 1}`}
                value={r}
                onChange={(e) => {
                  const next = [...reportRecipients];
                  next[i] = e.target.value;
                  setReportRecipients(next);
                }}
              />
            ))}
          </div>

          {reportError && <p className="settings-error">{reportError}</p>}
          {reportSendMsg && (
            <p className="settings-hint" style={{ color: reportSendMsg.includes('error') || reportSendMsg.includes('No ') ? 'var(--color-danger)' : '#166534' }}>
              {reportSendMsg}
            </p>
          )}

          <div className="cost-input-row" style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn--primary" disabled={reportSaving}>
              {reportSaving ? 'Saving...' : reportSaved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleSendNow}
              disabled={reportSending}
            >
              {reportSending ? 'Sending…' : 'Send Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
