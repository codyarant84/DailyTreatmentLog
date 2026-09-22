import { Link } from 'react-router-dom';

// Shared expanded footer used by the homepage and every marketing subpage.
// Note: there is no dedicated /pricing or /about route in this codebase —
// "Pricing" and "About" link to the homepage's #demo and #about sections
// respectively (handled by the hash-scroll effect in MarketingPage.jsx).
export default function MarketingFooter() {
  return (
    <footer className="mp-footer">
      <div className="mp-footer-inner">
        <div className="mp-footer-top">
          <div className="mp-footer-brand-col">
            <Link to="/" className="mp-footer-brand">
              <span className="mp-nav-icon mp-footer-icon">+</span>
              <span className="mp-nav-name">Fieldside</span>
            </Link>
            <p className="mp-footer-tag">Athletic Training Management — Built by ATs, for ATs.</p>
          </div>

          <div className="mp-footer-columns">
            <div className="mp-footer-col">
              <h4>Product</h4>
              <Link to="/features">Features</Link>
              <Link to="/#demo">Pricing</Link>
            </div>
            <div className="mp-footer-col">
              <h4>Compare</h4>
              <Link to="/vs-healthy-roster">vs Healthy Roster</Link>
              <Link to="/vs-rank-one">vs Rank One</Link>
            </div>
            <div className="mp-footer-col">
              <h4>Resources</h4>
              <Link to="/blog">Blog</Link>
              <Link to="/hipaa-compliance">HIPAA Compliance</Link>
            </div>
            <div className="mp-footer-col">
              <h4>Company</h4>
              <Link to="/#about">About</Link>
              <a href="mailto:cody@fieldsidehealth.com">Contact</a>
            </div>
          </div>
        </div>

        <div className="mp-footer-bottom">
          <p className="mp-footer-copy">&copy; {new Date().getFullYear()} Fieldside Health. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
