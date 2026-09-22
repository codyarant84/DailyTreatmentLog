import { Link } from 'react-router-dom';
import './Login.css';
import './SmsConsent.css';

export default function SmsConsent() {
  return (
    <div className="login-page sms-consent-page">
      <div className="login-card sms-consent-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Fieldside Health LLC</span>
        </div>

        <h1 className="login-title">SMS Opt-In Consent</h1>

        <h2 className="sms-consent-subhead">How users opt in</h2>
        <p className="sms-consent-text">
          Certified Athletic Trainers using Fieldside register their phone number through the
          Fieldside web application at fieldsidehealth.com/settings. During registration, users
          enter their phone number and receive a one-time verification code via SMS to confirm
          consent.
        </p>

        <figure className="sms-consent-mockup">
          <div className="sms-consent-mockup-frame">
            <span className="sms-consent-mockup-label">Settings → SMS Injury Logging</span>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" value="(555) 555-5555" disabled readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input type="text" className="form-input" value="123456" disabled readOnly />
            </div>
            <button type="button" className="btn btn--primary btn--full" disabled>Verify</button>
          </div>
          <figcaption className="sms-consent-mockup-caption">
            Users access the SMS Injury Logging section in their account Settings, enter their
            mobile phone number, and receive a 6-digit verification code via SMS to complete
            enrollment.
          </figcaption>
        </figure>

        <h2 className="sms-consent-subhead">What messages are sent</h2>
        <p className="sms-consent-text">
          After opting in, users may send SMS messages to the Fieldside number to log injury data.
          Users will receive confirmation messages and verification codes only. No marketing
          messages are sent.
        </p>

        <div className="sms-consent-box">
          <p>Message frequency varies based on user activity.</p>
          <p>Message and data rates may apply.</p>
          <p>Reply STOP to unsubscribe at any time. Reply HELP for assistance.</p>
        </div>

        <div className="sms-consent-links">
          <Link to="/privacy">Privacy Policy</Link>
          <span className="sms-consent-links-sep">·</span>
          <Link to="/terms">Terms of Service</Link>
        </div>

        <p className="sms-consent-fineprint">
          Questions? Contact Fieldside Health LLC at{' '}
          <a href="mailto:cody@fieldsidehealth.com">cody@fieldsidehealth.com</a>.
        </p>

        <a
          href="https://fieldsidehealth.com"
          className="sms-consent-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          fieldsidehealth.com
        </a>
      </div>
    </div>
  );
}
