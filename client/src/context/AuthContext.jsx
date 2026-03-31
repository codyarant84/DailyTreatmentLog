import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still initializing, null = no session, object = active session
  const [session, setSession] = useState(undefined);
  // null = unknown, true = profile exists, false = no profile yet
  const [hasProfile, setHasProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [branding, setBranding] = useState({ primaryColor: null, logoUrl: null, costPerVisit: 50 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (!session) { setHasProfile(null); setIsAdmin(false); setBranding({ primaryColor: null, logoUrl: null }); }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    axios
      .get('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .then(({ data }) => {
        setHasProfile(true);
        setIsAdmin(data.is_admin ?? false);
        setBranding({ primaryColor: data.primary_color ?? null, logoUrl: data.logo_url ?? null, costPerVisit: data.cost_per_visit ?? 50 });
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setHasProfile(false);
        }
      });
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, hasProfile, isAdmin, branding, setBranding, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
