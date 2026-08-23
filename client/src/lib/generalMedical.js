// Shared constants and helpers for the General Medical module —
// used by the log/history page, the Today dashboard, athlete profile, and reports.

export const CATEGORIES = [
  { key: 'heat_illness',   label: 'Heat Illness',   icon: '🌡️' },
  { key: 'illness',        label: 'Illness',        icon: '🤒' },
  { key: 'skin_condition', label: 'Skin Condition', icon: '🩹' },
  { key: 'cardiac',        label: 'Cardiac',        icon: '❤️' },
  { key: 'diabetes',       label: 'Diabetes',       icon: '💉' },
  { key: 'asthma',         label: 'Asthma',         icon: '💨' },
  { key: 'other',          label: 'Other',          icon: '📋' },
];

// Categories not listed here get a free-text subcategory field instead of a dropdown.
export const SUBCATEGORY_OPTIONS = {
  heat_illness:   ['Heat Cramps', 'Heat Exhaustion', 'Heat Stroke'],
  illness:        ['Upper Respiratory', 'Gastrointestinal', 'Flu/COVID', 'Mono', 'Strep', 'Other'],
  skin_condition: ['MRSA', 'Ringworm', 'Impetigo', 'Other'],
};

export const DISPOSITIONS = [
  { key: 'returned_to_activity', label: 'Returned to Activity' },
  { key: 'sent_home',            label: 'Sent Home' },
  { key: 'transported_to_er',    label: 'Transported to ER' },
  { key: 'parent_contacted',     label: 'Parent Contacted' },
  { key: 'physician_referral',   label: 'Physician Referral' },
];

export const CATEGORY_COLORS = {
  heat_illness:   { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  illness:        { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  skin_condition: { bg: '#ede9fe', color: '#4c1d95', border: '#c4b5fd' },
  cardiac:        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  diabetes:       { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  asthma:         { bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  other:          { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
};

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) ?? { key, label: key, icon: '📋' };
}

export function categoryColor(key) {
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS.other;
}

export function dispositionLabel(key) {
  return DISPOSITIONS.find((d) => d.key === key)?.label ?? key;
}

// Mirrors Injuries.jsx's formatDate — event_date is a `date` column, same as injury_date.
export function formatEventDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatEventTime(str) {
  if (!str) return null;
  const [h, m] = str.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
