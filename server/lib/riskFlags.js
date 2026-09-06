import { query } from './db.js';

// Nothing in this module is cached — every call queries live data, by design.
// Flags must appear/disappear in real time as the underlying records change.

export const RISK_FLAG_TYPES = {
  active_concussion:   { label: 'Active Concussion',   severity: 'high' },
  multiple_injuries:   { label: 'Multiple Injuries',   severity: 'medium' },
  neglected_injury:    { label: 'Neglected Injury',    severity: 'medium' },
  overdue_clearance:   { label: 'Overdue Clearance',   severity: 'high' },
  cardiac_history:     { label: 'Cardiac History',     severity: 'high' },
  heat_stroke_history: { label: 'Heat Stroke History', severity: 'medium' },
};

function makeFlag(type, description) {
  const meta = RISK_FLAG_TYPES[type];
  return { type, label: meta.label, severity: meta.severity, description };
}

// Active risk flags for a single athlete.
export async function calculateRiskFlags(athleteId, schoolId) {
  const [concussion, multiInjuries, neglected, overdue, cardiac, heatStroke] = await Promise.all([
    query(
      `SELECT 1 FROM concussion_cases WHERE athlete_id = $1 AND school_id = $2 AND status = 'active' LIMIT 1`,
      [athleteId, schoolId]
    ),
    query(
      `SELECT COUNT(*)::int AS cnt FROM injuries
       WHERE athlete_id = $1 AND school_id = $2 AND created_at >= now() - interval '30 days'`,
      [athleteId, schoolId]
    ),
    query(
      `SELECT 1 FROM injuries i
       WHERE i.athlete_id = $1 AND i.school_id = $2 AND i.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM daily_treatments dt
         WHERE dt.injury_id = i.id AND dt.created_at >= now() - interval '7 days'
       )
       LIMIT 1`,
      [athleteId, schoolId]
    ),
    query(
      `SELECT 1 FROM injuries
       WHERE athlete_id = $1 AND school_id = $2 AND is_active = true
       AND clearance_status = 'pending_physician'
       AND injury_date <= CURRENT_DATE - INTERVAL '14 days'
       LIMIT 1`,
      [athleteId, schoolId]
    ),
    query(
      `SELECT 1 FROM general_medical WHERE athlete_id = $1 AND school_id = $2 AND category = 'cardiac' LIMIT 1`,
      [athleteId, schoolId]
    ),
    query(
      `SELECT 1 FROM general_medical
       WHERE athlete_id = $1 AND school_id = $2 AND category = 'heat_illness' AND subcategory = 'Heat Stroke'
       LIMIT 1`,
      [athleteId, schoolId]
    ),
  ]);

  const flags = [];
  if (concussion.rows.length > 0) {
    flags.push(makeFlag('active_concussion', 'Athlete has an open concussion case.'));
  }
  if (multiInjuries.rows[0].cnt >= 2) {
    flags.push(makeFlag('multiple_injuries', `${multiInjuries.rows[0].cnt} injuries logged in the last 30 days.`));
  }
  if (neglected.rows.length > 0) {
    flags.push(makeFlag('neglected_injury', 'Active injury with no treatment logged in the last 7 days.'));
  }
  if (overdue.rows.length > 0) {
    flags.push(makeFlag('overdue_clearance', 'Injury pending physician clearance for over 14 days.'));
  }
  if (cardiac.rows.length > 0) {
    flags.push(makeFlag('cardiac_history', 'Athlete has a documented cardiac event on file.'));
  }
  if (heatStroke.rows.length > 0) {
    flags.push(makeFlag('heat_stroke_history', 'Athlete has a documented heat stroke event on file.'));
  }
  return flags;
}

// School-wide risk flags for every athlete at once. Deliberately written as a
// handful of batch queries (one per criterion, grouped by athlete_id) rather
// than looping calculateRiskFlags() per athlete — that would be 6x N queries
// on every dashboard load.
export async function getHighRiskAthletes(schoolId, { coachSport } = {}) {
  const [
    concussionRows, multiInjuryRows, neglectedRows,
    overdueRows, cardiacRows, heatStrokeRows, athleteRows,
  ] = await Promise.all([
    query(
      `SELECT DISTINCT athlete_id FROM concussion_cases WHERE school_id = $1 AND status = 'active'`,
      [schoolId]
    ),
    query(
      `SELECT athlete_id, COUNT(*)::int AS cnt FROM injuries
       WHERE school_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY athlete_id HAVING COUNT(*) >= 2`,
      [schoolId]
    ),
    query(
      `SELECT DISTINCT i.athlete_id FROM injuries i
       WHERE i.school_id = $1 AND i.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM daily_treatments dt
         WHERE dt.injury_id = i.id AND dt.created_at >= now() - interval '7 days'
       )`,
      [schoolId]
    ),
    query(
      `SELECT DISTINCT athlete_id FROM injuries
       WHERE school_id = $1 AND is_active = true AND clearance_status = 'pending_physician'
       AND injury_date <= CURRENT_DATE - INTERVAL '14 days'`,
      [schoolId]
    ),
    query(
      `SELECT DISTINCT athlete_id FROM general_medical WHERE school_id = $1 AND category = 'cardiac'`,
      [schoolId]
    ),
    query(
      `SELECT DISTINCT athlete_id FROM general_medical
       WHERE school_id = $1 AND category = 'heat_illness' AND subcategory = 'Heat Stroke'`,
      [schoolId]
    ),
    coachSport
      ? query(`SELECT id, name, sport FROM athletes WHERE school_id = $1 AND sport = $2`, [schoolId, coachSport])
      : query(`SELECT id, name, sport FROM athletes WHERE school_id = $1`, [schoolId]),
  ]);

  const flagsByAthlete = new Map();
  function addFlag(athleteId, type, description) {
    if (!flagsByAthlete.has(athleteId)) flagsByAthlete.set(athleteId, []);
    flagsByAthlete.get(athleteId).push(makeFlag(type, description));
  }

  concussionRows.rows.forEach((r) => addFlag(r.athlete_id, 'active_concussion', 'Athlete has an open concussion case.'));
  multiInjuryRows.rows.forEach((r) => addFlag(r.athlete_id, 'multiple_injuries', `${r.cnt} injuries logged in the last 30 days.`));
  neglectedRows.rows.forEach((r) => addFlag(r.athlete_id, 'neglected_injury', 'Active injury with no treatment logged in the last 7 days.'));
  overdueRows.rows.forEach((r) => addFlag(r.athlete_id, 'overdue_clearance', 'Injury pending physician clearance for over 14 days.'));
  cardiacRows.rows.forEach((r) => addFlag(r.athlete_id, 'cardiac_history', 'Athlete has a documented cardiac event on file.'));
  heatStrokeRows.rows.forEach((r) => addFlag(r.athlete_id, 'heat_stroke_history', 'Athlete has a documented heat stroke event on file.'));

  return athleteRows.rows
    .filter((a) => flagsByAthlete.has(a.id))
    .map((a) => ({ ...a, flags: flagsByAthlete.get(a.id) }));
}
