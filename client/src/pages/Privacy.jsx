import './Login.css';
import './LegalPage.css';

export default function Privacy() {
  return (
    <div className="login-page">
      <div className="login-card legal-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Fieldside Health</span>
        </div>

        <h1 className="login-title">Privacy Policy</h1>

        <div className="legal-placeholder-notice">
          Placeholder content — replace with Fieldside Health LLC's actual privacy policy before
          this page is relied on for compliance review or public use.
        </div>

        <p className="legal-text">
          Fieldside Health LLC ("Fieldside") respects your privacy. This page describes, in general
          terms, how information submitted through the Fieldside platform — including athlete
          treatment records and phone numbers registered for SMS injury logging — is collected,
          used, and protected.
        </p>
        <p className="legal-text">
          Information collected through Fieldside is used solely to provide the athletic training
          documentation services offered by the platform, including SMS-based injury logging for
          registered athletic trainers. Phone numbers registered for SMS are used only to identify
          incoming messages and to send confirmation messages and verification codes.
        </p>
        <p className="legal-text">
          For questions about this policy or how your information is handled, contact us at{' '}
          <a href="mailto:cody@fieldsidehealth.com">cody@fieldsidehealth.com</a>.
        </p>
      </div>
    </div>
  );
}
