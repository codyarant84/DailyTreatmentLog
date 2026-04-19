import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const TOKEN_KEY = 'fieldside_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still initializing, null = no session, object = active session
  const [session, setSession] = useState(undefined);
  const [hasProfile, setHasProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState(null);
  const [branding, setBranding] = useState({ primaryColor: null, logoUrl: null, costPerVisit: 50 });

  // On mount: validate stored token via /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setSession(null);
      return;
    }

    axios
      .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setSession(data);
        setHasProfile(true);
        setIsAdmin(data.is_admin ?? false);
        setRole(data.role ?? 'trainer');
        setBranding({
          primaryColor: data.primary_color ?? null,
          logoUrl:      data.logo_url      ?? null,
          costPerVisit: data.cost_per_visit ?? 50,
        });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setSession(null);
        setHasProfile(null);
      });
  }, []);

  async function login(email, password) {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setSession(data);
    setHasProfile(true);
    setIsAdmin(data.is_admin ?? false);
    setRole(data.role ?? 'trainer');
    setBranding({
      primaryColor: data.primary_color ?? null,
      logoUrl:      data.logo_url      ?? null,
      costPerVisit: data.cost_per_visit ?? 50,
    });
    return data;
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setHasProfile(null);
    setIsAdmin(false);
    setRole(null);
    setBranding({ primaryColor: null, logoUrl: null, costPerVisit: 50 });
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
