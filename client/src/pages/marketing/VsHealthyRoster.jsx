import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import '../MarketingPage.css';
import './MarketingSubpage.css';

const ROWS = [
  {
    feature: 'Pricing',
    fieldside: 'Straightforward, demo-based pricing built for program budgets of any size',
    competitor: 'Custom pricing starting around $199/year, scaling with users and add-on modules',
  },
  {
    feature: 'GPS load monitoring',
    fieldside: { status: 'yes', text: 'Built-in GPS dashboard with ACWR-based load alerts' },
    competitor: { status: 'no', text: 'Not a publicly listed feature' },
  },
  {
    feature: 'SMS-to-log injury reporting',
    fieldside: { status: 'yes', text: 'Text a description to log a draft injury, parsed automatically' },
    competitor: { status: 'partial', text: 'Secure in-app messaging (not SMS-to-record)' },
  },
  {
    feature: 'Athlete/parent portal with Google SSO',
    fieldside: { status: 'yes', text: 'One-tap sign-in with an existing Google account' },
    competitor: { status: 'partial', text: 'Communication and engagement tools available; SSO method not publicly specified' },
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
    feature: 'CEU library',
    fieldside: { status: 'yes', text: 'Included, with AI-assisted discovery of free CEU opportunities' },
    competitor: { status: 'partial', text: 'BOC-approved CEU courses available as a separate product' },
  },
  {
    feature: 'AT personal credential vault',
    fieldside: { status: 'yes', text: 'Track your own certifications with expiration alerts' },
    competitor: { status: 'no', text: 'Not a publicly listed feature' },
  },
];

function Cell({ value }) {
  if (typeof value === 'string') return <td>{value}</td>;
  const cls = value.status === 'yes' ? 'compare-yes' : value.status === 'partial' ? 'compare-partial' : 'compare-no';
  return <td className={cls}>{value.text}</td>;
}

export default function VsHealthyRoster() {
  return (
    <div className="mp-page">
      <SeoHead
        title="Fieldside vs Healthy Roster"
        description="An honest, feature-by-feature comparison of Fieldside and Healthy Roster for athletic trainers — pricing, GPS load monitoring, SMS injury logging, and more."
        path="/vs-healthy-roster"
      />
      <MarketingNav />

      <section className="sub-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Comparison</p>
          <h1 className="mp-section-title">Fieldside vs Healthy Roster</h1>
          <p className="mp-section-sub">
            Both are built for sports medicine documentation. Here's an honest, feature-by-feature
            look at where they differ.
          </p>
        </div>
      </section>

      <section className="sub-section">
        <div className="mp-section-inner">
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="compare-col-fieldside">Fieldside</th>
                  <th>Healthy Roster</th>
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
            Comparison based on publicly available information on each vendor's website as of this
            page's publication. Features, pricing, and offerings may change — contact each vendor
            directly to confirm current details before making a decision.
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
