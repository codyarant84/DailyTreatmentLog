/**
 * CSV parser for Catapult/GPS player data exports.
 * Handles double-quoted fields containing commas and leading BOM.
 */

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function capitalizeName(str) {
  if (!str) return str;
  return str.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** MM/DD/YYYY → YYYY-MM-DD. Passes through already-ISO dates. */
function toIsoDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('/');
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return s;
}

function toFloat(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

const REQUIRED_COLUMNS = [
  'Person ID',
  'Athlete Name',
  'Segment Name',
  'Session Load',
  'Distance (yds)',
];

/**
 * Parse a Catapult GPS export CSV.
 *
 * @param {File} file - Browser File object
 * @returns {Promise<{
 *   athletes: Map<string, object>,
 *   sessions: object[],
 *   zeroData: object[],
 *   skipped: object[],
 *   errors: object[],
 *   batch: object,
 * }>}
 */
export async function parsePlayerDataCSV(file) {
  let text = await file.text();

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/);

  // Parse header row
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  // Validate required columns
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required column: "${col}"`);
    }
  }

  const sessions = [];
  const zeroData = [];
  const skipped = [];
  const errors = [];
  const athletes = new Map(); // athlete_id → athlete object

  const dataLines = lines.slice(1);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = (values[idx] ?? '').trim();
    });

    // Only process 'Whole Session' rows
    if (raw['Segment Name'] !== 'Whole Session') {
      skipped.push(raw);
      continue;
    }

    try {
      const position =
        !raw['Athlete Position'] || raw['Athlete Position'] === 'None'
          ? null
          : raw['Athlete Position'];

      const session_load = toFloat(raw['Session Load']);
      const distance_yds = toFloat(raw['Distance (yds)']);
      const top_speed_mph = toFloat(raw['Top Speed (mph)']);
      const pct_max_speed = toFloat(raw['Percentage of Max Speed']);

      const row = {
        athlete_id: raw['Person ID'],
        name: capitalizeName(raw['Athlete Name']),
        position,
        session_date: toIsoDate(raw['Start Date MM/DD/YYYY']),
        start_time: toFloat(raw['Start Time (s)']),
        end_time: toFloat(raw['End Time (s)']),
        duration_minutes: toInt(raw['Duration (minutes)']),
        week_start_date: toIsoDate(raw['Week Start Date']),
        month_start_date: toIsoDate(raw['Month Start Date']),
        session_type: raw['Session Type'] || null,
        tags: !raw['Tags'] || raw['Tags'] === 'None' ? null : raw['Tags'],
        session_load,
        distance_yds,
        yards_per_min: toFloat(raw['Yards per Minute (yds)']),
        hi_running_yds: toFloat(raw['High Intensity Running (yds)']),
        hi_events: toInt(raw['No. of High Intensity Events']),
        sprint_distance_yds: toFloat(raw['Sprint Distance (yds)']),
        num_sprints: toInt(raw['No. of Sprints']),
        top_speed_mph,
        avg_speed_mph: toFloat(raw['Avg Speed (mph)']),
        accelerations: toInt(raw['Accelerations']),
        decelerations: toInt(raw['Decelerations']),
        pct_max_speed,
        max_acceleration: toFloat(raw['Maximum Acceleration']),
        max_deceleration: toFloat(raw['Maximum Deceleration']),
        new_top_speed: pct_max_speed != null ? pct_max_speed > 100 : false,
      };

      const isZero =
        (session_load == null || session_load === 0) &&
        (distance_yds == null || distance_yds === 0);
      row.data_recorded = !isZero;

      if (isZero) {
        zeroData.push(row);
      } else {
        sessions.push(row);
      }

      // Build / update athletes map
      if (!athletes.has(row.athlete_id)) {
        athletes.set(row.athlete_id, {
          id: row.athlete_id,
          name: row.name,
          position: row.position,
          sport: 'Football',
          team: 'Hewitt-Trussville',
          max_speed_mph: top_speed_mph ?? 0,
        });
      } else {
        const athlete = athletes.get(row.athlete_id);
        if (top_speed_mph != null && top_speed_mph > (athlete.max_speed_mph ?? 0)) {
          athlete.max_speed_mph = top_speed_mph;
        }
        if (!athlete.position && row.position) {
          athlete.position = row.position;
        }
      }
    } catch (err) {
      errors.push({ row: i + 2, error: err.message, raw }); // +2: 1 for header, 1 for 1-based
    }
  }

  const rows_total = dataLines.filter((l) => l.trim()).length;

  const batch = {
    filename: file.name,
    rows_total,
    rows_imported: sessions.length,
    rows_skipped: skipped.length,
    rows_zero_data: zeroData.length,
  };

  return { athletes, sessions, zeroData, skipped, errors, batch };
}

/**
 * Calculate weekly load history and ACWR for a single athlete.
 *
 * Chronic load = average of weekly totals for the 4 weeks (28-day window)
 * ending the current week. ACWR = acute / chronic.
 *
 * @param {string} athleteId
 * @param {object[]} sessions - full sessions array (will be filtered)
 * @returns {Array<{
 *   athlete_id: string,
 *   week_start: string,
 *   weekly_distance_yds: number,
 *   weekly_session_load: number,
 *   weekly_hi_yds: number,
 *   weekly_sprint_yds: number,
 *   weekly_sessions: number,
 *   acute_load: number,
 *   chronic_load: number,
 *   acwr: number,
 *   risk_status: 'red'|'yellow'|'green',
 * }>}
 */
export function calculateLoadHistory(athleteId, sessions) {
  const filtered = sessions.filter(
    (s) => s.athlete_id === athleteId && s.data_recorded === true && (s.session_load ?? 0) > 0
  );

  // Oldest to newest
  filtered.sort((a, b) => (a.session_date ?? '').localeCompare(b.session_date ?? ''));

  // Aggregate per week
  const weekMap = new Map(); // week_start_date → weekly totals

  for (const s of filtered) {
    const w = s.week_start_date;
    if (!w) continue;

    if (!weekMap.has(w)) {
      weekMap.set(w, {
        sessions: 0,
        total_load: 0,
        total_distance_yds: 0,
        total_hi_yds: 0,
        total_sprint_yds: 0,
      });
    }

    const entry = weekMap.get(w);
    entry.sessions += 1;
    entry.total_load += s.session_load ?? 0;
    entry.total_distance_yds += s.distance_yds ?? 0;
    entry.total_hi_yds += s.hi_running_yds ?? 0;
    entry.total_sprint_yds += s.sprint_distance_yds ?? 0;
  }

  const weeks = [...weekMap.keys()].sort();

  return weeks.map((week) => {
    const weekDate = new Date(week + 'T00:00:00Z');

    // 28-day window: [weekDate - 21 days, weekDate]
    const windowStart = new Date(weekDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 21);

    const windowWeeks = weeks.filter((w) => {
      const d = new Date(w + 'T00:00:00Z');
      return d >= windowStart && d <= weekDate;
    });

    const acute_load = weekMap.get(week).total_load;

    const chronic_load =
      windowWeeks.length > 0
        ? windowWeeks.reduce((sum, w) => sum + weekMap.get(w).total_load, 0) / windowWeeks.length
        : 0;

    const acwr = chronic_load > 0 ? acute_load / chronic_load : 1.0;

    let risk_status;
    if (acwr > 1.5) {
      risk_status = 'red';
    } else if (acwr > 1.3 || acwr < 0.8) {
      risk_status = 'yellow';
    } else {
      risk_status = 'green';
    }

    const entry = weekMap.get(week);

    return {
      athlete_id: athleteId,
      week_start: week,
      weekly_distance_yds: entry.total_distance_yds,
      weekly_session_load: entry.total_load,
      weekly_hi_yds: entry.total_hi_yds,
      weekly_sprint_yds: entry.total_sprint_yds,
      weekly_sessions: entry.sessions,
      acute_load,
      chronic_load,
      acwr,
      risk_status,
    };
  });
}
