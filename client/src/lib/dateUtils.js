// Shared date-only parsing/formatting utility.
//
// Use this for `date`-typed columns (injury_date, due_date, expiration_date,
// event_date, session_date, date_of_birth, etc.) — NOT for `timestamptz`
// columns (created_at, submitted_at, authored_at, ...), which already carry
// real time-zone info and should keep using `new Date(iso)` directly.
//
// Why this exists: node-postgres returns `date` columns as JS Date objects,
// which JSON-serializes with a time+Z suffix (e.g. "2026-12-31T00:00:00.000Z").
// Splitting that raw string on '-' without stripping the time suffix first
// corrupts the day segment (`Number("31T00:00:00.000Z")` is NaN) and produces
// "Invalid Date". And calling `new Date(dateString)` directly on a date-only
// string parses it as UTC midnight, which can display as the previous day in
// timezones behind UTC. parseLocalDate/formatDate below build the Date from
// the calendar date's own year/month/day instead, so the displayed day never
// depends on the viewer's timezone.

export function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('T')[0].split('-');
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDate(dateString, options = {}) {
  if (!dateString) return '—';
  const date = parseLocalDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    ...options,
  });
}
