import { useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { supabase } from './lib/supabase.js';
import Home from './pages/Home.jsx';
import NewTreatment from './pages/NewTreatment.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Athletes from './pages/Athletes.jsx';
import AthleteProfile from './pages/AthleteProfile.jsx';
import ImportAthletes from './pages/ImportAthletes.jsx';
import Login from './pages/Login.jsx';
import SetupProfile from './pages/SetupProfile.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import './App.css';

function App() {
  const location = useLocation();
  const { session, isAdmin, branding, loading } = useAuth();

  // Apply school branding as CSS variable overrides
  useEffect(() => {
    const hex = branding?.primaryColor;
    if (!hex) {
      // Reset to defaults
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-primary-dark');
      document.documentElement.style.removeProperty('--color-primary-light');
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--color-primary', hex);
    document.documentElement.style.setProperty(
      '--color-primary-dark',
      `rgb(${Math.round(r * 0.82)}, ${Math.round(g * 0.82)}, ${Math.round(b * 0.82)})`
    );
    document.documentElement.style.setProperty(
      '--color-primary-light',
      `rgba(${r}, ${g}, ${b}, 0.12)`
    );
  }, [branding]);

  if (loading) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="School logo" className="brand-logo" />
            ) : (
              <span className="brand-icon">+</span>
            )}
            <span className="brand-name">Daily Treatment Log</span>
          </Link>

          {session && (
            <nav className="header-nav">
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                Log
              </Link>
              <Link
                to="/dashboard"
                className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
              >
                Today
              </Link>
              <Link
                to="/athletes"
                className={`nav-link ${location.pathname.startsWith('/athletes') ? 'active' : ''}`}
              >
                Athletes
              </Link>
              <Link
                to="/new"
                className={`nav-link nav-link--cta ${location.pathname === '/new' ? 'active' : ''}`}
              >
                + New Treatment
              </Link>
              <Link
                to="/settings"
                className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                >
                  Admin
                </Link>
              )}
              <button className="nav-signout" onClick={handleSignOut}>
                Sign Out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/login"
            element={session ? <Navigate to="/" replace /> : <Login />}
          />
          <Route path="/setup" element={<SetupProfile />} />
          <Route
            path="/admin"
            element={<ProtectedRoute><Admin /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><Settings /></ProtectedRoute>}
          />
          <Route
            path="/"
            element={<ProtectedRoute><Home /></ProtectedRoute>}
          />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/athletes"
            element={<ProtectedRoute><Athletes /></ProtectedRoute>}
          />
          <Route
            path="/athletes/import"
            element={<ProtectedRoute><ImportAthletes /></ProtectedRoute>}
          />
          <Route
            path="/athletes/:name"
            element={<ProtectedRoute><AthleteProfile /></ProtectedRoute>}
          />
          <Route
            path="/new"
            element={<ProtectedRoute><NewTreatment /></ProtectedRoute>}
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>Daily Treatment Log &mdash; Athletic Training</p>
      </footer>
    </div>
  );
}

export default App;
