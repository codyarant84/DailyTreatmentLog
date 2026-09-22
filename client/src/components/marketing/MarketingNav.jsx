import { useState } from 'react';
import { Link } from 'react-router-dom';

// Nav for every marketing subpage (blog, features, comparisons, etc).
// The homepage (MarketingPage.jsx) keeps its own bespoke nav since its
// links scroll to on-page sections rather than navigating — this version
// links to real routes / homepage anchors instead.
export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  function close() { setMenuOpen(false); }

  return (
    <header className="mp-nav">
      <div className="mp-nav-inner">
        <Link to="/" className="mp-nav-brand">
          <span className="mp-nav-icon">+</span>
          <span className="mp-nav-name">Fieldside</span>
        </Link>

        <nav className={`mp-nav-links${menuOpen ? ' open' : ''}`}>
          <Link to="/features" onClick={close}>Features</Link>
          <Link to="/blog" onClick={close}>Blog</Link>
          <Link to="/#demo" onClick={close}>Request Demo</Link>
        </nav>

        <div className="mp-nav-ctas">
          <Link to="/login" className="mp-btn-ghost">Log In</Link>
          <Link to="/#demo" className="mp-btn-primary">Get a Demo</Link>
        </div>

        <button className="mp-hamburger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}
