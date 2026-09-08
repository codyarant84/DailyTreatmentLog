import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Settings.css';

const ORG_TYPE_LABELS = {
  high_school: 'High School',
  college: 'College',
  semi_pro: 'Semi-Pro / Professional',
  club: 'Club / Youth',
};

const HS_GRADE_ORDER = ['6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const COLLEGE_GRADE_ORDER = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6+'];

const DEFAULT_COLOR = '#1d6fa5';

const SPORTS = [
  'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
  'Volleyball', 'Tennis', 'Track & Field', 'Cross Country', 'Swimming & Diving',
  'Wrestling', 'Golf', 'Lacrosse', 'Ice Hockey', 'Gymnastics',
  'Cheerleading', 'Dance', 'Bowling', 'Rugby', 'Water Polo',
  'Field Hockey', 'Skiing / Snowboarding', 'Other',
];

const TWILIO_SMS_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER || 'the Fieldside SMS number';

function AddPhoneModal({ onClose, onVerified }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSendCode(e) {
    e.preventDefault();
    if (!phone.trim()) { setError('Enter a phone number.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/phone-numbers', { phone_number: phone.trim() });
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!code.trim()) { setError('Enter the verification code.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/phone-numbers/verify', { phone_number: phone.trim(), code: code.trim() });
      onVerified(data);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Phone Number</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {step === 'phone' ? (
          <form className="modal-form" onSubmit={handleSendCode} noValidate>
            {error && <div className="form-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          </form>
        ) : (
          <form className="modal-form" onSubmit={handleVerify} noValidate>
            {error && <div className="form-error">{error}</div>}
            <p className="settings-hint" style={{ margin: 0 }}>
              We texted a 6-digit code to {phone}. Enter it below to verify.
            </p>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { branding, setBranding, isAdmin, role } = useAuth();
  const canManageCoaches = isAdmin || role === 'trainer';

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

  // ── SMS Injury Logging (at_phone_numbers) ───────────────────────────
  const [smsNumbers, setSmsNumbers] = useState([]);
  const [smsLoading, setSmsLoading] = useState(true);
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);

  const loadSmsNumbers = () => {
    setSmsLoading(true);
    api.get('/api/phone-numbers')
      .then(({ data }) => setSmsNumbers(data))
      .catch(() => {})
      .finally(() => setSmsLoading(false));
  };

  useEffect(() => { loadSmsNumbers(); }, []);

  async function handleRemovePhone(id) {
    if (!confirm('Remove this phone number from SMS injury logging?')) return;
    try {
      await api.delete(`/api/phone-numbers/${id}`);
      setSmsNumbers((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      alert(err.response?.data?.error ?? err.message);
    }
  }

  // ── Organization Settings ──────────────────────────────────────────
  const [orgType, setOrgType] = useState(branding?.organizationType ?? 'high_school');
  const [maxYears, setMaxYears] = useState(String(branding?.maxYears ?? 4));
  const [retentionYears, setRetentionYears] = useState(
    branding?.archiveRetentionYears == null ? 'forever' : String(branding.archiveRetentionYears)
  );
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [orgError, setOrgError] = useState(null);

  async function handleSaveOrgSettings(e) {
    e.preventDefault();
    setOrgError(null);
    setOrgSaved(false);
    setOrgSaving(true);
    try {
      const payload = {
        organization_type: orgType,
        archive_retention_years: retentionYears === 'forever' ? null : Number(retentionYears),
      };
      if (orgType === 'college') payload.max_years = Number(maxYears);

      const { data } = await api.put('/api/school/settings', payload);
      setBranding((prev) => ({
        ...prev,
        organizationType: data.organization_type,
        maxYears: data.max_years,
        archiveRetentionYears: data.archive_retention_years,
      }));
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2500);
    } catch (err) {
      setOrgError(err.response?.data?.error ?? err.message);
    } finally {
      setOrgSaving(false);
    }
  }

  // ── School Year Management ─────────────────────────────────────────
  const showYearMgmt = orgType === 'high_school' || orgType === 'college';

  const [yearAthletes, setYearAthletes] = useState([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [archiveCandidates, setArchiveCandidates] = useState(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceResult, setAdvanceResult] = useState(null);
  const [advanceError, setAdvanceError] = useState(null);

  const loadYearData = () => {
    setYearLoading(true);
    Promise.all([
      api.get('/api/athletes'),
      api.get('/api/school/archive-candidates'),
    ])
      .then(([athletesRes, candidatesRes]) => {
        setYearAthletes(athletesRes.data);
        setArchiveCandidates(candidatesRes.data);
      })
      .catch(() => {})
      .finally(() => setYearLoading(false));
  };

  useEffect(() => {
    if (!showYearMgmt) return;
    loadYearData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showYearMgmt]);

  const gradeCounts = yearAthletes.reduce((acc, a) => {
    if (a.grade) acc[a.grade] = (acc[a.grade] ?? 0) + 1;
    return acc;
  }, {});
  const gradeOrder = orgType === 'college' ? COLLEGE_GRADE_ORDER : HS_GRADE_ORDER;
  const distribution = gradeOrder.filter((g) => gradeCounts[g]).map((g) => [g, gradeCounts[g]]);
  const graduatingCount = orgType === 'high_school'
    ? yearAthletes.filter((a) => a.grade === '12th' && !a.eligibility_override).length
    : 0;

  async function handleAdvanceYear() {
    setAdvancing(true);
    setAdvanceError(null);
    try {
      const { data } = await api.post('/api/school/advance-year');
      setAdvanceResult(data);
      setShowAdvanceModal(false);
      loadYearData();
      setTimeout(() => setAdvanceResult(null), 6000);
    } catch (err) {
      setAdvanceError(err.response?.data?.error ?? err.message);
      setShowAdvanceModal(false);
    } finally {
      setAdvancing(false);
    }
  }

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoRemoving, setLogoRemoving] = useState(false);

  const fileInputRef = useRef(null);

  // ── Coaches ────────────────────────────────────────────────────────
  const [coaches, setCoaches] = useState([]);
  const [coachSportSaving, setCoachSportSaving] = useState({});

  useEffect(() => {
    if (!canManageCoaches) return;
    api.get('/api/school/coaches').then(({ data }) => setCoaches(data)).catch(() => {});
  }, [canManageCoaches]);

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
        <h2 className="settings-section-title">Organization Settings</h2>
        <p className="settings-hint">
          Controls grade/year terminology across the roster and how school-year advancement behaves.
        </p>

        <form className="org-settings-form" onSubmit={handleSaveOrgSettings}>
          <div className="form-group">
            <label className="form-label">Organization Type</label>
            <select className="form-input" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {orgType === 'college' && (
            <div className="form-group">
              <label className="form-label">Max Years</label>
              <input
                type="number"
                min="4"
                max="6"
                className="form-input"
                style={{ width: 100 }}
                value={maxYears}
                onChange={(e) => setMaxYears(e.target.value)}
              />
              <p className="cost-hint">
                Informational only — Advance School Year always caps athletes at "Year 6+" regardless of this value.
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Archive Retention Period</label>
            <select className="form-input" value={retentionYears} onChange={(e) => setRetentionYears(e.target.value)}>
              <option value="1">1 year</option>
              <option value="2">2 years</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
              <option value="7">7 years</option>
              <option value="forever">Forever</option>
            </select>
            <p className="cost-hint">How long archived athletes are kept before becoming eligible for permanent deletion.</p>
          </div>

          {orgError && <p className="settings-error">{orgError}</p>}

          <button type="submit" className="btn btn--primary" disabled={orgSaving} style={{ alignSelf: 'flex-start' }}>
            {orgSaving ? 'Saving...' : orgSaved ? 'Saved!' : 'Save'}
          </button>
        </form>
      </div>

      {showYearMgmt && (
        <div className="settings-card">
          <h2 className="settings-section-title">School Year Management</h2>

          {yearLoading ? (
            <p className="settings-hint">Loading roster…</p>
          ) : distribution.length > 0 ? (
            <p className="settings-hint">
              {distribution
                .map(([g, n]) => `${n} athlete${n !== 1 ? 's' : ''} in ${g}${orgType === 'high_school' ? ' grade' : ''}`)
                .join(' · ')}
            </p>
          ) : (
            <p className="settings-hint">No active athletes on the roster yet.</p>
          )}

          <button
            type="button"
            className="btn btn--outline"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setShowAdvanceModal(true)}
          >
            Advance School Year
          </button>

          {advanceResult && (
            <p className="settings-hint" style={{ color: '#166534' }}>
              Advanced {advanceResult.advanced} athlete{advanceResult.advanced !== 1 ? 's' : ''}.
              {advanceResult.archived > 0 && ` Archived ${advanceResult.archived} graduating athlete${advanceResult.archived !== 1 ? 's' : ''}.`}
            </p>
          )}
          {advanceError && <p className="settings-error">{advanceError}</p>}

          <div className="archive-candidates-row">
            <div>
              <p className="cost-label" style={{ margin: 0 }}>Eligible for Permanent Deletion</p>
              <p className="cost-hint">
                {archiveCandidates === null
                  ? 'Loading…'
                  : archiveCandidates.retention_years === null
                    ? 'Retention is set to Forever — nothing is eligible.'
                    : `${archiveCandidates.count} athlete${archiveCandidates.count !== 1 ? 's' : ''} archived over ${archiveCandidates.retention_years} year${archiveCandidates.retention_years !== 1 ? 's' : ''} ago.`}
              </p>
            </div>
            <Link to="/athletes?tab=archived" className="btn btn--outline btn--sm">Review &amp; Delete</Link>
          </div>
        </div>
      )}

      {showAdvanceModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowAdvanceModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">Advance School Year</h2>
              <button className="modal-close" onClick={() => setShowAdvanceModal(false)} aria-label="Close">✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {orgType === 'high_school' ? (
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  This will advance all athletes one grade level and archive {graduatingCount} graduating athlete{graduatingCount !== 1 ? 's' : ''}. This cannot be undone. Are you sure?
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    This will advance all athletes one year (capped at Year 6+). This cannot be undone. Are you sure?
                  </p>
                  <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Note: College athletes are never automatically archived. Use the Athletes page to manually archive athletes who have exhausted their eligibility.
                  </p>
                </>
              )}
              <div className="modal-actions">
                <button className="btn btn--ghost" onClick={() => setShowAdvanceModal(false)} disabled={advancing}>Cancel</button>
                <button className="btn btn--primary" onClick={handleAdvanceYear} disabled={advancing}>
                  {advancing ? 'Advancing…' : 'Advance Year'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="settings-card">
        <h2 className="settings-section-title">SMS Injury Logging</h2>
        <p className="settings-hint">
          Text an injury description to <strong>{TWILIO_SMS_NUMBER}</strong> and Fieldside will use AI to
          draft an injury record automatically. Register your phone number below to use it.
        </p>

        {showAddPhoneModal && (
          <AddPhoneModal
            onClose={() => setShowAddPhoneModal(false)}
            onVerified={(number) => { setSmsNumbers((prev) => [number, ...prev]); setShowAddPhoneModal(false); }}
          />
        )}

        {smsLoading ? (
          <p className="settings-hint">Loading…</p>
        ) : smsNumbers.length === 0 ? (
          <p className="settings-hint" style={{ fontStyle: 'italic' }}>No phone numbers registered yet.</p>
        ) : (
          <div className="sms-number-list">
            {smsNumbers.map((n) => (
              <div key={n.id} className="sms-number-row">
                <span className="sms-number-value">{n.phone_number}</span>
                <span className={`sms-verified-badge${n.verified ? ' sms-verified-badge--verified' : ''}`}>
                  {n.verified ? 'Verified' : 'Pending verification'}
                </span>
                <button className="btn btn--sm btn--danger-ghost" onClick={() => handleRemovePhone(n.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn--outline"
          style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
          onClick={() => setShowAddPhoneModal(true)}
        >
          + Add Phone Number
        </button>

        <p className="sms-disclaimer">
          SMS messages are not end-to-end encrypted. By using this feature you acknowledge that injury
          information sent via SMS may not be fully HIPAA compliant. Use at your own discretion.
        </p>
      </div>

      {canManageCoaches && (
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
