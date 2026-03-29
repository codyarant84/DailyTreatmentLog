import { Link } from 'react-router-dom';
import './TreatmentCard.css';

const TREATMENT_COLORS = {
  'Ice':                   '#2980b9',
  'Heat':                  '#e67e22',
  'Massage':               '#8e44ad',
  'Taping':                '#16a085',
  'E-Stim':               '#d35400',
  'Ultrasound':            '#2c3e50',
  'Exercise':              '#c0392b',
  // legacy values from earlier scaffold
  'Ice / Cryotherapy':     '#2980b9',
  'Heat Therapy':          '#e67e22',
  'Taping / Bracing':      '#16a085',
  'Stretching':            '#27ae60',
  'Electrical Stimulation':'#d35400',
  'Exercise / Rehab':      '#c0392b',
  'Other':                 '#7f8c8d',
};

function badgeColor(type) {
  return TREATMENT_COLORS[type] || '#7f8c8d';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function TreatmentCard({ treatment, onDelete }) {
  const { id, athlete_name, date, treatment_type, body_part, notes, duration_minutes } = treatment;
  const color = badgeColor(treatment_type);

  return (
    <article className="treatment-card">
      <div className="card-accent" style={{ backgroundColor: color }} />
      <div className="card-body">
        <div className="card-header">
          <div className="card-meta">
            <Link
              to={`/athletes/${encodeURIComponent(athlete_name)}`}
              className="athlete-name athlete-name--link"
            >
              {athlete_name}
            </Link>
            <span className="card-date">{formatDate(date)}</span>
          </div>
          <button
            className="delete-btn"
            onClick={() => onDelete(id)}
            aria-label="Delete treatment"
            title="Delete"
          >
            &times;
          </button>
        </div>

        <div className="card-tags">
          <span className="tag" style={{ backgroundColor: color + '22', color }}>
            {treatment_type}
          </span>
          <span className="tag tag--body">{body_part}</span>
          {duration_minutes && (
            <span className="tag tag--duration">{duration_minutes} min</span>
          )}
        </div>

        {notes && <p className="card-notes">{notes}</p>}
      </div>
    </article>
  );
}

export default TreatmentCard;
