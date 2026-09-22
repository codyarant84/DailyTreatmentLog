import { Link } from 'react-router-dom';
import MarketingNav from '../../components/marketing/MarketingNav.jsx';
import MarketingFooter from '../../components/marketing/MarketingFooter.jsx';
import SeoHead from '../../components/marketing/SeoHead.jsx';
import '../MarketingPage.css';
import './MarketingSubpage.css';

const CATEGORIES = [
  {
    category: 'Injury Management',
    features: [
      {
        name: 'Injury tracking & RTP status',
        description: 'Log injuries with body part, mechanism, severity, and a return-to-play status that updates as an athlete progresses.',
        context: 'Why it matters: coaches and athletes need one clear, current answer to "can they play?" — not a guess based on the last conversation.',
      },
      {
        name: 'Physician clearance tracking',
        description: 'Track clearance status separately from RTP progression, so a physician sign-off is recorded distinctly from your own clinical judgment.',
        context: 'Why it matters: RTP decisions and physician clearance are not the same thing, and conflating them is a common documentation gap.',
      },
      {
        name: 'High-risk flag system',
        description: 'Automatic flags surface athletes who meet clinical risk criteria — overdue clearance, unresolved concussions, and more — on your dashboard and roster.',
        context: 'Why it matters: with a full roster, the athletes who need attention shouldn’t depend on you remembering them.',
      },
      {
        name: 'Injury attachments',
        description: 'Attach photos and documents directly to an injury record — imaging, physician notes, or visual documentation of the injury itself.',
        context: 'Why it matters: a photo taken at the time of injury is often more useful to a physician than a written description alone.',
      },
    ],
  },
  {
    category: 'Treatment Documentation',
    features: [
      {
        name: 'Daily treatment log',
        description: 'Log modality, body part, and notes for every athlete visit in a form built to be completed in under a minute.',
        context: 'Why it matters: documentation that takes too long doesn’t get done consistently, and inconsistent records are worse than no records.',
      },
      {
        name: 'SOAP notes',
        description: 'Structured Subjective/Objective/Assessment/Plan notes tied directly to a specific injury.',
        context: 'Why it matters: SOAP format is the clinical documentation standard physicians and insurers expect to see.',
      },
      {
        name: 'Full treatment history per athlete',
        description: 'Every treatment, filterable by date range and modality, on a single athlete profile.',
        context: 'Why it matters: when a parent or physician asks "what have you been doing for this," you should be able to answer in seconds, not by searching.',
      },
    ],
  },
  {
    category: 'Concussion Management',
    features: [
      {
        name: 'Concussion case tracking',
        description: 'Open and manage concussion cases from initial evaluation through full return-to-play clearance.',
        context: 'Why it matters: concussion protocols involve more steps and more legal exposure than almost any other injury type — the process needs to be documented, not remembered.',
      },
      {
        name: 'Digital RTP protocols',
        description: 'Step-by-step return-to-play progression tracked digitally, with each stage recorded as it’s completed.',
        context: 'Why it matters: a defensible concussion record shows the graduated protocol was actually followed, not just that a final clearance was signed.',
      },
      {
        name: 'Athlete self-check-in links',
        description: 'Send athletes a secure link to self-report daily concussion symptoms without needing an account.',
        context: 'Why it matters: symptom tracking between in-person visits is easy to lose — a low-friction check-in keeps the data coming in.',
      },
    ],
  },
  {
    category: 'GPS Load Monitoring',
    features: [
      {
        name: 'GPS data import & dashboard',
        description: 'Import wearable GPS data and view distance, player load, and workload trends across your roster.',
        context: 'Why it matters: overuse injuries often build up silently over weeks — you need the trend, not just today’s number.',
      },
      {
        name: 'ACWR-based load alerts',
        description: 'Automatic flags when an athlete’s acute:chronic workload ratio moves outside a safe range.',
        context: 'Why it matters: this is one of the few tools that can flag overuse injury risk before the injury happens, not after.',
      },
      {
        name: 'Load data next to injury history',
        description: 'GPS trends and injury records live on the same athlete profile, not in a separate performance-analytics tool.',
        context: 'Why it matters: a load spike means more when you can see it right next to that athlete’s actual injury history.',
      },
    ],
  },
  {
    category: 'Athlete & Parent Portal',
    features: [
      {
        name: 'Parent portal with Google SSO',
        description: 'Parents sign in with their existing Google account to view their athlete’s injury status and forms — no new password to manage.',
        context: 'Why it matters: portal adoption depends entirely on how easy it is to log in — friction here means parents just call or text you instead.',
      },
      {
        name: 'Athlete treatment request booking',
        description: 'Athletes request an appointment time directly through the portal based on your published availability.',
        context: 'Why it matters: fewer hallway "can I come by after practice" conversations that you have to remember and schedule manually.',
      },
      {
        name: 'Rehab program access',
        description: 'Athletes can view their assigned rehab exercises, sets, reps, and instructional video directly in the portal.',
        context: 'Why it matters: home exercise compliance improves when the instructions are always accessible, not just handed out once on paper.',
      },
    ],
  },
  {
    category: 'Forms & Compliance',
    features: [
      {
        name: 'Digital forms builder',
        description: 'Build custom intake, consent, and pre-participation forms that athletes or parents complete digitally.',
        context: 'Why it matters: paper physical forms get lost between the front office, the coach, and the AT — a digital form has one home.',
      },
      {
        name: 'AT credential vault',
        description: 'Store your own CPR/AED, BOC certification, state licensure, and other credentials with automatic expiration alerts.',
        context: 'Why it matters: a lapsed certification discovered during an audit is a preventable problem, not a surprise one.',
      },
      {
        name: 'CEU library & tracking',
        description: 'Track continuing education completions toward your BOC requirement, with AI-assisted discovery of free CEU opportunities.',
        context: 'Why it matters: recertification tracking is easy to let slide until the deadline is suddenly close.',
      },
    ],
  },
  {
    category: 'Reporting',
    features: [
      {
        name: 'PDF report builder',
        description: 'Generate a clean, professional PDF for any athlete — injuries, treatments, concussions, and SOAP notes — in a few clicks.',
        context: 'Why it matters: physicians and administrators want a document, not a login to your software.',
      },
      {
        name: 'Automated daily injury reports',
        description: 'Send a scheduled daily summary of active injuries to coaches, ADs, or staff via email automatically.',
        context: 'Why it matters: replaces the manual "who do I need to update today" email chain with something that just happens.',
      },
      {
        name: 'Activity log',
        description: 'A full audit trail of who accessed or changed what, and when.',
        context: 'Why it matters: this is the record that matters if anyone ever asks who saw or changed an athlete’s information.',
      },
    ],
  },
  {
    category: 'Practice Management',
    features: [
      {
        name: 'AT availability scheduling',
        description: 'Publish your treatment room availability and manage incoming appointment requests in one place.',
        context: 'Why it matters: a predictable schedule reduces the constant interruptions of ad hoc "do you have a minute" requests.',
      },
      {
        name: 'Rehab program builder',
        description: 'Build reusable rehab programs from an exercise library, complete with sets, reps, and video demonstrations.',
        context: 'Why it matters: building a program from scratch every time is slower and less consistent than working from a library.',
      },
      {
        name: 'Inventory management',
        description: 'Track supplies, equipment checkouts, and medications — including controlled substance logging for DEA-style audit trails.',
        context: 'Why it matters: running out of tape mid-week or losing track of a checked-out brace is a preventable operational failure.',
      },
    ],
  },
  {
    category: 'Administrative Tools',
    features: [
      {
        name: 'Role-based access control',
        description: 'Separate permissions for athletic trainers, coaches, and administrators, so each role sees only what it needs.',
        context: 'Why it matters: a coach doesn’t need — and shouldn’t have — the same access to clinical notes as the AT.',
      },
      {
        name: 'Organization settings & school year advancement',
        description: 'Configure your organization type (high school, college, semi-pro, club) and advance your roster a grade or year in one action.',
        context: 'Why it matters: manually updating grade level for an entire roster every year is exactly the kind of tedious task software should absorb.',
      },
      {
        name: 'Multi-school administration',
        description: 'Organizations managing multiple schools or programs get a single admin view across all of them.',
        context: 'Why it matters: a district or multi-site organization shouldn’t need a separate login for every location.',
      },
    ],
  },
];

export default function Features() {
  return (
    <div className="mp-page">
      <SeoHead
        title="Features"
        description="A full breakdown of Fieldside's athletic training platform — injury management, treatment documentation, concussion management, GPS load monitoring, parent portal, and more."
        path="/features"
      />
      <MarketingNav />

      <section className="sub-hero">
        <div className="mp-section-inner">
          <p className="mp-eyebrow">Everything Fieldside does</p>
          <h1 className="mp-section-title">Built for every part of an athletic trainer's day.</h1>
          <p className="mp-section-sub">
            Every feature below exists because a working athletic trainer needed it. Here's the full
            breakdown, organized by workflow.
          </p>
          <div className="mp-hero-actions">
            <Link to="/#demo" className="mp-btn-primary mp-btn-lg">Request a Free Demo</Link>
          </div>
        </div>
      </section>

      <section className="sub-section">
        <div className="mp-section-inner">
          {CATEGORIES.map((cat) => (
            <div className="feature-category" key={cat.category}>
              <h2 className="feature-category-title">{cat.category}</h2>
              <div className="feature-category-grid">
                {cat.features.map((f) => (
                  <div className="feature-detail-card" key={f.name}>
                    <h3 className="feature-detail-name">{f.name}</h3>
                    <p className="feature-detail-desc">{f.description}</p>
                    <p className="feature-detail-context">{f.context}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
