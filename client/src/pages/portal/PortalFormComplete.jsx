import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalFormComplete.css';

export default function PortalFormComplete() {
  const { assignmentId } = useParams();
  const { getToken } = usePortalAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null); // { assignment, fields, submission }
  const [error, setError] = useState(null);

  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [uploadMode, setUploadMode] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);

  const canvasRef = useRef(null);
  const sigPadRef = useRef(null);
  const fileInputRef = useRef(null);

  const authHeader = useCallback(() => ({
    headers: { Authorization: `Bearer ${getToken()}` },
  }), [getToken]);

  useEffect(() => {
    async function load() {
      try {
        const { data: d } = await api.get(`/api/portal/my-forms/${assignmentId}`, authHeader());
        setData(d);
        if (d.submission) setSubmitted(true);
        const initial = {};
        d.fields.forEach(f => {
          if (f.field_type === 'checkbox') initial[f.id] = false;
          else initial[f.id] = '';
        });
        setResponses(initial);
      } catch (err) {
        setError(err.response?.data?.error ?? err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignmentId, authHeader]);

  // Initialize signature pad after fields are loaded
  useEffect(() => {
    if (!data || submitted || uploadMode) return;
    if (!data.assignment.requires_signature) return;

    async function initSigPad() {
      const { default: SignaturePad } = await import('signature_pad');
      if (canvasRef.current && !sigPadRef.current) {
        sigPadRef.current = new SignaturePad(canvasRef.current, { penColor: '#1a1a1a' });
      }
    }
    initSigPad();

    return () => {
      sigPadRef.current?.off();
      sigPadRef.current = null;
    };
  }, [data, submitted, uploadMode]);

  function setResponse(fieldId, value) {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  }

  function clearSignature() {
    sigPadRef.current?.clear();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    const requiresSig = data?.assignment?.requires_signature;

    // Validate required fields
    for (const f of (data?.fields ?? [])) {
      if (!f.required) continue;
      if (['heading', 'paragraph'].includes(f.field_type)) continue;
      const val = responses[f.id];
      if (f.field_type === 'checkbox' ? !val : !val?.trim()) {
        setSubmitError(`"${f.label}" is required`);
        return;
      }
    }

    if (requiresSig && sigPadRef.current?.isEmpty()) {
      setSubmitError('Signature is required');
      return;
    }

    setSubmitting(true);
    try {
      const sigData = requiresSig ? sigPadRef.current?.toDataURL('image/png') ?? null : null;
      await api.post(
        `/api/portal/my-forms/${assignmentId}/submit`,
        { responses, signature_data: sigData },
        authHeader()
      );
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePdfUpload(e) {
    e.preventDefault();
    if (!pdfFile) { setSubmitError('Select a PDF file'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });
      await api.post(
        `/api/portal/my-forms/${assignmentId}/upload-pdf`,
        { base64, mime_type: 'application/pdf' },
        authHeader()
      );
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="pfc-page"><p className="pfc-loading">Loading form...</p></div>;
  if (error)   return <div className="pfc-page"><p className="pfc-error">{error}</p></div>;

  if (submitted) {
    return (
      <div className="pfc-page">
        <div className="pfc-success">
          <div className="pfc-success-icon">✓</div>
          <h2 className="pfc-success-title">Form Submitted</h2>
          <p className="pfc-success-text">Your response has been recorded.</p>
          <button className="pfc-btn" onClick={() => navigate('/portal/home')}>Back to Home</button>
        </div>
      </div>
    );
  }

  const { assignment, fields } = data;
  const requiresSig = assignment.requires_signature;

  return (
    <div className="pfc-page">
      <header className="pfc-header">
        <button className="pfc-back" onClick={() => navigate('/portal/home')}>← Back</button>
      </header>

      <div className="pfc-card">
        <div className="pfc-form-title">{assignment.form_title}</div>
        {assignment.form_description && (
          <p className="pfc-form-desc">{assignment.form_description}</p>
        )}
        {assignment.due_date && (
          <p className="pfc-due">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
        )}

        {uploadMode ? (
          <form className="pfc-form" onSubmit={handlePdfUpload}>
            <div className="pfc-upload-area">
              <p className="pfc-upload-hint">Upload a completed PDF instead of filling out this form.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="pfc-file-input"
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              />
              {pdfFile && <p className="pfc-file-name">{pdfFile.name}</p>}
            </div>
            {submitError && <p className="pfc-error">{submitError}</p>}
            <div className="pfc-form-actions">
              <button type="button" className="pfc-btn pfc-btn--ghost" onClick={() => setUploadMode(false)}>
                Fill out form instead
              </button>
              <button type="submit" className="pfc-btn" disabled={submitting}>
                {submitting ? 'Uploading...' : 'Submit PDF'}
              </button>
            </div>
          </form>
        ) : (
          <form className="pfc-form" onSubmit={handleSubmit}>
            {fields.map(f => (
              <FieldInput key={f.id} field={f} value={responses[f.id]} onChange={v => setResponse(f.id, v)} />
            ))}

            {requiresSig && (
              <div className="pfc-sig-section">
                <p className="pfc-sig-label">Signature</p>
                <div className="pfc-sig-wrap">
                  <canvas ref={canvasRef} className="pfc-sig-canvas" width={400} height={150} />
                </div>
                <button type="button" className="pfc-btn pfc-btn--ghost pfc-btn--sm" onClick={clearSignature}>
                  Clear signature
                </button>
              </div>
            )}

            {submitError && <p className="pfc-error">{submitError}</p>}

            <div className="pfc-form-actions">
              <button type="button" className="pfc-btn pfc-btn--ghost" onClick={() => setUploadMode(true)}>
                Upload PDF instead
              </button>
              <button type="submit" className="pfc-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.field_type === 'heading') {
    return <h3 className="pfc-heading">{field.label}</h3>;
  }
  if (field.field_type === 'paragraph') {
    return <p className="pfc-para">{field.label}</p>;
  }

  return (
    <div className="pfc-field">
      <label className="pfc-field-label">
        {field.label}
        {field.required && <span className="pfc-required"> *</span>}
      </label>

      {field.field_type === 'text' && (
        <input className="pfc-input" type="text" value={value}
          placeholder={field.placeholder ?? ''} onChange={e => onChange(e.target.value)} />
      )}
      {field.field_type === 'textarea' && (
        <textarea className="pfc-input pfc-textarea" value={value}
          placeholder={field.placeholder ?? ''} onChange={e => onChange(e.target.value)} rows={4} />
      )}
      {field.field_type === 'date' && (
        <input className="pfc-input" type="date" value={value} onChange={e => onChange(e.target.value)} />
      )}
      {field.field_type === 'checkbox' && (
        <label className="pfc-checkbox-label">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {field.placeholder || 'Yes'}
        </label>
      )}
      {field.field_type === 'select' && (
        <select className="pfc-input" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  );
}
