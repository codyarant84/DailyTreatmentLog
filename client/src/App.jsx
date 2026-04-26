import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Landing from './pages/Landing.jsx';
import NewTreatment from './pages/NewTreatment.jsx';
import EditTreatment from './pages/EditTreatment.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Athletes from './pages/Athletes.jsx';
import AthleteProfile from './pages/AthleteProfile.jsx';
import ImportAthletes from './pages/ImportAthletes.jsx';
import Login from './pages/Login.jsx';
import SetupProfile from './pages/SetupProfile.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';
import InviteAccept from './pages/InviteAccept.jsx';
import ExerciseLibrary from './pages/ExerciseLibrary.jsx';
import RehabPrograms from './pages/RehabPrograms.jsx';
import Injuries from './pages/Injuries.jsx';
import InjuryDetail from './pages/InjuryDetail.jsx';
import Concussions from './pages/Concussions.jsx';
import ConcussionDetail from './pages/ConcussionDetail.jsx';
import Insights from './pages/Insights.jsx';
import ProgramBuilder from './pages/ProgramBuilder.jsx';
import GPSDashboard from './pages/GPSDashboard.jsx';
import Teams from './pages/Teams.jsx';
import Reports from './pages/Reports.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import './App.css';

function CoachRoute({ children }) {
  const { role } = useAuth();
  if (role === 'coach') return <Navigate to="/gps" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { role } = useAuth();
  if (role !== 'admin' && role !== 'super_admin') return <Navigate to="/" replace />;
  return children;
}

// ─── Icons ────────────────────────────────────────────────────────
const IconToday = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconNewTreatment = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

const IconInjuries = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2z"/>
  </svg>
);

const IconGPS = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
  </svg>
);

const IconMore = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="1"/>
    <circle cx="12" cy="12" r="1"/>
    <circle cx="19" cy="12" r="1"/>
  </svg>
);

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// Drawer icons (20px for the grid)
const IconLog = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconAthletes = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconTeams = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconInsights = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconLibrary = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const IconPrograms = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconAdmin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconReports = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);

const IconConcussions = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A6.5 6.5 0 0 1 16 8.5c0 2.5-1.5 4.5-3 5.5v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2c-1.5-1-3-3-3-5.5A6.5 6.5 0 0 1 9.5 2z"/>
    <line x1="9" y1="19" x2="15" y2="19"/>
    <line x1="10" y1="22" x2="14" y2="22"/>
  </svg>
);

// ─── More drawer ───────────────────────────────────────────────────
function MoreDrawer({ onClose, role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';

  function go(path) {
    navigate(path);
    onClose();
  }

  const items = [
    { label: 'Log',          icon: <IconLog />,          path: '/log',         show: role !== 'coach' },
    { label: 'Athletes',     icon: <IconAthletes />,     path: '/athletes',    show: true },
    { label: 'Teams',        icon: <IconTeams />,        path: '/teams',       show: role !== 'coach' },
    { label: 'Concussions',  icon: <IconConcussions />,  path: '/concussions', show: role !== 'coach' },
    { label: 'Insights',     icon: <IconInsights />,     path: '/insights',    show: true },
    { label: 'Library',      icon: <IconLibrary />,      path: '/exercises',   show: role !== 'coach' },
    { label: 'Programs',     icon: <IconPrograms />,     path: '/programs',    show: role !== 'coach' },
    { label: 'Reports',      icon: <IconReports />,      path: '/reports',     show: role !== 'coach' },
    { label: 'Settings',     icon: <IconSettings />,     path: '/settings',    show: isAdmin },
    { label: 'Admin',        icon: <IconAdmin />,        path: '/admin',       show: isAdmin },
  ].filter((i) => i.show);

  return (
    <>
      <div className="more-overlay" onClick={onClose} />
      <div className="more-drawer">
        <div className="more-drawer-handle" />
        <div className="more-drawer-title">More</div>
        <div className="more-drawer-grid">
          {items.map((item) => (
            <button
              key={item.path}
              className={`more-drawer-item${location.pathname === item.path || location.pathname.startsWith(item.path + '/') ? ' active' : ''}`}
              onClick={() => go(item.path)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="more-drawer-sign-out">
          <button onClick={async () => { await signOut(); onClose(); }}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Gear dropdown ─────────────────────────────────────────────────
function GearDropdown({ role, onClose }) {
  const isAdmin = role === 'admin' || role === 'super_admin';
  return (
    <div className="nav-gear-dropdown">
      {isAdmin && <Link to="/settings" onClick={onClose}>Settings</Link>}
      {isAdmin && <Link to="/admin" onClick={onClose}>Admin</Link>}
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────
function App() {
  const location = useLocation();
  const { session, isAdmin, role, branding, loading, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef(null);

  // Apply school branding as CSS variable overrides
  useEffect(() => {
    const hex = branding?.primaryColor;
    if (!hex) {
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

  // Close gear dropdown on outside click
  useEffect(() => {
    if (!gearOpen) return;
    function handler(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setGearOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [gearOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (loading) return null;

  async function handleSignOut() {
    await signOut();
  }

  const isAdminRole = role === 'admin' || role === 'super_admin';
  const p = location.pathname;

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
            <span className="brand-name">Fieldside</span>
          </Link>

          {session && (
            <>
              <nav className="header-nav">
                {/* Medical group */}
                {role !== 'coach' && (
                  <Link to="/log" className={`nav-link${p === '/log' ? ' active' : ''}`}>Log</Link>
                )}
                {role !== 'coach' && (
                  <Link to="/dashboard" className={`nav-link${p === '/dashboard' ? ' active' : ''}`}>Today</Link>
                )}
                <Link to="/athletes" className={`nav-link${p.startsWith('/athletes') ? ' active' : ''}`}>Athletes</Link>
                {role !== 'coach' && (
                  <Link to="/teams" className={`nav-link${p.startsWith('/teams') ? ' active' : ''}`}>Teams</Link>
                )}
                {role !== 'coach' && (
                  <Link to="/injuries" className={`nav-link${p.startsWith('/injuries') ? ' active' : ''}`}>Injuries</Link>
                )}
                {role !== 'coach' && (
                  <Link to="/concussions" className={`nav-link${p.startsWith('/concussions') ? ' active' : ''}`}>Concussions</Link>
                )}
                {role !== 'coach' && (
                  <Link to="/reports" className={`nav-link${p.startsWith('/reports') ? ' active' : ''}`}>Reports</Link>
                )}

                <span className="nav-divider" />

                {/* Performance group */}
                <Link to="/gps" className={`nav-link${p === '/gps' ? ' active' : ''}`}>GPS</Link>
                <Link to="/insights" className={`nav-link${p === '/insights' ? ' active' : ''}`}>Insights</Link>

                {role !== 'coach' && (
                  <>
                    <span className="nav-divider" />
                    {/* Resources group */}
                    <Link to="/exercises" className={`nav-link${p === '/exercises' ? ' active' : ''}`}>Library</Link>
                    <Link to="/programs" className={`nav-link${p.startsWith('/programs') ? ' active' : ''}`}>Programs</Link>
                  </>
                )}
              </nav>

              <div className="nav-right">
                {isAdminRole && (
                  <div className="nav-gear-wrapper" ref={gearRef}>
                    <button
                      className={`nav-gear-btn${gearOpen ? ' open' : ''}`}
                      onClick={() => setGearOpen((o) => !o)}
                      aria-label="Settings and admin"
                    >
                      <IconGear />
                    </button>
                    {gearOpen && (
                      <GearDropdown role={role} onClose={() => setGearOpen(false)} />
                    )}
                  </div>
                )}
                <button className="nav-signout" onClick={handleSignOut}>Sign Out</button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/setup" element={<SetupProfile />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/admin" element={<ProtectedRoute><CoachRoute><Admin /></CoachRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
          <Route path="/injuries" element={<ProtectedRoute><CoachRoute><Injuries /></CoachRoute></ProtectedRoute>} />
          <Route path="/injuries/:id" element={<ProtectedRoute><CoachRoute><InjuryDetail /></CoachRoute></ProtectedRoute>} />
          <Route path="/concussions" element={<ProtectedRoute><Concussions /></ProtectedRoute>} />
          <Route path="/concussions/:id" element={<ProtectedRoute><ConcussionDetail /></ProtectedRoute>} />
          <Route path="/concussion-checkin/:token" element={<div>Check-in coming soon</div>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/gps" element={<ProtectedRoute><GPSDashboard /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute><CoachRoute><ExerciseLibrary /></CoachRoute></ProtectedRoute>} />
          <Route path="/programs" element={<ProtectedRoute><CoachRoute><RehabPrograms /></CoachRoute></ProtectedRoute>} />
          <Route path="/programs/new" element={<ProtectedRoute><CoachRoute><ProgramBuilder /></CoachRoute></ProtectedRoute>} />
          <Route path="/programs/:id" element={<ProtectedRoute><CoachRoute><ProgramBuilder /></CoachRoute></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><CoachRoute><Landing /></CoachRoute></ProtectedRoute>} />
          <Route path="/log" element={<ProtectedRoute><CoachRoute><Home /></CoachRoute></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><CoachRoute><Dashboard /></CoachRoute></ProtectedRoute>} />
          <Route path="/athletes" element={<ProtectedRoute><Athletes /></ProtectedRoute>} />
          <Route path="/athletes/import" element={<ProtectedRoute><ImportAthletes /></ProtectedRoute>} />
          <Route path="/athletes/:name" element={<ProtectedRoute><AthleteProfile /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><CoachRoute><Reports /></CoachRoute></ProtectedRoute>} />
          <Route path="/new" element={<ProtectedRoute><CoachRoute><NewTreatment /></CoachRoute></ProtectedRoute>} />
          <Route path="/treatments/:id/edit" element={<ProtectedRoute><CoachRoute><EditTreatment /></CoachRoute></ProtectedRoute>} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>Fieldside &mdash; Athletic Training</p>
      </footer>

      {/* Mobile bottom tab bar */}
      {session && (
        <>
          <nav className="bottom-tab-bar">
            {role !== 'coach' && (
              <Link to="/dashboard" className={`bottom-tab${p === '/dashboard' ? ' active' : ''}`}>
                <IconToday />
                Today
              </Link>
            )}
            {role !== 'coach' && (
              <Link to="/new" className={`bottom-tab${p === '/new' ? ' active' : ''}`}>
                <IconNewTreatment />
                New
              </Link>
            )}
            {role !== 'coach' && (
              <Link to="/injuries" className={`bottom-tab${p.startsWith('/injuries') ? ' active' : ''}`}>
                <IconInjuries />
                Injuries
              </Link>
            )}
            <Link to="/gps" className={`bottom-tab${p === '/gps' ? ' active' : ''}`}>
              <IconGPS />
              GPS
            </Link>
            <button className={`bottom-tab${drawerOpen ? ' active' : ''}`} onClick={() => setDrawerOpen(true)}>
              <IconMore />
              More
            </button>
          </nav>

          {drawerOpen && (
            <MoreDrawer onClose={() => setDrawerOpen(false)} role={role} />
          )}
        </>
      )}
    </div>
  );
}

export default App;
