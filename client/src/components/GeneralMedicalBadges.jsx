import { categoryMeta, categoryColor, dispositionLabel } from '../lib/generalMedical.js';
import './GeneralMedicalBadges.css';

export function CategoryBadge({ category }) {
  const meta = categoryMeta(category);
  const c = categoryColor(category);
  return (
    <span className="gm-badge" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      {meta.label}
    </span>
  );
}

export function DispositionBadge({ disposition }) {
  return <span className="gm-badge gm-badge--outline">{dispositionLabel(disposition)}</span>;
}
