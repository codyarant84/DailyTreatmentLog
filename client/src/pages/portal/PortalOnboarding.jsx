import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { usePortalAuth } from '../../context/PortalAuthContext.jsx';
import './PortalOnboarding.css';

const SPORTS = [
  'Football', 'Basketball', 'Baseball', 'Softball', 'Soccer',
  'Volleyball', 'Tennis', 'Track & Field', 'Cross Country', 'Swimming & Diving',
  'Wrestling', 'Golf', 'Lacrosse', 'Ice Hockey', 'Gymnastics',
  'Cheerleading', 'Dance', 'Bowling', 'Rugby', 'Water Polo',
  'Field Hockey', 'Skiing / Snowboarding', 'Other',
];

const GRADES = ['6th', '7th', '8th', '9th (Freshman)', '10th (Sophomore)', '11th (Junior)', '12th (Senior)'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt / Uncle', 'Other'];
const STEPS = ['Personal Info', 'Sport & School', 'Emergency Contact', 'Insurance', 'Review'];

// ── Sub-components ────────────────────────────────────────────────────

function Field({ label, error, required, children }) {
  return (
    <div className="po-field">
      <label className="po-label">
        {label}{required && <span className="po-required"> *</span>}
      </label>
      {children}
      {error && <p className="po-field-error">{error}</p>}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <input
      className="po-input"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="po-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function StepPersonal({ data, update, errors }) {
  return (
    <div className="po-step-grid">
      <Field label="First Name" required error={errors.firstName}>
        <Input value={data.firstName} onChange={v => update('firstName', v)} placeholder="First name" />
      </Field>
      <Field label="Last Name" required error={errors.lastName}>
        <Input value={data.lastName} onChange={v => update('lastName', v)} placeholder="Last name" />
      </Field>
      <Field label="Date of Birth" required error={errors.dob}>
        <Input type="date" value={data.dob} onChange={v => update('dob', v)} />
      </Field>
      <Field label="Grade" required error={errors.grade}>
        <Select value={data.grade} onChange={v => update('grade', v)} options={GRADES} placeholder="Select grade" />
      </Field>
      <Field label="Gender" required error={errors.gender} >
        <Select value={data.gender} onChange={v => update('gender', v)} options={GENDERS} placeholder="Select gender" />
      </Field>
    </div>
  );
}

function StepSport({ data, update, toggleSport, errors }) {
  return (
    <div className="po-step-cols">
      <Field label="Sport(s) you play" required error={errors.sports}>
        <div className="po-sport-grid">
          {SPORTS.map(sport => (
            <button
              key={sport}
              type="button"
              className={`po-sport-chip${data.sports.includes(sport) ? ' selected' : ''}`}
              onClick={() => toggleSport(sport)}
            >
              {sport}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Jersey Number" error={null}>
        <Input
          value={data.jerseyNumber}
          onChange={v => update('jerseyNumber', v)}
          placeholder="e.g. 24 (optional)"
        />
      </Field>
    </div>
  );
}

function StepEmergency({ data, update, errors }) {
  return (
    <div className="po-step-grid">
      <Field label="Parent / Guardian Name" required error={errors.emergencyName}>
        <Input value={data.name} onChange={v => update('name', v)} placeholder="Full name" />
      </Field>
      <Field label="Relationship" required error={errors.relationship}>
        <Select value={data.relationship} onChange={v => update('relationship', v)} options={RELATIONSHIPS} placeholder="Select relationship" />
      </Field>
      <Field label="Phone Number" required error={errors.phone}>
        <Input type="tel" value={data.phone} onChange={v => update('phone', v)} placeholder="(555) 000-0000" />
      </Field>
      <Field label="Email Address" error={null}>
        <Input type="email" value={data.email} onChange={v => update('email', v)} placeholder="optional" />
      </Field>
    </div>
  );
}

function StepInsurance({ data, update }) {
  return (
    <div className="po-step-cols">
      <p className="po-step-hint">Insurance information is optional — you can skip this step.</p>
      <div className="po-step-grid">
        <Field label="Insurance Provider" error={null}>
          <Input value={data.provider} onChange={v => update('provider', v)} placeholder="e.g. Blue Cross Blue Shield" />
        </Field>
        <Field label="Policy Number" error={null}>
          <Input value={data.policyNumber} onChange={v => update('policyNumber', v)} placeholder="Policy #" />
        </Field>
        <Field label="Group Number" error={null}>
          <Input value={data.groupNumber} onChange={v => update('groupNumber', v)} placeholder="Group #" />
        </Field>
        <Field label="Subscriber Name" error={null}>
          <Input value={data.subscriberName} onChange={v => update('subscriberName', v)} placeholder="Name on policy (optional)" />
        </Field>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="po-review-row">
      <span className="po-review-label">{label}</span>
      <span className="po-review-val">{value}</span>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <div className="po-review-section">
      <div className="po-review-section-head">
        <span className="po-review-section-title">{title}</span>
        <button type="button" className="po-edit-btn" onClick={onEdit}>Edit</button>
      </div>
      <div className="po-review-rows">{children}</div>
    </div>
  );
}

function StepReview({ data, goToStep }) {
  const { personal, sport, emergency, insurance } = data;
  const fullName = `${personal.firstName} ${personal.lastName}`.trim();

  return (
    <div className="po-review">
      <ReviewSection title="Personal Info" onEdit={() => goToStep(1)}>
        <ReviewRow label="Name"    value={fullName} />
        <ReviewRow label="Date of Birth" value={personal.dob} />
        <ReviewRow label="Grade"   value={personal.grade} />
        <ReviewRow label="Gender"  value={personal.gender} />
      </ReviewSection>

      <ReviewSection title="Sport & School" onEdit={() => goToStep(2)}>
        <ReviewRow label="Sport(s)"      value={sport.sports.join(', ')} />
        <ReviewRow label="Jersey Number" value={sport.jerseyNumber} />
      </ReviewSection>

      <ReviewSection title="Emergency Contact" onEdit={() => goToStep(3)}>
        <ReviewRow label="Name"         value={emergency.name} />
        <ReviewRow label="Relationship" value={emergency.relationship} />
        <ReviewRow label="Phone"        value={emergency.phone} />
        <ReviewRow label="Email"        value={emergency.email} />
      </ReviewSection>

      <ReviewSection title="Insurance" onEdit={() => goToStep(4)}>
        {insurance.provider ? (
          <>
            <ReviewRow label="Provider"       value={insurance.provider} />
            <ReviewRow label="Policy #"       value={insurance.policyNumber} />
            <ReviewRow label="Group #"        value={insurance.groupNumber} />
            <ReviewRow label="Subscriber"     value={insurance.subscriberName} />
          </>
        ) : (
          <p className="po-review-skip">Skipped</p>
        )}
      </ReviewSection>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function PortalOnboarding() {
  const { portalUser, portalSignOut, getToken, refreshUser } = usePortalAuth();
  const navigate = useNavigate();

  // Pre-fill name from portal user if available
  const nameParts = (portalUser?.name ?? '').trim().split(/\s+/);
  const defaultFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] ?? '';
  const defaultLast  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    personal:  { firstName: defaultFirst, lastName: defaultLast, dob: '', grade: '', gender: '' },
    sport:     { sports: [], jerseyNumber: '' },
    emergency: { name: '', relationship: '', phone: '', email: '' },
    insurance: { provider: '', policyNumber: '', groupNumber: '', subscriberName: '' },
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function update(section, field, value) {
    setData(d => ({ ...d, [section]: { ...d[section], [field]: value } }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function toggleSport(sport) {
    setData(d => {
      const sports = d.sport.sports.includes(sport)
        ? d.sport.sports.filter(s => s !== sport)
        : [...d.sport.sports, sport];
      return { ...d, sport: { ...d.sport, sports } };
    });
    setErrors(e => { const n = { ...e }; delete n.sports; return n; });
  }

  function validate() {
    const errs = {};
    if (step === 1) {
      if (!data.personal.firstName.trim()) errs.firstName = 'Required';
      if (!data.personal.lastName.trim())  errs.lastName  = 'Required';
      if (!data.personal.dob)              errs.dob       = 'Required';
      if (!data.personal.grade)            errs.grade     = 'Required';
      if (!data.personal.gender)           errs.gender    = 'Required';
    }
    if (step === 2) {
      if (!data.sport.sports.length) errs.sports = 'Select at least one sport';
    }
    if (step === 3) {
      if (!data.emergency.name.trim())  errs.emergencyName = 'Required';
      if (!data.emergency.relationship) errs.relationship  = 'Required';
      if (!data.emergency.phone.trim()) errs.phone         = 'Required';
    }
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  }

  function handleBack() {
    setErrors({});
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/api/portal/onboarding', {
        personalInfo:     data.personal,
        sportInfo:        data.sport,
        emergencyContact: data.emergency,
        insurance:        data.insurance,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      await refreshUser();
      navigate('/portal/home', { replace: true });
    } catch (err) {
      setSubmitError(err.response?.data?.error ?? err.message);
      setSubmitting(false);
    }
  }

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="po-page">
      <header className="po-header">
        <div className="po-brand">
          <span className="po-brand-icon">+</span>
          <span className="po-brand-name">Fieldside</span>
        </div>
        <button
          className="po-signout"
          onClick={() => { portalSignOut(); navigate('/portal/login', { replace: true }); }}
        >
          Sign Out
        </button>
      </header>

      <main className="po-main">
        <div className="po-card">
          <div className="po-card-head">
            <h1 className="po-card-title">Complete Your Profile</h1>
            <p className="po-card-subtitle">Step {step} of {STEPS.length} &mdash; {STEPS[step - 1]}</p>
          </div>

          <div className="po-progress-wrap">
            <div className="po-step-dots">
              {STEPS.map((label, i) => (
                <div key={i} className="po-dot-wrap">
                  <div
                    className={`po-dot${i + 1 < step ? ' done' : ''}${i + 1 === step ? ' current' : ''}`}
                    title={label}
                  />
                  {i < STEPS.length - 1 && (
                    <div className={`po-dot-line${i + 1 < step ? ' filled' : ''}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="po-progress">
              <div className="po-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="po-step-body">
            {step === 1 && (
              <StepPersonal
                data={data.personal}
                update={(f, v) => update('personal', f, v)}
                errors={errors}
              />
            )}
            {step === 2 && (
              <StepSport
                data={data.sport}
                update={(f, v) => update('sport', f, v)}
                toggleSport={toggleSport}
                errors={errors}
              />
            )}
            {step === 3 && (
              <StepEmergency
                data={data.emergency}
                update={(f, v) => update('emergency', f, v)}
                errors={errors}
              />
            )}
            {step === 4 && (
              <StepInsurance
                data={data.insurance}
                update={(f, v) => update('insurance', f, v)}
              />
            )}
            {step === 5 && (
              <StepReview data={data} goToStep={setStep} />
            )}
          </div>

          {submitError && <p className="po-submit-error">{submitError}</p>}

          <div className={`po-actions${step > 1 ? ' po-actions--split' : ''}`}>
            {step > 1 && (
              <button className="btn btn--outline" onClick={handleBack} disabled={submitting}>
                Back
              </button>
            )}
            {step < 5 ? (
              <button className="btn btn--primary" onClick={handleNext}>
                Next
              </button>
            ) : (
              <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Saving…' : 'Submit'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
