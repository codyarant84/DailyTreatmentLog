import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { parseCsvFile, FIELD_LABELS, detectColumnMap } from '../lib/parseCsv.js';
import api from '../lib/api.js';
import './ImportAthletes.css';

const PREVIEW_LIMIT = 10;

function ColChip({ field, columnMap }) {
  const found = Boolean(columnMap[field]);
  const required = field === 'name';
  return (
    <div className={`col-chip ${found ? 'col-chip--found' : required ? 'col-chip--missing' : 'col-chip--optional'}`}>
      <span className="col-chip-icon">{found ? '✓' : '○'}</span>
      <span className="col-chip-label">{FIELD_LABELS[field]}</span>
      {found && <span className="col-chip-src">← "{columnMap[field]}"</span>}
    </div>
  );
}

function formatDob(iso) {
  if (!iso) return <span className="cell-empty">—</span>;
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ImportAthletes() {
  const [step, setStep]               = useState('upload');   // 'upload' | 'preview' | 'result'
  const [dragOver, setDragOver]       = useState(false);
  const [fileError, setFileError]     = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  // ── File handling ──────────────────────────────────────────────────────────

  function processFile(file) {
    setFileError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCsvFile(e.target.result);
      if (result.error) {
        setFileError(result.error);
        return;
      }
      if (result.rows.length === 0) {
        setFileError('No valid athlete rows found in this file. Make sure each row has a name.');
        return;
      }
      setParseResult(result);
      setStep('preview');
    };
    reader.onerror = () => setFileError('Could not read the file.');
    reader.readAsText(file);
  }

  function handleFileInput(e) {
    processFile(e.target.files[0]);
    e.target.value = ''; // reset so the same file can be re-selected
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function reset() {
    setStep('upload');
    setParseResult(null);
    setImportResult(null);
    setImportError(null);
    setFileError(null);
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImportError(null);
    setImporting(true);
    try {
      const { data } = await api.post('/api/athletes/import', { rows: parseResult.rows });
      setImportResult(data);
      setStep('result');
    } catch (err) {
      setImportError(err.response?.data?.error ?? 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Step 1 — Upload
  if (step === 'upload') {
    return (
      <div className="import-page">
        <div className="import-header">
          <div>
            <h1 className="page-title">Import Athletes</h1>
            <p className="page-subtitle">Upload a CSV file to add athletes to your school roster.</p>
          </div>
          <Link to="/athletes" className="back-link">← Roster</Link>
        </div>

        <div className="import-body">
          {/* Drop zone */}
          <div
            className={`drop-zone ${dragOver ? 'drop-zone--over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            aria-label="Click or drag a CSV file here to upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="file-input-hidden"
              onChange={handleFileInput}
            />
            <div className="drop-icon">📄</div>
            <p className="drop-title">Click to browse or drag &amp; drop a CSV</p>
            <p className="drop-hint">.csv files only · max 500 rows</p>
          </div>

          {fileError && (
            <div className="import-error" role="alert">{fileError}</div>
          )}

          {/* Expected format card */}
          <div className="format-card">
            <h3 className="format-title">Expected CSV format</h3>
            <p className="format-desc">
              The first row should be column headers. Column names are flexible — common variations are
              detected automatically.
            </p>
            <div className="format-table-wrap">
              <table className="format-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Accepted names</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Athlete Name</strong></td>
                    <td><span className="badge badge--required">Required</span></td>
                    <td className="cell-mono">name, athlete, athlete_name, full name</td>
                  </tr>
                  <tr>
                    <td>Sport</td>
                    <td><span className="badge badge--optional">Optional</span></td>
                    <td className="cell-mono">sport, team, activity</td>
                  </tr>
                  <tr>
                    <td>Grade</td>
                    <td><span className="badge badge--optional">Optional</span></td>
                    <td className="cell-mono">grade, year, class</td>
                  </tr>
                  <tr>
                    <td>Date of Birth</td>
                    <td><span className="badge badge--optional">Optional</span></td>
                    <td className="cell-mono">dob, date_of_birth, birth date — MM/DD/YYYY or YYYY-MM-DD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2 — Preview
  if (step === 'preview') {
    const { columnMap, rows, warnings } = parseResult;
    const preview = rows.slice(0, PREVIEW_LIMIT);
    const hasName  = Boolean(columnMap.name);

    return (
      <div className="import-page">
        <div className="import-header">
          <div>
            <h1 className="page-title">Preview Import</h1>
            <p className="page-subtitle">
              {rows.length} athlete{rows.length !== 1 ? 's' : ''} ready to import
            </p>
          </div>
          <button className="back-link" onClick={reset}>← Start Over</button>
        </div>

        <div className="import-body">
          {/* Column detection */}
          <div className="section-card">
            <h3 className="section-title">Detected columns</h3>
            <div className="col-chips">
              {Object.keys(FIELD_LABELS).map((f) => (
                <ColChip key={f} field={f} columnMap={columnMap} />
              ))}
            </div>
            {!hasName && (
              <p className="col-error">
                ✕ A required "name" column was not detected. Please check your CSV headers.
              </p>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="warnings-card">
              <h3 className="section-title">⚠ Warnings ({warnings.length})</h3>
              <ul className="warnings-list">
                {warnings.map((w, i) => <li key={i}>{w.message}</li>)}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="section-card">
            <h3 className="section-title">
              Preview
              {rows.length > PREVIEW_LIMIT && (
                <span className="section-subtitle">
                  {' '}— showing first {PREVIEW_LIMIT} of {rows.length}
                </span>
              )}
            </h3>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Athlete Name</th>
                    {columnMap.sport         && <th>Sport</th>}
                    {columnMap.grade         && <th>Grade</th>}
                    {columnMap.date_of_birth && <th>Date of Birth</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="cell-num">{i + 1}</td>
                      <td className="cell-name">{row.name}</td>
                      {columnMap.sport         && <td>{row.sport ?? <span className="cell-empty">—</span>}</td>}
                      {columnMap.grade         && <td>{row.grade ?? <span className="cell-empty">—</span>}</td>}
                      {columnMap.date_of_birth && <td>{formatDob(row.date_of_birth)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_LIMIT && (
              <p className="preview-more">
                + {rows.length - PREVIEW_LIMIT} more rows not shown
              </p>
            )}
          </div>

          {importError && (
            <div className="import-error" role="alert">{importError}</div>
          )}

          <div className="import-actions">
            <button className="btn btn--ghost" onClick={reset} disabled={importing}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleImport}
              disabled={importing || !hasName}
            >
              {importing
                ? `Importing ${rows.length} athlete${rows.length !== 1 ? 's' : ''}…`
                : `Import ${rows.length} Athlete${rows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3 — Result
  if (step === 'result' && importResult) {
    const { imported, skipped, total } = importResult;
    const allNew      = skipped === 0;
    const allSkipped  = imported === 0;

    return (
      <div className="import-page">
        <div className="import-header">
          <h1 className="page-title">Import Complete</h1>
        </div>

        <div className="import-body">
          <div className={`result-banner ${allSkipped ? 'result-banner--warn' : 'result-banner--success'}`}>
            <div className="result-icon">{allSkipped ? '⚠' : '✓'}</div>
            <div className="result-text">
              {allSkipped
                ? 'All rows were already in the roster — nothing new was added.'
                : allNew
                  ? `All ${imported} athlete${imported !== 1 ? 's' : ''} imported successfully.`
                  : `Import finished — ${imported} added, ${skipped} already existed.`}
            </div>
          </div>

          <div className="result-stats">
            <div className="result-stat">
              <span className="result-stat-value result-stat-value--green">{imported}</span>
              <span className="result-stat-label">Imported</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-value result-stat-value--muted">{skipped}</span>
              <span className="result-stat-label">Skipped (duplicates)</span>
            </div>
            <div className="result-stat">
              <span className="result-stat-value">{total}</span>
              <span className="result-stat-label">Total in file</span>
            </div>
          </div>

          <div className="import-actions">
            <button className="btn btn--ghost" onClick={reset}>
              Import Another File
            </button>
            <Link to="/athletes" className="btn btn--primary">
              View Roster
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
