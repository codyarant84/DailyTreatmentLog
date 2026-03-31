import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './TreatmentCard.css';

function formatDollars(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const TREATMENT_COLORS = {
  'Ice':                   '#2980b9',
  'Heat':                  '#e67e22',
  'Massage':               '#8e44ad',
  'Taping':                '#16a085',
  'E-Stim':                '#d35400',
  'Ultrasound':            '#2c3e50',
  'Exercise':              '#c0392b',
  'Cupping':               '#6d4c8f',
  // legacy values from earlier scaffold
  'Ice / Cryotherapy':     '#2980b9',
  'Heat Therapy':          '#e67e22',
  'Taping / Bracing':      '#16a085',
  'Stretching':            '#27ae60',
  'Electrical Stimulation':'#d35400',
  'Exercise / Rehab':      '#c0392b',
  'Other':                 '#7f8c8d',
};

const DEFAULT_COLOR = '#7f8c8d';

function badgeColor(type) {
  return TREATMENT_COLORS[type.trim()] || DEFAULT_COLOR;
}

function accentColor(types) {
  // Use the first type's color for the left accent bar
  const first = types[0];
  return first ? badgeColor(first) : DEFAULT_COLOR;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function TreatmentCard({ treatment, onDelete }) {
  const { branding } = useAuth();
  const costPerVisit = branding?.costPerVisit ?? 50;
  const { id, athlete_name, sport, date, treatment_type, body_part, notes, duration_minutes, exercises_performed } = treatment;

  // treatment_type may be a comma-separated string (e.g. "Ice, Heat, Cupping")
  const types = treatment_type ? treatment_type.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const exercises = exercises_performed ? exercises_performed.split(',').map((e) => e.trim()).filter(Boolean) : [];

  return (
    <article className="treatment-card">
      <div className="card-accent" style={{ backgroundColor: accentColor(types) }} />
      <div className="card-body">
        <div className="card-header">
          <div className="card-meta">
            <Link
              to={`/athletes/${encodeURIComponent(athlete_name)}`}
              className="athlete-name athlete-name--link"
            >
              {athlete_name}
            </Link>
            <div className="card-date-row">
              <span className="card-date">{formatDate(date)}</span>
              {sport && <span className="tag tag--sport">{sport}</span>}
            </div>
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
          {types.map((type) => {
            const color = badgeColor(type);
            return (
              <span key={type} className="tag" style={{ backgroundColor: color + '22', color }}>
                {type}
              </span>
            );
          })}
          <span className="tag tag--body">{body_part}</span>
          {duration_minutes && (
            <span className="tag tag--duration">{duration_minutes} min</span>
          )}
          {costPerVisit > 0 && (
            <span className="tag tag--savings" title="Estimated cost savings based on your configured rate">
              {formatDollars(costPerVisit)} saved
            </span>
          )}
        </div>

        {exercises.length > 0 && (
          <div className="card-exercises">
            {exercises.map((ex) => (
              <span key={ex} className="exercise-tag">{ex}</span>
            ))}
          </div>
        )}

        {notes && <p className="card-notes">{notes}</p>}
      </div>
    </article>
  );
}

export default TreatmentCard;
