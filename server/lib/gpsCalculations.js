/**
 * GPS load history and ACWR calculations — ported from client parsePlayerDataCSV.js.
 * Pure logic, no external dependencies.
 */

/**
 * Calculate weekly load history and ACWR for a single athlete.
 *
 * Chronic load = average of weekly totals for the 4 weeks (28-day window)
 * ending the current week. ACWR = acute / chronic.
 *
 * @param {string} athleteId
 * @param {object[]} sessions - full sessions array for this athlete
 * @param {boolean} isInSeason
 * @returns {Array<object>}
 */
export function calculateLoadHistory(athleteId, sessions, isInSeason = true) {
  const filtered = sessions.filter(
    (s) => s.data_recorded === true && (s.session_load ?? 0) > 0
  );

  // Oldest to newest
  filtered.sort((a, b) => (a.session_date ?? '').localeCompare(b.session_date ?? ''));

  // Aggregate per week
  const weekMap = new Map(); // week_start_date → weekly totals

  for (const s of filtered) {
    const w = s.week_start_date;
    if (!w) continue;

    if (!weekMap.has(w)) {
      weekMap.set(w, { sessions: 0, total_load: 0, total_distance_yds: 0, total_hi_yds: 0, total_sprint_yds: 0 });
    }

    const entry = weekMap.get(w);
    entry.sessions          += 1;
    entry.total_load        += s.session_load        ?? 0;
    entry.total_distance_yds += s.distance_yds       ?? 0;
    entry.total_hi_yds      += s.hi_running_yds      ?? 0;
    entry.total_sprint_yds  += s.sprint_distance_yds ?? 0;
  }

  const weeks = [...weekMap.keys()].sort();

  return weeks.map((week) => {
    const weekDate    = new Date(week + 'T00:00:00Z');
    const windowStart = new Date(weekDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 21);

    const windowWeeks = weeks.filter((w) => {
      const d = new Date(w + 'T00:00:00Z');
      return d >= windowStart && d <= weekDate;
    });

    const entry       = weekMap.get(week);
    const acute_load  = entry.total_load;
    const chronic_load =
      windowWeeks.length > 0
        ? windowWeeks.reduce((sum, w) => sum + weekMap.get(w).total_load, 0) / windowWeeks.length
        : 0;
    const acwr = chronic_load > 0 ? acute_load / chronic_load : 1.0;

    let risk_status;
    if      (acwr > 1.5)                      risk_status = 'red';
    else if (acwr > 1.3)                      risk_status = 'yellow';
    else if (isInSeason && acwr < 0.8)        risk_status = 'yellow';
    else                                       risk_status = 'green';

    return {
      athlete_id:           athleteId,
      week_start:           week,
      weekly_distance_yds:  entry.total_distance_yds,
      weekly_session_load:  entry.total_load,
      weekly_hi_yds:        entry.total_hi_yds,
      weekly_sprint_yds:    entry.total_sprint_yds,
      weekly_sessions:      entry.sessions,
      acute_load,
      chronic_load,
      acwr,
      risk_status,
    };
  });
}
