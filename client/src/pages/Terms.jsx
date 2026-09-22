import './Login.css';
import './LegalPage.css';

export default function Terms() {
  return (
    <div className="login-page">
      <div className="login-card legal-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Fieldside Health</span>
        </div>

        <h1 className="login-title">Terms of Service</h1>

        <div className="legal-placeholder-notice">
          Placeholder content — replace with Fieldside Health LLC's actual terms of service before
          this page is relied on for compliance review or public use.
        </div>

        <p className="legal-text">
          These Terms of Service govern use of the Fieldside Health platform ("Fieldside") by
          athletic trainers, coaches, administrators, and their affiliated schools or organizations.
          By using Fieldside, including the SMS injury logging feature, you agree to these terms.
        </p>
        <p className="legal-text">
          Fieldside is a documentation tool intended to support, not replace, the clinical judgment
          of licensed and certified athletic training professionals. Users are responsible for
          reviewing and completing any records — including those drafted automatically from SMS
          messages — for accuracy before relying on them.
        </p>
        <p className="legal-text">
          For questions about these terms, contact us at{' '}
          <a href="mailto:cody@fieldsidehealth.com">cody@fieldsidehealth.com</a>.
        </p>
      </div>
    </div>
  );
}
