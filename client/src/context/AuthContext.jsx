import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api.js';

const TOKEN_KEY = 'fieldside_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still initializing, null = no session, object = active session
  const [session, setSession] = useState(undefined);
  const [hasProfile, setHasProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState(null);
  const [branding, setBranding] = useState({
    primaryColor: null, logoUrl: null, costPerVisit: 50, studentEmailDomain: null,
    organizationType: 'high_school', maxYears: 4, archiveRetentionYears: 3,
  });

  // On mount: validate stored token via /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    console.log('[AuthContext] mount — fieldside_token found:', token ? `${token.slice(0, 20)}…` : null);
    if (!token) {
      setSession(null);
      return;
    }

    api
      .get('/api/auth/me')
      .then(({ data }) => {
        console.log('[AuthContext] /api/auth/me returned:', data);
        setSession(data);
        setHasProfile(true);
        setIsAdmin(data.is_admin ?? false);
        setRole(data.role ?? 'trainer');
        setBranding({
          primaryColor:       data.primary_color        ?? null,
          logoUrl:            data.logo_url             ?? null,
          costPerVisit:       data.cost_per_visit       ?? 50,
          studentEmailDomain: data.student_email_domain ?? null,
          organizationType:      data.organization_type      ?? 'high_school',
          maxYears:               data.max_years               ?? 4,
          archiveRetentionYears: data.archive_retention_years ?? 3,
        });
      })
      .catch((err) => {
        console.error('[AuthContext] /api/auth/me failed:', err.response?.status, err.response?.data ?? err.message);
        // Only a genuine auth rejection (expired/invalid/unrecognized token)
        // should log the user out. Any other failure (network blip, 500 from
        // a transient server error) should surface the error and retry on
        // next mount rather than silently discarding a valid token — that
        // was previously masking the real cause of failed sign-ins.
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem(TOKEN_KEY);
          setSession(null);
          setHasProfile(null);
        } else {
          setSession(null);
        }
      });
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setSession(data);
    setHasProfile(true);
    setIsAdmin(data.is_admin ?? false);
    setRole(data.role ?? 'trainer');
    setBranding({
      primaryColor: data.primary_color ?? null,
      logoUrl:      data.logo_url      ?? null,
      costPerVisit: data.cost_per_visit ?? 50,
      organizationType:      data.organization_type      ?? 'high_school',
      maxYears:               data.max_years               ?? 4,
      archiveRetentionYears: data.archive_retention_years ?? 3,
    });
    return data;
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setHasProfile(null);
    setIsAdmin(false);
    setRole(null);
    setBranding({
      primaryColor: null, logoUrl: null, costPerVisit: 50, studentEmailDomain: null,
      organizationType: 'high_school', maxYears: 4, archiveRetentionYears: 3,
    });
  }

  return (
    <AuthContext.Provider
      value={{ session, hasProfile, isAdmin, role, branding, setBranding, loading: session === undefined, login, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
