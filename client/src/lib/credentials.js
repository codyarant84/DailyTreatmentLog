// Shared constants and helpers for the AT Document Vault —
// used by the Vault page and the Today dashboard's expiration warning card.

import { parseLocalDate } from './dateUtils.js';

export const CREDENTIAL_TYPES = [
  { key: 'cpr_aed',         label: 'CPR/AED Certification' },
  { key: 'boc',             label: 'BOC Certification' },
  { key: 'state_licensure', label: 'State Licensure' },
  { key: 'nata',            label: 'NATA Membership' },
  { key: 'npi',             label: 'NPI Number' },
  { key: 'insurance',       label: 'Liability Insurance' },
  { key: 'other',           label: 'Other' },
];

export function credentialTypeMeta(key) {
  return CREDENTIAL_TYPES.find((t) => t.key === key) ?? { key, label: key };
}

// Days between today and the given date (negative if already past); null if
// there's no date or it couldn't be parsed.
export function daysUntil(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// green (>60 days), yellow (30-60 days), red (<30 days incl. expired), gray (no date / unparseable)
export function expirationStatus(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return { level: 'none',   bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };
  if (days < 30)      return { level: 'red',    bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
  if (days <= 60)     return { level: 'yellow', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
  return                     { level: 'green',  bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' };
}
