import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import './Reports.css';

// ── Constants ────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'athlete_profile',    label: 'Athlete Profile',        desc: 'Basic info, sport, grade, and emergency contact' },
  { key: 'injury_summary',     label: 'Injury Summary',         desc: 'Active injuries with body part, severity, and date' },
  { key: 'treatment_log',      label: 'Treatment Log',          desc: 'All treatments within the selected date range' },
  { key: 'rtp_status',         label: 'Return to Play Status',  desc: 'Current RTP status for all active injuries' },
  { key: 'soap_notes',         label: 'SOAP Notes',             desc: 'Clinical notes within the selected date range' },
  { key: 'concussion_history', label: 'Concussion History',     desc: 'Active or recent concussion cases' },
];

const DATE_PRESETS = [
  { key: '7d',     label: 'Last 7 days' },
  { key: '30d',    label: 'Last 30 days' },
  { key: 'season', label: 'This season' },
  { key: 'custom', label: 'Custom range' },
];

// ── Helpers ──────────────────────────────────────────────────────────
function getPresetDates(preset) {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  if (preset === '7d') {
    const f = new Date(today); f.setDate(f.getDate() - 7);
    return { from: fmt(f), to: fmt(today) };
  }
  if (preset === '30d') {
    const f = new Date(today); f.setDate(f.getDate() - 30);
    return { from: fmt(f), to: fmt(today) };
  }
  if (preset === 'season') {
    const yr = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
    return { from: `${yr}-08-01`, to: fmt(today) };
  }
  return null;
}

function fmtDate(str) {
  if (!str) return '—';
  const clean = str.split('T')[0];
  const [y, m, d] = clean.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── PDF Builder ──────────────────────────────────────────────────────
async function buildPDF(report) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 48, MR = 48, MT = 48, MB = 44;
  const CW = PW - ML - MR;

  const PRIMARY  = [29, 111, 165];
  const C_TEXT   = [26, 26, 46];
  const C_MUTED  = [107, 114, 128];
  const C_BORDER = [209, 213, 219];
  const C_BG     = [245, 247, 250];
  const C_LIGHT  = [232, 244, 253];
  const WHITE    = [255, 255, 255];

  let y = MT;

  function contPageHeader() {
    doc.setDrawColor(...C_BORDER);
    doc.line(ML, 34, PW - MR, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.text('FIELDSIDE ATHLETIC TRAINING REPORT', ML, 27);
    doc.text(report.school_name, PW - MR, 27, { align: 'right' });
    y = 50;
  }

  function checkY(needed = 40) {
    if (y + needed > PH - MB - 10) {
      doc.addPage();
      contPageHeader();
    }
  }

  function sectionHeader(title) {
    checkY(28);
    doc.setFillColor(...C_LIGHT);
    doc.rect(ML, y, CW, 14, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(ML, y, 3, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PRIMARY);
    doc.text(title.toUpperCase(), ML + 9, y + 9.5);
    y += 18;
  }

  function emptyNote(msg) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text(msg, ML + 6, y);
    y += 14;
  }

  function tbl(opts) {
    autoTable(doc, { ...opts, startY: y, margin: { left: ML, right: MR } });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  const HEAD_STYLE = {
    fillColor: PRIMARY, textColor: WHITE,
    fontSize: 7.5, fontStyle: 'bold', cellPadding: 4,
  };
  const BODY_STYLE = { fontSize: 8, textColor: C_TEXT, cellPadding: 3.5 };
  const ALT_ROW    = { fillColor: [248, 250, 252] };

  // ── Cover page ───────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(ML, y, CW, 4, 'F');
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...PRIMARY);
  doc.text('FIELDSIDE', ML, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...C_TEXT);
  doc.text('Athletic Training Report', ML, y + 14);
  y += 34;

  const genDate = new Date(report.generated_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const metaRows = [
    ['School',       report.school_name],
    ['Generated',    genDate],
    ['Prepared by',  report.at_email],
    ['Date range',   `${fmtDate(report.date_from)} – ${fmtDate(report.date_to)}`],
  ];
  if (report.recipient_name) {
    const recip = report.recipient_role
      ? `${report.recipient_name}, ${report.recipient_role}`
      : report.recipient_name;
    metaRows.push(['Submitted to', recip]);
  }
  if (report.notes) {
    metaRows.push(['Notes', report.notes]);
  }

  autoTable(doc, {
    body: metaRows,
    startY: y,
    margin: { left: ML, right: MR },
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 0, right: 4 }, textColor: C_TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 90, textColor: C_MUTED },
      1: { cellWidth: CW - 90 },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 14;

  doc.setDrawColor(...C_BORDER);
  doc.line(ML, y, PW - MR, y);
  y += 22;

  // ── Per-athlete sections ─────────────────────────────────────────
  for (let ai = 0; ai < report.athletes.length; ai++) {
    const ath  = report.athletes[ai];
    const secs = report.sections;

    checkY(72);

    // Athlete nameplate
    doc.setFillColor(...C_BG);
    doc.rect(ML, y, CW, 24, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(ML, y, 4, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C_TEXT);
    doc.text(ath.profile.name, ML + 12, y + 15);

    const meta2 = [
      ath.profile.sport,
      ath.profile.grade ? `Grade ${ath.profile.grade}` : null,
    ].filter(Boolean).join(' · ');
    if (meta2) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C_MUTED);
      doc.text(meta2, PW - MR - 4, y + 15, { align: 'right' });
    }
    y += 30;

    // Athlete Profile
    if (secs.includes('athlete_profile')) {
      sectionHeader('Athlete Profile');
      const p = ath.profile;
      const rows = [
        p.sport               && ['Sport',             p.sport],
        p.grade               && ['Grade',             p.grade],
        p.date_of_birth       && ['Date of birth',     fmtDate(p.date_of_birth)],
        p.emergency_contact_name  && ['Emergency contact', p.emergency_contact_name],
        p.emergency_contact_phone && ['Emergency phone',   p.emergency_contact_phone],
      ].filter(Boolean);
      rows.length
        ? tbl({
            body: rows,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 4 }, textColor: C_TEXT },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120, textColor: C_MUTED }, 1: {} },
          })
        : emptyNote('No profile data on record.');
    }

    // Injury Summary
    if (secs.includes('injury_summary')) {
      sectionHeader('Injury Summary');
      ath.injuries.length
        ? tbl({
            head: [['Date', 'Body Part', 'Type', 'Severity', 'Status']],
            body: ath.injuries.map(i => [
              fmtDate(i.injury_date),
              i.body_part    ?? '—',
              i.injury_type  ?? '—',
              i.severity     ?? '—',
              i.is_active ? 'Active' : 'Resolved',
            ]),
            theme: 'striped',
            headStyles: HEAD_STYLE, bodyStyles: BODY_STYLE, alternateRowStyles: ALT_ROW,
          })
        : emptyNote('No injuries on record for this date range.');
    }

    // Treatment Log
    if (secs.includes('treatment_log')) {
      sectionHeader('Treatment Log');
      ath.treatments.length
        ? tbl({
            head: [['Date', 'Treatment Type', 'Body Part', 'Duration', 'Notes']],
            body: ath.treatments.map(t => [
              fmtDate(t.date),
              t.treatment_type     ?? '—',
              t.body_part          ?? '—',
              t.duration_minutes   ? `${t.duration_minutes} min` : '—',
              t.notes              ?? '—',
            ]),
            theme: 'striped',
            headStyles: HEAD_STYLE, bodyStyles: BODY_STYLE, alternateRowStyles: ALT_ROW,
            columnStyles: { 4: { cellWidth: 'auto' } },
          })
        : emptyNote('No treatments in this date range.');
    }

    // RTP Status
    if (secs.includes('rtp_status')) {
      sectionHeader('Return to Play Status');
      const active = ath.injuries.filter(i => i.is_active);
      active.length
        ? tbl({
            head: [['Body Part', 'Injury Type', 'Date of Injury', 'RTP Status', 'Notes']],
            body: active.map(i => [
              i.body_part   ?? '—',
              i.injury_type ?? '—',
              fmtDate(i.injury_date),
              i.rtp_status  ?? '—',
              i.notes       ?? '—',
            ]),
            theme: 'striped',
            headStyles: HEAD_STYLE, bodyStyles: BODY_STYLE, alternateRowStyles: ALT_ROW,
          })
        : emptyNote('No active injuries.');
    }

    // SOAP Notes
    if (secs.includes('soap_notes')) {
      sectionHeader('SOAP Notes');
      if (!ath.soap_notes.length) {
        emptyNote('No SOAP notes in this date range.');
      } else {
        for (const note of ath.soap_notes) {
          checkY(60);
          const nd = new Date(note.authored_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...C_TEXT);
          doc.text(`${(note.note_type ?? 'SOAP').toUpperCase()} — ${nd}`, ML + 4, y);
          y += 12;

          const rows = [
            ['Chief Complaint', note.chief_complaint],
            ['Observation',     note.observation],
            ['Assessment',      note.assessment],
            ['Treatment Plan',  note.treatment_plan],
            ['Restrictions',    note.restrictions],
            ['RTP Timeline',    note.rtp_timeline],
            ['Referral',        note.referral],
          ].filter(([, v]) => v);

          if (rows.length) {
            tbl({
              body: rows,
              theme: 'plain',
              styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 4 }, textColor: C_TEXT },
              columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: C_MUTED }, 1: {} },
            });
          }
          y += 4;
        }
      }
    }

    // Concussion History
    if (secs.includes('concussion_history')) {
      sectionHeader('Concussion History');
      ath.concussions.length
        ? tbl({
            head: [['Date of Injury', 'Mechanism', 'LOC', 'Status', 'RTP Step']],
            body: ath.concussions.map(c => [
              fmtDate(c.injury_date),
              c.mechanism ?? '—',
              c.loss_of_consciousness
                ? `Yes${c.loc_duration_seconds ? ` (${c.loc_duration_seconds}s)` : ''}`
                : 'No',
              c.status
                ? c.status.charAt(0).toUpperCase() + c.status.slice(1)
                : '—',
              c.current_step ?? 1,
            ]),
            theme: 'striped',
            headStyles: HEAD_STYLE, bodyStyles: BODY_STYLE, alternateRowStyles: ALT_ROW,
          })
        : emptyNote('No concussion cases recorded.');
    }

    // Divider between athletes
    y += 10;
    if (ai < report.athletes.length - 1) {
      checkY(16);
      doc.setDrawColor(...C_BORDER);
      doc.line(ML, y, PW - MR, y);
      y += 18;
    }
  }

  // ── Page footers (post-hoc) ──────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C_BORDER);
    doc.line(ML, PH - 30, PW - MR, PH - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.text('Confidential — For medical use only', ML, PH - 18);
    doc.text(`Page ${i} of ${totalPages}`, PW - MR, PH - 18, { align: 'right' });
  }

  doc.save(`fieldside-report-${report.date_from}-to-${report.date_to}.pdf`);
}

// ── Component ────────────────────────────────────────────────────────
export default function Reports() {
  const [step, setStep]                   = useState(1);

  // Step 1
  const [selMode, setSelMode]             = useState('athlete');
  const [athletes, setAthletes]           = useState([]);
  const [teams, setTeams]                 = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId]       = useState('');
  const [datePreset, setDatePreset]       = useState('30d');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [loadingData, setLoadingData]     = useState(true);

  // Step 2
  const [sections, setSections] = useState([
    'athlete_profile', 'injury_summary', 'treatment_log', 'rtp_status',
  ]);

  // Step 3
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [notes, setNotes]                 = useState('');
  const [generating, setGenerating]       = useState(false);
  const [error, setError]                 = useState(null);
  const [done, setDone]                   = useState(false);

  // Load athletes + teams
  useEffect(() => {
    Promise.all([api.get('/api/athletes'), api.get('/api/teams')])
      .then(([ar, tr]) => {
        setAthletes(ar.data ?? []);
        setTeams(tr.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, []);

  // Sync date preset → dates
  useEffect(() => {
    const d = getPresetDates(datePreset);
    if (d) { setDateFrom(d.from); setDateTo(d.to); }
  }, [datePreset]);

  // Init date range
  useEffect(() => {
    const d = getPresetDates('30d');
    setDateFrom(d.from);
    setDateTo(d.to);
  }, []);

  const filteredAthletes = athletes.filter(a =>
    a.name.toLowerCase().includes(athleteSearch.toLowerCase())
  );

  const canStep1 = (
    (selMode === 'athlete' ? !!selectedAthleteId : !!selectedTeamId)
    && !!dateFrom && !!dateTo
  );
  const canStep2 = sections.length > 0;

  function toggleSection(key) {
    setSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setDone(false);
    try {
      const { data } = await api.post('/api/reports/generate', {
        athleteIds:    selMode === 'athlete' ? [selectedAthleteId] : [],
        teamId:        selMode === 'team'    ? selectedTeamId       : null,
        dateFrom, dateTo, sections,
        recipientName: recipientName.trim() || null,
        recipientRole: recipientRole.trim() || null,
        notes:         notes.trim()         || null,
      });
      await buildPDF(data);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Selected athlete label
  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);
  const selectedTeam    = teams.find(t => t.id === selectedTeamId);

  return (
    <div className="rp-page">
      <div className="rp-header">
        <h1 className="rp-title">Report Builder</h1>
        <p className="rp-subtitle">Generate a customizable PDF report for athletes or teams.</p>
      </div>

      {/* Stepper */}
      <div className="rp-stepper">
        {['Select Athletes', 'Report Sections', 'Generate'].map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done2  = n < step;
          return (
            <div key={n} className="rp-step-wrap">
              {i > 0 && <div className={`rp-step-line${done2 || active ? ' filled' : ''}`} />}
              <div className={`rp-step${active ? ' active' : done2 ? ' done' : ''}`}>
                <div className="rp-step-circle">
                  {done2 ? '✓' : n}
                </div>
                <span className="rp-step-label">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Select Athletes ── */}
      {step === 1 && (
        <div className="rp-card">
          <h2 className="rp-card-title">Select Athletes</h2>

          <div className="rp-seg-control">
            <button
              className={`rp-seg-btn${selMode === 'athlete' ? ' active' : ''}`}
              onClick={() => setSelMode('athlete')}
            >
              Single Athlete
            </button>
            <button
              className={`rp-seg-btn${selMode === 'team' ? ' active' : ''}`}
              onClick={() => setSelMode('team')}
            >
              Entire Team
            </button>
          </div>

          {loadingData ? (
            <div className="rp-loading">Loading…</div>
          ) : selMode === 'athlete' ? (
            <div className="rp-form-group">
              <label className="rp-label">Athlete</label>
              <input
                type="text"
                className="rp-input"
                placeholder="Search athlete name…"
                value={athleteSearch}
                onChange={e => { setAthleteSearch(e.target.value); setSelectedAthleteId(''); }}
              />
              {athleteSearch && !selectedAthleteId && (
                <div className="rp-dropdown">
                  {filteredAthletes.length === 0 ? (
                    <div className="rp-dropdown-empty">No athletes found.</div>
                  ) : (
                    filteredAthletes.slice(0, 8).map(a => (
                      <button
                        key={a.id}
                        className="rp-dropdown-item"
                        onClick={() => { setSelectedAthleteId(a.id); setAthleteSearch(a.name); }}
                      >
                        <span className="rp-dropdown-name">{a.name}</span>
                        {a.sport && <span className="rp-dropdown-meta">{a.sport}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedAthlete && (
                <div className="rp-selection-badge">
                  <span>{selectedAthlete.name}</span>
                  {selectedAthlete.sport && <span className="rp-badge-meta">{selectedAthlete.sport}</span>}
                  <button className="rp-clear-btn" onClick={() => { setSelectedAthleteId(''); setAthleteSearch(''); }}>×</button>
                </div>
              )}
            </div>
          ) : (
            <div className="rp-form-group">
              <label className="rp-label">Team</label>
              <select
                className="rp-input"
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
              >
                <option value="">Select a team…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.sport ? ` — ${t.sport}` : ''} ({t.athlete_count} athletes)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rp-form-group" style={{ marginTop: '1.5rem' }}>
            <label className="rp-label">Date Range</label>
            <div className="rp-preset-row">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.key}
                  className={`rp-preset-btn${datePreset === p.key ? ' active' : ''}`}
                  onClick={() => setDatePreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="rp-date-row">
                <div className="rp-form-group">
                  <label className="rp-label-sm">From</label>
                  <input type="date" className="rp-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="rp-form-group">
                  <label className="rp-label-sm">To</label>
                  <input type="date" className="rp-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            )}
            {datePreset !== 'custom' && dateFrom && (
              <div className="rp-date-preview">
                {fmtDate(dateFrom)} – {fmtDate(dateTo)}
              </div>
            )}
          </div>

          <div className="rp-actions">
            <button
              className="btn btn--primary"
              onClick={() => setStep(2)}
              disabled={!canStep1}
            >
              Next: Choose Sections →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Report Sections ── */}
      {step === 2 && (
        <div className="rp-card">
          <h2 className="rp-card-title">Report Sections</h2>
          <p className="rp-card-desc">Choose which sections to include in the PDF.</p>

          <div className="rp-sections-grid">
            {SECTIONS.map(s => (
              <label
                key={s.key}
                className={`rp-section-card${sections.includes(s.key) ? ' checked' : ''}`}
              >
                <input
                  type="checkbox"
                  className="rp-checkbox"
                  checked={sections.includes(s.key)}
                  onChange={() => toggleSection(s.key)}
                />
                <div className="rp-section-info">
                  <span className="rp-section-label">{s.label}</span>
                  <span className="rp-section-desc">{s.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="rp-actions rp-actions--split">
            <button className="btn btn--ghost" onClick={() => setStep(1)}>← Back</button>
            <button
              className="btn btn--primary"
              onClick={() => setStep(3)}
              disabled={!canStep2}
            >
              Next: Generate →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Details + Generate ── */}
      {step === 3 && (
        <div className="rp-card">
          <h2 className="rp-card-title">Report Details</h2>

          {/* Summary */}
          <div className="rp-summary">
            <div className="rp-summary-row">
              <span className="rp-summary-label">Athlete / Team</span>
              <span className="rp-summary-val">
                {selMode === 'athlete'
                  ? selectedAthlete?.name ?? '—'
                  : selectedTeam?.name    ?? '—'}
              </span>
            </div>
            <div className="rp-summary-row">
              <span className="rp-summary-label">Date Range</span>
              <span className="rp-summary-val">{fmtDate(dateFrom)} – {fmtDate(dateTo)}</span>
            </div>
            <div className="rp-summary-row">
              <span className="rp-summary-label">Sections</span>
              <span className="rp-summary-val">
                {sections
                  .map(k => SECTIONS.find(s => s.key === k)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          </div>

          <div className="rp-form-row">
            <div className="rp-form-group">
              <label className="rp-label">Recipient Name <span className="rp-optional">(optional)</span></label>
              <input
                type="text"
                className="rp-input"
                placeholder="Dr. Smith"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
              />
            </div>
            <div className="rp-form-group">
              <label className="rp-label">Recipient Role <span className="rp-optional">(optional)</span></label>
              <input
                type="text"
                className="rp-input"
                placeholder="Team Physician"
                value={recipientRole}
                onChange={e => setRecipientRole(e.target.value)}
              />
            </div>
          </div>

          <div className="rp-form-group">
            <label className="rp-label">Additional Notes <span className="rp-optional">(optional)</span></label>
            <textarea
              className="rp-input rp-textarea"
              rows={3}
              placeholder="Any additional context for the recipient…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <div className="rp-error" role="alert">{error}</div>}

          {done && (
            <div className="rp-success">
              PDF downloaded successfully.
            </div>
          )}

          <div className="rp-actions rp-actions--split">
            <button className="btn btn--ghost" onClick={() => setStep(2)} disabled={generating}>← Back</button>
            <button
              className="btn btn--primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generating PDF…' : 'Generate & Download PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
