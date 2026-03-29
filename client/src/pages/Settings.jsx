import { useState, useRef } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Settings.css';

const DEFAULT_COLOR = '#1d6fa5';

export default function Settings() {
  const { branding, setBranding } = useAuth();

  const [color, setColor] = useState(branding?.primaryColor ?? DEFAULT_COLOR);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const [colorError, setColorError] = useState(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoRemoving, setLogoRemoving] = useState(false);

  const fileInputRef = useRef(null);

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
    </div>
  );
}
