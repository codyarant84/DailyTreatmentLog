import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './MarketingPage.css';

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'Daily Treatment Log',
    desc: 'Document every visit fast — modalities, body parts, notes, and follow-ups in one streamlined form.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2z"/>
      </svg>
    ),
    title: 'Injury Tracking & RTP',
    desc: 'Track active injuries, monitor return-to-play progress, and keep coaches in the loop — automatically.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A6.5 6.5 0 0 1 16 8.5c0 2.5-1.5 4.5-3 5.5v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2c-1.5-1-3-3-3-5.5A6.5 6.5 0 0 1 9.5 2z"/>
        <line x1="9" y1="19" x2="15" y2="19"/><line x1="10" y1="22" x2="14" y2="22"/>
      </svg>
    ),
    title: 'Concussion Management',
    desc: 'Full SCAT6 assessments, digital RTP protocols, and athlete self-check-in links — all paperless.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      </svg>
    ),
    title: 'GPS Performance',
    desc: 'Upload wearable data and track load, distance, and exertion trends across your entire roster.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l.95-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    title: 'SMS Injury Reports',
    desc: 'Text your daily injury report to coaches and staff with one tap. No more daily email chains.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'PDF Report Builder',
    desc: 'Generate customizable PDF reports for any athlete — injuries, treatments, concussions, and SOAP notes.',
  },
];

const STATS = [
  { value: '10+', label: 'Minutes saved per athlete visit' },
  { value: '100%', label: 'Paperless documentation' },
  { value: '1 tap', label: 'To send a team injury report' },
  { value: 'Built by ATs', label: 'For athletic trainers, by ATs' },
];

export default function MarketingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', school: '', role: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (session) navigate('/home', { replace: true });
  }, [session, navigate]);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mp-page">
      {/* ── Nav ── */}
      <header className="mp-nav">
        <div className="mp-nav-inner">
          <div className="mp-nav-brand">
            <span className="mp-nav-icon">+</span>
            <span className="mp-nav-name">Fieldside</span>
          </div>

          <nav className={`mp-nav-links${menuOpen ? ' open' : ''}`}>
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('about')}>About</button>
            <button onClick={() => scrollTo('demo')}>Request Demo</button>
          </nav>

          <div className="mp-nav-ctas">
            <Link to="/login" className="mp-btn-ghost">Log In</Link>
            <button className="mp-btn-primary" onClick={() => scrollTo('demo')}>Get a Demo</button>
          </div>

          <button className="mp-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mp-hero">
        <div className="mp-hero-inner">
          <div className="mp-hero-badge">Built for Athletic Trainers</div>
          <h1 className="mp-hero-headline">
            The all-in-one platform for<br />
            <span className="mp-hero-accent">high school athletic training.</span>
          </h1>
          <p className="mp-hero-sub">
            Fieldside replaces paper logs, spreadsheets, and email chains with a single platform
            designed by certified athletic trainers — for certified athletic trainers.
          </p>
          <div className="mp-hero-actions">
            <button className="mp-btn-primary mp-btn-lg" onClick={() => scrollTo('demo')}>Request a Free Demo</button>
            <Link to="/login" className="mp-btn-ghost mp-btn-lg">Sign In</Link>
          </div>
        </div>
        <div className="mp-hero-visual" aria-hidden="true">
          <div className="mp-mockup">
            <div className="mp-mockup-bar">
              <span /><span /><span />
            </div>
            <div className="mp-mockup-body">
              <div className="mp-mockup-row mp-mockup-header" />
              <div className="mp-mockup-row mp-mockup-wide" />
              <div className="mp-mockup-row mp-mockup-med" />
              <div className="mp-mockup-grid">
                <div className="mp-mockup-card" />
                <div className="mp-mockup-card" />
                <div className="mp-mockup-card" />
              </div>
              <div className="mp-mockup-row mp-mockup-wide" />
              <div className="mp-mockup-row mp-mockup-short" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mp-features" id="features">
        <div className="mp-section-inner">
          <div className="mp-section-header">
            <p className="mp-eyebrow">Everything you need</p>
            <h2 className="mp-section-title">One platform. Every part of your day.</h2>
            <p className="mp-section-sub">
              From morning treatment log to afternoon injury report — Fieldside has every workflow athletic trainers need, built into one tool.
            </p>
          </div>
          <div className="mp-features-grid">
            {FEATURES.map((f) => (
              <div className="mp-feature-card" key={f.title}>
                <div className="mp-feature-icon">{f.icon}</div>
                <h3 className="mp-feature-title">{f.title}</h3>
                <p className="mp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="mp-stats">
        <div className="mp-section-inner">
          <div className="mp-stats-grid">
            {STATS.map((s) => (
              <div className="mp-stat" key={s.label}>
                <span className="mp-stat-value">{s.value}</span>
                <span className="mp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="mp-about" id="about">
        <div className="mp-section-inner mp-about-inner">
          <div className="mp-about-text">
            <p className="mp-eyebrow">The story</p>
            <h2 className="mp-section-title">Made by a certified athletic trainer who was tired of paper.</h2>
            <p>
              Fieldside was built by a working ATC who spent years juggling treatment binders,
              spreadsheet injury logs, and group texts to coaches. Every feature in the app came
              from a real frustration in the athletic training room.
            </p>
            <p>
              The result is a platform that fits how athletic trainers actually work — fast to use
              during busy treatment sessions, powerful enough to satisfy documentation requirements,
              and simple enough that coaches and administrators can stay informed without extra effort.
            </p>
            <div className="mp-about-creds">
              <div className="mp-about-cred">
                <strong>ATC-designed</strong>
                <span>Built by a certified athletic trainer, not a software team guessing at workflows.</span>
              </div>
              <div className="mp-about-cred">
                <strong>HIPAA-conscious</strong>
                <span>Role-based access control keeps sensitive athlete data in the right hands.</span>
              </div>
              <div className="mp-about-cred">
                <strong>No training required</strong>
                <span>If you can use a smartphone, you can use Fieldside on day one.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo form ── */}
      <section className="mp-demo" id="demo">
        <div className="mp-section-inner mp-demo-inner">
          <div className="mp-demo-text">
            <p className="mp-eyebrow mp-eyebrow-light">Get started</p>
            <h2 className="mp-section-title mp-title-light">Ready to see Fieldside in action?</h2>
            <p className="mp-demo-sub">
              Fill out the form and we will reach out to you to schedule a personalized walkthrough.
              No sales team, no pressure.
            </p>
            <ul className="mp-demo-bullets">
              <li>Free demo tailored to your program</li>
              <li>Setup takes less than a day</li>
              <li>Pricing that works for all budgets</li>
            </ul>
          </div>

          <form className="mp-demo-form" onSubmit={handleSubmit}>
            {submitted ? (
              <div className="mp-form-success">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>Request received!</h3>
                <p>Cody will be in touch within 1 business day.</p>
              </div>
            ) : (
              <>
                <h3 className="mp-form-title">Request a Demo</h3>
                <div className="mp-form-row">
                  <div className="mp-form-group">
                    <label className="mp-form-label">Your Name <span className="mp-req">*</span></label>
                    <input
                      className="mp-form-input"
                      type="text"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="mp-form-group">
                    <label className="mp-form-label">School / Organization <span className="mp-req">*</span></label>
                    <input
                      className="mp-form-input"
                      type="text"
                      placeholder="Lincoln High School"
                      value={form.school}
                      onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="mp-form-row">
                  <div className="mp-form-group">
                    <label className="mp-form-label">Your Role</label>
                    <input
                      className="mp-form-input"
                      type="text"
                      placeholder="Athletic Trainer, ATC"
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    />
                  </div>
                  <div className="mp-form-group">
                    <label className="mp-form-label">Email <span className="mp-req">*</span></label>
                    <input
                      className="mp-form-input"
                      type="email"
                      placeholder="jane@school.edu"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="mp-form-group">
                  <label className="mp-form-label">Phone <span className="mp-optional">(optional)</span></label>
                  <input
                    className="mp-form-input"
                    type="tel"
                    placeholder="(555) 867-5309"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="mp-form-group">
                  <label className="mp-form-label">Anything else? <span className="mp-optional">(optional)</span></label>
                  <textarea
                    className="mp-form-input mp-form-textarea"
                    placeholder="Tell us about your program, how many athletes, what you're currently using..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    rows={3}
                  />
                </div>
                {error && <p className="mp-form-error">{error}</p>}
                <button className="mp-btn-primary mp-btn-block" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Request My Demo'}
                </button>
              </>
            )}
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mp-footer">
        <div className="mp-footer-inner">
          <div className="mp-footer-brand">
            <span className="mp-nav-icon mp-footer-icon">+</span>
            <span className="mp-nav-name">Fieldside</span>
          </div>
          <p className="mp-footer-tag">Athletic Training Management — Built by ATs, for ATs.</p>
          <div className="mp-footer-links">
            <Link to="/login">Log In</Link>
            <a href="mailto:cody@fieldsidehealth.com">Contact</a>
          </div>
          <p className="mp-footer-copy">&copy; {new Date().getFullYear()} Fieldside Health. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
