// Shared inline SVG icons — replacements for emoji used as functional icons
// elsewhere in the app. Stroke-based, matching the icon style already used in
// App.jsx's nav icons. Default to 1em sizing so they drop into containers
// that size their icon via CSS `font-size` (the same way the emoji they
// replaced did) without needing any CSS changes.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function WarningIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ClockIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function CheckCircleIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function ChevronDownIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function PlayIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

export function DocumentIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function MailIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}

export function PencilIcon({ size = '1em', ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
