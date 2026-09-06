// Display metadata for the High Risk Flag system — severity colors shared by
// the Today dashboard, Athletes list, and Athlete Profile pages.

export const SEVERITY_COLORS = {
  high:   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  medium: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

export function severityColor(severity) {
  return SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.medium;
}
