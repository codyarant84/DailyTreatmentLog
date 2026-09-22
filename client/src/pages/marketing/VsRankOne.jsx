import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import '../MarketingPage.css';
import './MarketingSubpage.css';

const ROWS = [
  {
    feature: 'Primary audience',
    fieldside: { status: 'yes', text: 'Built specifically for athletic trainers and clinical documentation' },
    competitor: { status: 'partial', text: 'Built primarily for athletic directors — eligibility, forms, and scheduling' },
  },
  {
    feature: 'Clinical injury & treatment documentation',
    fieldside: { status: 'yes', text: 'Core product — injury tracking, RTP status, SOAP notes, treatment logs' },
    competitor: { status: 'partial', text: 'Basic injury and treatment tracking alongside administrative tools' },
  },
  {
    feature: 'Pricing',
    fieldside: 'Straightforward, demo-based pricing built for program budgets of any size',
    competitor: 'Custom pricing, typically sold at the district/association level',
  },
  {
    feature: 'GPS load monitoring',
    fieldside: { status: 'yes', text: 'Built-in GPS dashboard with ACWR-based load alerts' },
    competitor: { status: 'no', text: 'Not a publicly listed feature' },
  },
  {
    feature: 'SMS-to-log injury reporting',
    fieldside: { status: 'yes', text: 'Text a description to log a draft injury, parsed automatically' },
    competitor: { status: 'partial', text: 'Secure messaging available (not SMS-to-record)' },
  },
  {
    feature: 'Athlete/parent portal with Google SSO',
    fieldside: { status: 'yes', text: 'One-tap sign-in with an existing Google account' },
    competitor: { status: 'partial', text: 'Parent/athlete access available; login method is school-issued, not Google SSO' },
  },
  {
    feature: 'Built by a working athletic trainer',
    fieldside: { status: 'yes', text: 'Built and actively used by a certified athletic trainer' },
    competitor: { status: 'no', text: 'Founding team not publicly specified' },
  },
  {
    feature: 'Inventory management',
    fieldside: { status: 'yes', text: 'Supplies, equipment checkout, and controlled substance logging' },
    competitor: { status: 'no', text: 'Not a publicly listed feature' },
  },
  {
    feature: 'CEU library & AT credential vault',
    fieldside: { status: 'yes', text: 'Both included, with expiration alerts on your own credentials' },
    competitor: { status: 'no', text: 'Not a publicly listed feature' },
  },
];

function Cell({ value }) {
  if (typeof value === 'string') return <td>{value}</td>;
  const cls = value.status === 'yes' ? 'compare-yes' : value.status === 'partial' ? 'compare-partial' : 'compare-no';
  return <td className={cls}>{value.text}</td>;
}

export default function VsRankOne() {
  return (
    <div className="mp-page">
      <SeoHead
        title="Fieldside vs Rank One"
        description="An honest comparison of Fieldside and Rank One Sport for athletic trainers — clinical documentation depth, GPS load monitoring, SMS injury logging, and who each platform is really built for."
        path="/vs-rank-one"
      />
      <MarketingNav />

      <section className="sub-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Comparison</p>
          <h1 className="mp-section-title">Fieldside vs Rank One</h1>
          <p className="mp-section-sub">
            Rank One is a well-established athletic administration platform. It's worth understanding
            what it's actually built for before comparing it to a clinical documentation tool.
          </p>
        </div>
      </section>

      <section className="sub-section">
        <div className="mp-section-inner">
          <div className="sub-text-block" style={{ marginBottom: '2.5rem' }}>
            <p>
              Rank One's own positioning describes it as a platform for "Athletic Directors, Fine Arts
              Directors, Trainers, and Coaches" — built around eligibility management, electronic
              forms, and scheduling for entire athletic departments. That's a genuinely useful and
              different problem than the one Fieldside solves. Fieldside is built specifically for the
              athletic trainer's clinical workflow: injury documentation, treatment logs, return-to-play
              tracking, and concussion management — the parts of the job an AD-focused platform treats
              as a secondary feature rather than the core product.
            </p>
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="compare-col-fieldside">Fieldside</th>
                  <th>Rank One</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td className="compare-feature-name">{row.feature}</td>
                    <Cell value={row.fieldside} />
                    <Cell value={row.competitor} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-disclaimer">
            Comparison based on publicly available information on Rank One's website as of this page's
            publication. Features, pricing, and offerings may change — contact Rank One directly to
            confirm current details before making a decision.
          </p>

          <div className="mp-hero-actions" style={{ marginTop: '2.5rem', justifyContent: 'center' }}>
            <Link to="/#demo" className="mp-btn-primary mp-btn-lg">See Fieldside for Yourself</Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
