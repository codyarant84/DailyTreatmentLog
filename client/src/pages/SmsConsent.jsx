import './Login.css';
import './SmsConsent.css';

export default function SmsConsent() {
  return (
    <div className="login-page">
      <div className="login-card sms-consent-card">
        <div className="login-brand">
          <span className="brand-icon">+</span>
          <span className="brand-name">Fieldside Health</span>
        </div>

        <h1 className="login-title">SMS Injury Log — Opt-In Information</h1>

        <p className="sms-consent-text">
          Fieldside Health helps athletic trainers document injuries in the field. Athletic trainers
          using Fieldside can register their phone number in their account Settings to text a brief
          injury description to a dedicated Fieldside number. The message is automatically parsed
          into a draft injury record for the trainer to review and complete in the app.
        </p>

        <div className="sms-consent-box">
          By registering your phone number in Fieldside Settings, you consent to receive SMS
          messages from Fieldside Health LLC including injury log confirmations and verification
          codes.
        </div>

        <p className="sms-consent-text">Reply STOP at any time to unsubscribe.</p>

        <p className="sms-consent-fineprint">
          Message and data rates may apply. Messages are not end-to-end encrypted.
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
