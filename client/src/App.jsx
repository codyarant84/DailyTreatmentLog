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
import ProtectedRoute from './components/ProtectedRoute.jsx';
import './App.css';

function App() {
  const location = useLocation();
  const { session, isAdmin, loading } = useAuth();

  if (loading) return null;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-icon">+</span>
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
