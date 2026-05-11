import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api.js';

const PortalAuthContext = createContext(null);

const TOKEN_KEY = 'fieldside_portal_token';

export function PortalAuthProvider({ children }) {
  const [portalUser, setPortalUser] = useState(null);
  const [portalLoading, setPortalLoading] = useState(true);

  const fetchMe = useCallback(async (token) => {
    try {
      const { data } = await api.get('/api/portal/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPortalUser(data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setPortalUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setPortalLoading(false);
      return;
    }
    fetchMe(token).finally(() => setPortalLoading(false));
  }, [fetchMe]);

  function portalLogin(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    setPortalUser(user);
  }

  function portalSignOut() {
    localStorage.removeItem(TOKEN_KEY);
    setPortalUser(null);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  const isApproved = portalUser?.approved === true;

  return (
    <PortalAuthContext.Provider value={{ portalUser, portalLoading, isApproved, portalLogin, portalSignOut, getToken }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
