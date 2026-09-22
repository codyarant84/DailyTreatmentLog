import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import '../MarketingPage.css';
import './MarketingSubpage.css';

export default function HIPAACompliance() {
  return (
    <div className="mp-page">
      <SeoHead
        title="HIPAA Compliance"
        description="How Fieldside protects athlete health information — AWS infrastructure, signed Business Associate Agreements, encryption, and role-based access control."
        path="/hipaa-compliance"
      />
      <MarketingNav />

      <section className="sub-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Trust & Compliance</p>
          <h1 className="mp-section-title">HIPAA compliance, built in from the start.</h1>
          <p className="mp-section-sub">
            Athlete health information deserves the same protection as any other protected health
            information — here's exactly how Fieldside handles it.
          </p>
        </div>
      </section>

      <section className="sub-section">
        <div className="mp-section-inner">
          <div className="sub-text-block">
            <h2>AWS infrastructure</h2>
            <p>
              Fieldside is hosted on Amazon Web Services (AWS) — the same infrastructure used by
              hospital systems and major healthcare platforms. AWS offers HIPAA-eligible services
              under a signed Business Associate Addendum, and Fieldside's database, file storage, and
              application hosting all run within that HIPAA-eligible AWS environment rather than on
              generic, unmanaged hosting.
            </p>

            <h2>Signed Business Associate Agreement</h2>
            <p>
              Any vendor handling protected health information on your behalf needs to sign a Business
              Associate Agreement (BAA) with your school or organization — it's a legal requirement,
              not an optional add-on. Fieldside provides a signed BAA to every school or organization
              that requests one. If a sports medicine software vendor can't produce a BAA, that's a
              compliance gap you'd be inheriting, not just them.
            </p>

            <h2>Data encryption</h2>
            <p>
              Connections between Fieldside and its database are encrypted in transit, and data storage
              runs on AWS-managed infrastructure built to support encryption at rest. Passwords are
              never stored in plain text — they're hashed before storage, so even in the event of a
              breach, credentials themselves are not directly exposed.
            </p>

            <h2>Role-based access control</h2>
            <p>
              Not everyone who logs into Fieldside sees the same thing. Coaches, athletic trainers, and
              administrators each have distinct, scoped permissions — a coach can see the information
              relevant to managing their team, while clinical notes, treatment details, and full injury
              histories are restricted to athletic trainers and administrators. Every account action is
              recorded in an activity log, so there's a clear record of who accessed or changed what,
              and when.
            </p>

            <h2>What to ask any sports medicine software vendor about HIPAA</h2>
            <p>
              Whether or not you choose Fieldside, ask any vendor handling athlete health information
              these questions before you sign a contract:
            </p>
            <ul>
              <li>Will you sign a Business Associate Agreement, and can I see it before purchasing?</li>
              <li>Where is data hosted, and is that infrastructure HIPAA-eligible?</li>
              <li>Is data encrypted both in transit and at rest?</li>
              <li>How are user permissions scoped — can a coach see clinical notes they shouldn't?</li>
              <li>Is there an audit log of who accessed or changed a record, and when?</li>
              <li>What's the breach notification process, and what are you contractually obligated to tell us?</li>
            </ul>
            <p>
              If a vendor can't answer these clearly, that's the answer. HIPAA compliance isn't a
              feature you can bolt on later — it has to be built into the infrastructure from the
              start.
            </p>
          </div>
        </div>
      </section>

      <section className="sub-cta-banner">
        <div className="mp-section-inner">
          <h2>See Fieldside's compliance approach for yourself.</h2>
          <p>Request a demo and we'll walk through the details, including our BAA.</p>
          <Link to="/#demo" className="mp-btn-primary mp-btn-lg" style={{ background: '#fff', color: 'var(--color-primary)' }}>
            Request a Free Demo
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
