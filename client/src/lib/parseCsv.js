// ── Column alias map ──────────────────────────────────────────────────────────
// Maps canonical field names to the various spellings found in real roster exports.
const COLUMN_ALIASES = {
  name: [
    'name', 'athlete', 'athlete name', 'athlete_name',
    'full name', 'full_name', 'player', 'player name', 'student', 'student name',
  ],
  sport: ['sport', 'sports', 'team', 'activity', 'program'],
  grade: [
    'grade', 'yr', 'year', 'class', 'grade level', 'school year',
    'classification', 'class year', 'grade_level',
  ],
  date_of_birth: [
    'dob', 'date of birth', 'date_of_birth', 'birthdate',
    'birth date', 'birth_date', 'birthday', 'born', 'birth',
  ],
};

export const FIELD_LABELS = {
  name:          'Athlete Name',
  sport:         'Sport',
  grade:         'Grade',
  date_of_birth: 'Date of Birth',
};

function normalizeKey(s) {
  return s.toLowerCase().trim().replace(/[\s_\-]+/g, ' ');
}

export function detectColumnMap(headers) {
  const map = {}; // canonical → original header string in the CSV
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const found = headers.find((h) => aliases.includes(normalizeKey(h)));
    if (found) map[canonical] = found;
  }
  return map;
}

// ── Date normalizer ───────────────────────────────────────────────────────────
// Returns ISO YYYY-MM-DD or null if the format is unrecognizable.
export function normalizeDate(str) {
  if (!str?.trim()) return null;
  const s = str.trim();

  // YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY or MM-DD-YYYY (4-digit year)
  const mdy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy4) {
    const [, m, d, y] = mdy4;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YY or MM-DD-YY (2-digit year)
  const mdy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (mdy2) {
    const [, m, d, yy] = mdy2;
    const year = Number(yy) > 30 ? `19${yy}` : `20${yy}`;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

// ── Raw CSV tokenizer ─────────────────────────────────────────────────────────
// Handles quoted fields (including commas and escaped double-quotes within them).
function tokenizeLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Parses raw CSV text into structured athlete rows.
 *
 * Returns one of:
 *   { error: string }                            — unrecoverable parse error
 *   { headers, columnMap, rows, warnings }       — success
 *
 * Each row: { name, sport, grade, date_of_birth } (all nullable except name)
 */
export function parseCsvFile(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) {
    return { error: 'The file appears to be empty.' };
  }

  const headers = tokenizeLine(lines[0]).map((h) => h.trim());
  const columnMap = detectColumnMap(headers);

  if (!columnMap.name) {
    return {
      error:
        'Could not find an athlete name column. Expected a column named ' +
        '"name", "athlete", "athlete_name", or similar.',
      headers,
      columnMap,
    };
  }

  const rows     = [];
  const warnings = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = tokenizeLine(lines[i]);

    // Helper: get a trimmed value by canonical field name
    const get = (canonical) => {
      const header = columnMap[canonical];
      if (!header) return '';
      const idx = headers.indexOf(header);
      return idx >= 0 ? (fields[idx] ?? '').trim() : '';
    };

    const name = get('name');
    if (!name) {
      warnings.push({ rowNum: i + 1, message: `Row ${i + 1}: missing athlete name — skipped` });
      continue;
    }

    const dobRaw       = get('date_of_birth');
    const date_of_birth = normalizeDate(dobRaw);

    if (dobRaw && !date_of_birth) {
      warnings.push({
        rowNum: i + 1,
        message: `Row ${i + 1} (${name}): unrecognized date "${dobRaw}" — date of birth left blank`,
      });
    }

    rows.push({
      name,
      sport:         get('sport')  || null,
      grade:         get('grade')  || null,
      date_of_birth: date_of_birth || null,
    });
  }

  return { headers, columnMap, rows, warnings };
}
