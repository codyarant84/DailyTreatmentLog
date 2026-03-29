import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still initializing, null = no session, object = active session
  const [session, setSession] = useState(undefined);
  // null = unknown, true = profile exists, false = no profile yet
  const [hasProfile, setHasProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (!session) setHasProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    axios
      .get('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .then(() => setHasProfile(true))
      .catch((err) => {
        if (err.response?.status === 403) {
          setHasProfile(false);
        }
      });
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, hasProfile, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
