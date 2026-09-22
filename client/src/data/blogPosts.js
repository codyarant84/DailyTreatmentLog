// Static blog content — no database, no CMS. Add a new object to this array
// to publish a new post. `content` is an array of simple block objects
// ({ type: 'p' | 'h2' | 'h3' | 'ul' }) rendered by BlogPost.jsx — this avoids
// pulling in a markdown parser for four articles.
//
// Note: only Article 1's publish date was specified in the original content
// brief ("September 2025"). Articles 2-4 didn't have dates specified, so
// they're dated on a monthly cadence following it (Oct/Nov/Dec 2025) —
// adjust `date` below if a different publish schedule is intended.

export const blogPosts = [
  {
    slug: 'how-to-choose-sports-medicine-emr',
    title: 'How to Choose a Sports Medicine EMR for High School Athletic Trainers',
    date: '2025-09-01',
    dateLabel: 'September 2025',
    excerpt: 'What to actually look for in a sports medicine EMR, the mistakes most ATs make when picking software, and the questions worth asking every vendor before you sign anything.',
    content: [
      { type: 'p', text: "If you're an athletic trainer shopping for documentation software, you already know the problem: most \"medical software\" wasn't built for what you do. You're not running a clinic with scheduled appointments and billing codes. You're covering three practices and a game on the same afternoon, documenting on your phone between reps, and trying to keep injury records straight for two hundred athletes across a dozen sports. Here's what actually matters when you're choosing a sports medicine EMR — and what doesn't." },

      { type: 'h2', text: 'HIPAA compliance is non-negotiable' },
      { type: 'p', text: "This sounds obvious, but it trips up more ATs than you'd think — mostly because \"HIPAA compliant\" gets used as a marketing phrase rather than a technical fact. A platform storing athlete health information needs encrypted data at rest and in transit, role-based access control so coaches can't see clinical notes they have no business seeing, and a signed Business Associate Agreement (BAA) available on request. If a vendor can't produce a BAA or gets vague when you ask about their infrastructure, that's your answer. This isn't optional compliance theater — it's the difference between a defensible record system and a liability." },

      { type: 'h2', text: 'Mobile-first, not mobile-friendly' },
      { type: 'p', text: "There's a real difference between an app that technically works on a phone and one that was designed for how ATs actually work. You need to log a treatment in under a minute standing at a treatment table, not fill out a ten-field form meant for a desktop screen shrunk down to fit your pocket. Test this yourself before buying: pull up the vendor's demo on your own phone, standing up, and try to log a mock treatment in the time it'd take between athletes. If it's clunky, it'll stay clunky after you've paid for it." },

      { type: 'h2', text: 'Ease of use beats feature count' },
      { type: 'p', text: "Every vendor will show you a features list a mile long. Almost none of it matters if the core workflow — logging today's treatments and injuries — takes too many taps. The AT software graveyard is full of platforms that tried to be everything (billing, scheduling, EMR, performance analytics) and made the daily basics worse in the process. Ask yourself what you'll actually use every single day, and weight your evaluation toward that, not the feature checklist." },

      { type: 'h2', text: 'Price relative to your actual budget' },
      { type: 'p', text: "High school athletic programs generally don't have hospital-system budgets, and a lot of sports medicine software is priced as if they do. Get a real, all-in number — not a teaser price that balloons once you add the modules you actually need (concussion management, reporting, parent communication). Ask specifically what's included at the quoted price and what's an add-on." },

      { type: 'h2', text: 'Common mistakes ATs make when choosing software' },
      { type: 'p', text: "The biggest one: picking based on a polished sales demo instead of your own daily workflow. A demo is choreographed to look good. Ask to trial the product yourself, on your own devices, doing the tasks you actually do — logging a treatment, pulling up an athlete's injury history mid-conversation with a parent, generating a report for a physician. The second most common mistake is not asking who's building the product. A lot of \"sports medicine\" software is generic medical records software with a sports skin on it, built by people who've never stood on a sideline. That shows up in small but constant friction — fields that don't map to how you actually think about an injury, workflows built for a clinic visit instead of a training room." },

      { type: 'h2', text: 'Questions worth asking every vendor' },
      { type: 'ul', items: [
        'Will you sign a BAA, and can I see your data security documentation?',
        'What does the mobile experience actually look like — can I try it myself, right now?',
        "What's the true all-in price, including the modules I'll actually need?",
        'Was this built specifically for athletic trainers, or adapted from something else?',
        'How is support handled when something breaks during a Friday night game?',
      ]},

      { type: 'h2', text: 'Why purpose-built beats generic' },
      { type: 'p', text: "Generic medical records software is built for the general case — any clinic, any specialty. That generality is exactly what makes it clunky for athletic training, where the workflow (sideline evaluation, same-day documentation, return-to-play tracking tied to practice and game schedules) is genuinely different from a scheduled clinic visit. Software built specifically for ATs, by people who've done the job, tends to get the small things right that generic platforms never bother with — because those details only matter if you've actually lived them." },
      { type: 'p', text: "That's the principle Fieldside was built around: a platform designed by a certified athletic trainer, for the actual daily workflow of athletic training — fast treatment logging, injury tracking tied to return-to-play status, and documentation that doesn't get in the way of the job it's supposed to support." },
    ],
  },
  {
    slug: 'hipaa-compliance-athletic-trainers',
    title: 'HIPAA Compliance for Athletic Trainers — What You Actually Need to Know',
    date: '2025-10-01',
    dateLabel: 'October 2025',
    excerpt: "Yes, HIPAA applies to you. Here's what a BAA actually is, what compliant infrastructure looks like, and the common violations ATs make without realizing it.",
    content: [
      { type: 'p', text: "\"Does HIPAA even apply to me?\" is one of the most common questions athletic trainers ask, usually right after they've been doing something that technically violates it for years. The short answer: yes, in most cases. If you're documenting athlete injuries and treatments as part of a covered relationship — most school and clinic-affiliated AT positions qualify — you're handling protected health information (PHI), and HIPAA's rules apply to how you store, share, and transmit it." },

      { type: 'h2', text: 'What counts as PHI in an athletic training setting' },
      { type: 'p', text: "PHI isn't just diagnosis codes and billing records. An athlete's name attached to any health detail — an injury description, a treatment note, a return-to-play status, even a text saying \"Jake's knee is still swollen\" — is PHI the moment it's identifiable and health-related. That's a lower bar than most ATs assume, and it's why casual communication habits (group texts, personal email, sticky notes) create real exposure." },

      { type: 'h2', text: 'What a BAA actually is, and why you need one' },
      { type: 'p', text: "A Business Associate Agreement is a contract between a covered entity (you, your school, your clinic) and any vendor that handles PHI on your behalf — your EMR provider, your cloud storage, sometimes your texting platform. It legally obligates that vendor to protect the data to HIPAA standards and spells out what happens if there's a breach. If you're using software to store athlete health records and there's no BAA in place, you — not just the vendor — are exposed if something goes wrong. Any legitimate health software vendor will have a BAA ready to sign. If a vendor hesitates or doesn't know what you're asking for, that's a serious red flag." },

      { type: 'h2', text: 'What HIPAA-compliant infrastructure actually looks like' },
      { type: 'p', text: "In practical terms: data encrypted both in transit and at rest, access controls so only people with a legitimate need can see specific records (a coach shouldn't have the same access as the AT), audit logging so there's a record of who accessed what and when, and a hosting environment (like AWS or Azure with the right configuration) built for handling regulated health data. None of this is visible to you as a user — which is exactly why you have to ask about it directly rather than assume it's handled." },

      { type: 'h2', text: 'Common violations ATs make without realizing it' },
      { type: 'ul', items: [
        'Texting injury details from a personal phone number to a coach or parent',
        'Using a shared Google Sheet or spreadsheet to track injuries or treatment logs',
        'Emailing physician referral notes without encryption',
        'Leaving printed injury reports visible in a training room or athletic office',
        'Using group texts or team messaging apps to relay athlete health status',
      ]},
      { type: 'p', text: "None of these come from bad intent — they come from convenience, and from nobody ever explaining where the actual line is. But \"I didn't know that counted\" doesn't hold up if there's ever an incident, and the athlete or parent didn't consent to their information moving through an unsecured channel." },

      { type: 'h2', text: 'How to protect yourself and your athletes' },
      { type: 'p', text: "Start with the systems you use daily. If your documentation lives in spreadsheets, personal notes apps, or texts, that's the first thing to fix — move to a platform built for health records with the encryption, access control, and BAA already in place. Second, be deliberate about what you share and how: a phone call or a message through a secure, audited platform beats a text every time PHI is involved. Third, know your own compliance obligations — check with your school or employer about what training or policy already exists, since you may be operating under an institutional BAA you're not even aware of." },
      { type: 'p', text: "This is exactly the gap Fieldside is built to close — encrypted, access-controlled documentation with a signed BAA available, so the daily convenience of a fast, mobile-first workflow doesn't come at the cost of the legal protection you and your athletes actually need." },
    ],
  },
  {
    slug: 'acwr-injury-prevention-high-school-athletes',
    title: 'ACWR and GPS Load Monitoring — The Injury Prevention Tool High School ATs Need',
    date: '2025-11-01',
    dateLabel: 'November 2025',
    excerpt: "What ACWR actually measures, why the 0.8–1.3 range matters, and how GPS data lets you catch overuse risk before an athlete ends up on your table with a soft-tissue injury.",
    content: [
      { type: 'p', text: "If you've spent any time around sports science content in the last few years, you've run into the term ACWR — Acute:Chronic Workload Ratio. It sounds like something reserved for college and professional programs with a full sports science staff, but the underlying idea is simple enough to be useful at the high school level too, and GPS wearables have made the data far more accessible than it used to be." },

      { type: 'h2', text: "What ACWR actually measures" },
      { type: 'p', text: "ACWR compares an athlete's recent workload (the \"acute\" load — typically the past 7 days) to their longer-term average workload (the \"chronic\" load — typically a rolling 28-day average). Divide acute by chronic and you get a ratio. A ratio near 1.0 means an athlete's current training load is in line with what their body has adapted to over the past month. A ratio that spikes well above 1.0 means their recent workload has jumped sharply above what they're conditioned for — which is exactly the scenario where soft-tissue and overuse injuries tend to happen." },

      { type: 'h2', text: "Why the 0.8–1.3 range matters" },
      { type: 'p', text: "Research on workload and injury risk (most notably from sports scientist Tim Gabbett) has repeatedly pointed to a \"sweet spot\" ACWR range of roughly 0.8 to 1.3. Inside that range, injury risk is comparatively low — the athlete is training hard enough to keep adapting without a sudden, unmanaged spike. Above about 1.5, injury risk climbs sharply. Below 0.8 carries its own risk: an athlete who's undertrained relative to their normal load can actually be more injury-prone once they return to full activity, because their tissue has partially detrained. The practical takeaway for an AT isn't to treat 0.8–1.3 as a hard rule for every athlete — it's a signal, not a diagnosis — but it's a genuinely useful early-warning number when you're watching two hundred athletes and can't individually assess everyone's training history every week." },

      { type: 'h2', text: "How GPS devices actually track this" },
      { type: 'p', text: "GPS wearables — small units worn between the shoulder blades, usually in a fitted vest — track an athlete's movement throughout practice and games: total distance covered, high-speed running distance, number of accelerations and decelerations, and player load (a composite measure of overall physical stress derived from movement in multiple planes). None of these numbers mean much in isolation on a single day. What matters is the trend — how this week's numbers compare to the athlete's own rolling average, which is exactly what ACWR calculates automatically once you have a few weeks of data flowing in." },

      { type: 'h2', text: "Using this data before it becomes an injury" },
      { type: 'p', text: "The practical use case for a high school AT isn't running a sports science lab — it's a weekly (or even daily) glance at which athletes have a load ratio trending into risk territory, especially after a break, a return from injury, or a schedule change like a tournament weekend with three games in two days. An athlete coming back from a lower-body injury who jumps straight back into full training load is a textbook re-injury risk, and it's one ACWR is specifically good at flagging — because it's comparing that athlete's own recent load against their own recent baseline, not against some generic standard." },
      { type: 'p', text: "This is also where GPS load monitoring earns its place next to your injury log rather than as a separate performance-analytics side project: the real value comes from viewing load trends and injury history together, for the same athlete, in the same place. That's the thinking behind Fieldside's GPS dashboard — load data and injury records live side by side, so a spike in one shows up right next to the athlete's actual clinical history, instead of living in a separate performance tool an AT has to check independently." },
      { type: 'p', text: "If you're new to GPS load monitoring, you don't need to become a sports scientist to get value from it. Start by watching the trend, not the single-day number, and treat a rising ACWR as a reason to have a conversation with the coach about that athlete's week — not as a rule that benches anyone automatically." },
    ],
  },
  {
    slug: 'true-cost-paper-injury-documentation',
    title: 'The True Cost of Paper-Based Injury Documentation for Athletic Trainers',
    date: '2025-12-01',
    dateLabel: 'December 2025',
    excerpt: "Twenty minutes a day doesn't sound like much — until you add up 60+ hours a year, the records you can't find when a physician calls, and the HIPAA exposure sitting in a filing cabinet.",
    content: [
      { type: 'p', text: "Paper injury logs feel free. There's no software subscription, no login, no learning curve — just a clipboard and a pen you already own. But \"free\" is the wrong frame. Paper documentation has real costs; they're just hidden in time, risk, and missed information instead of a line item on an invoice." },

      { type: 'h2', text: "The time cost, actually calculated" },
      { type: 'p', text: "Say an AT spends just 20 minutes a day on paperwork — writing up treatment notes, updating an injury log, transcribing something onto a form a physician or AD requested. Over a 180-day school-year season, that's 60 hours. Over a full year including offseason conditioning and multi-sport coverage, it's often closer to 80–100 hours. That's two to two and a half full work weeks spent moving information from a clipboard into a usable form — time that isn't spent with athletes, isn't spent on rehab programming, and doesn't show up anywhere as \"lost\" until you actually add it up like this." },

      { type: 'h2', text: "The HIPAA risk sitting in a filing cabinet" },
      { type: 'p', text: "A folder of paper injury records is protected health information with none of the safeguards HIPAA expects — no encryption, no access log, no way to know if someone flipped through it who shouldn't have. It's also physically vulnerable in ways digital records aren't: a locked filing cabinet is a much lower bar than encrypted, access-controlled cloud storage, and it's trivially easy for that cabinet to end up in a shared athletic office, a training room with regular foot traffic, or a car during an away trip." },

      { type: 'h2', text: "Records that go missing or become illegible" },
      { type: 'p', text: "Paper doesn't survive well. Pages get left on a bus, soaked in a rainstorm during an outdoor practice, or simply misfiled among hundreds of similar sheets. Handwriting quality varies under pressure — a note scrawled mid-practice about an ankle injury three weeks ago may not be legible even to the person who wrote it. When a physician, parent, or AD asks for a specific athlete's injury history, \"let me go dig through the filing cabinet\" is a bad answer that paper-based systems make unavoidable." },

      { type: 'h2', text: "No ability to see trends" },
      { type: 'p', text: "This might be the biggest hidden cost. A binder of individual injury sheets can't show you that your program has had six hamstring strains this season concentrated in one sport, or that a particular athlete's ankle sprains are becoming more frequent, or that injury rates spike every year during a specific point in preseason conditioning. That pattern-level view — the kind that actually changes how a program manages workload or return-to-play protocols — simply doesn't exist when every record is an isolated piece of paper. It requires records that can be searched, filtered, and compared, which paper structurally cannot do." },

      { type: 'h2', text: "Difficulty generating reports physicians and ADs actually need" },
      { type: 'p', text: "When a physician needs a clean history for a referral, or an AD needs an end-of-season injury report for the school board, paper means manually re-transcribing information that already exists — a second round of the same time cost, under a deadline, usually done by hand at the worst possible moment. A digital system that can generate that report in the time it takes to click a button isn't a convenience feature; it's the difference between a same-day turnaround and a week of catch-up work." },

      { type: 'h2', text: "How digital documentation pays for itself" },
      { type: 'p', text: "Put the numbers next to each other: 60-100 hours a year of transcription time, the HIPAA exposure of unsecured paper records, the real cost of a lost or illegible record when it matters most, and the reporting work that has to be redone by hand every time someone asks for a summary. Against that, a documentation platform that takes the same 20 minutes a day and turns it into structured, searchable, reportable records — with built-in HIPAA-compliant storage — isn't really a new cost. It's replacing time and risk you're already paying with money that buys back your afternoons instead. That's the practical case for moving off paper, independent of any specific product — though it's exactly the gap tools like Fieldside are built to close, with treatment logging fast enough to actually replace the clipboard rather than just digitizing the same slow process." },
    ],
  },
];

export function getPostBySlug(slug) {
  return blogPosts.find((p) => p.slug === slug) ?? null;
}
