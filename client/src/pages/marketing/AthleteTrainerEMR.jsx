import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import '../MarketingPage.css';
import './MarketingSubpage.css';

export default function AthleteTrainerEMR() {
  return (
    <div className="mp-page">
      <SeoHead
        title="Athletic Trainer EMR Software"
        description="What an athletic trainer EMR is, why generic medical software falls short for sports medicine, and how Fieldside was built specifically for the AT workflow."
        path="/athletic-trainer-emr"
      />
      <MarketingNav />

      <section className="sub-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Athletic Trainer EMR</p>
          <h1 className="mp-section-title">Electronic medical records built for athletic trainers.</h1>
          <p className="mp-section-sub">
            Not adapted from a hospital system. Not a spreadsheet with extra steps. An EMR designed
            around the way athletic trainers actually work.
          </p>
          <div className="mp-hero-actions">
            <Link to="/#demo" className="mp-btn-primary mp-btn-lg">Request a Free Demo</Link>
          </div>
        </div>
      </section>

      <section className="sub-section">
        <div className="mp-section-inner">
          <div className="sub-text-block">
            <h2>What is an athletic trainer EMR?</h2>
            <p>
              An athletic trainer EMR is electronic medical records software built specifically to
              document the clinical work of athletic training — injury evaluation, treatment logs,
              return-to-play tracking, and concussion management — for the population of athletes an
              AT is responsible for. It's a narrower and more specific category than general medical
              EMR software, which is built for scheduled clinic visits, billing codes, and specialties
              that don't map cleanly onto sideline and training-room care.
            </p>

            <h2>Why athletic trainers need software built specifically for them</h2>
            <p>
              The daily workflow of an athletic trainer looks nothing like a clinic visit. There's no
              scheduled appointment slot for taping an ankle between classes, no billing code for a
              same-day sideline evaluation, and no single specialty that covers concussion management,
              rehab programming, and return-to-play communication with coaches and parents all at once.
              Generic medical EMR software — even software marketed as "sports medicine" — is often
              just general clinic software with different field labels. It technically stores the data,
              but the workflow fights you at every step: too many clicks to log a routine treatment,
              no clean way to track RTP progression, no visibility into workload trends that actually
              predict injury risk.
            </p>
            <p>
              Purpose-built AT software closes that gap by starting from the actual job instead of a
              generic clinical template — fast documentation designed for standing at a treatment
              table, injury tracking tied to return-to-play status instead of billing status, and
              workflows that assume you're covering a roster of athletes, not scheduling individual
              patient visits.
            </p>

            <h2>What to look for in an athletic trainer EMR</h2>
            <ul>
              <li>HIPAA-compliant infrastructure with a signed Business Associate Agreement available</li>
              <li>A mobile experience fast enough to use standing up, between athletes</li>
              <li>Injury tracking tied to return-to-play status, not just a diagnosis field</li>
              <li>Concussion management with a documented, step-by-step RTP protocol</li>
              <li>Reporting that generates a clean document for physicians and administrators on demand</li>
              <li>Pricing that fits a school or program budget, not a hospital system budget</li>
            </ul>

            <h2>Fieldside: an EMR built by an athletic trainer, for athletic trainers</h2>
            <p>
              Fieldside is athletic trainer EMR software built around the actual daily workflow of the
              job — treatment logging fast enough to replace a paper clipboard, injury tracking tied to
              return-to-play status, concussion management with a digital protocol, and GPS load
              monitoring to catch overuse risk before it becomes an injury. It's built and used by a
              certified athletic trainer, which shows up in the details that generic software tends to
              get wrong.
            </p>
          </div>
        </div>
      </section>

      <section className="sub-cta-banner">
        <div className="mp-section-inner">
          <h2>See it built for your workflow, not adapted to it.</h2>
          <p>Free demo, no sales pressure, no forced add-on modules.</p>
          <Link to="/#demo" className="mp-btn-primary mp-btn-lg" style={{ background: '#fff', color: 'var(--color-primary)' }}>
            Request a Free Demo
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
