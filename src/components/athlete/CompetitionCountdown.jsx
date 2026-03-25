import { Link } from 'react-router-dom';
import { FiFlag, FiMapPin } from 'react-icons/fi';

/**
 * Formats minutes into "Xh Ym" display string.
 * e.g. 95 → "1h 35m", 30 → "30m", 120 → "2h 0m"
 *
 * @param {number} minutes
 * @returns {string}
 */
const formatGoalTime = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

/**
 * Competition countdown widget for the Athlete Dashboard.
 * Displays the next upcoming competition with days remaining.
 *
 * Props:
 *   competition – competition object with event_date, name, distance_km,
 *                 location, goal_time_minutes, daysUntil
 */
const CompetitionCountdown = ({ competition }) => {
  if (!competition) {
    return (
      <div className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-10 text-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
        <FiFlag className="w-10 h-10 text-white/40 mb-2" />
        <p className="text-sm text-white/70 font-medium">No hay competiciones programadas</p>
        <Link to="/athlete/competitions" className="mt-3 text-xs text-white/60 underline">
          Añadir competición
        </Link>
      </div>
    );
  }

  const { daysUntil, name, event_date, distance_km, location, goal_time_minutes } = competition;
  const eventDate = new Date(event_date + 'T00:00:00');
  const goalTimeStr = formatGoalTime(goal_time_minutes);
  const progressPct = Math.min(100, Math.max(5, (90 - daysUntil) / 90 * 100));

  return (
    <Link
      to="/athlete/competitions"
      className="relative rounded-2xl overflow-hidden flex-1 bg-gradient-to-br from-blue-600 to-blue-800 block"
    >
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10 bg-white" />

      <div className="relative p-5">
        {/* Header label */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            <span role="img" aria-label="trofeo">🏆</span> Próxima Competición
          </span>
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold text-white leading-tight mb-3">
          {name}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-white/75 mb-5 flex-wrap">
          {location && (
            <span className="flex items-center gap-1">
              <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
          {distance_km && (
            <span className="flex-shrink-0">{distance_km} km</span>
          )}
          {goalTimeStr && (
            <span className="flex-shrink-0 text-white/60">Objetivo: {goalTimeStr}</span>
          )}
        </div>

        {/* Days counter + progress */}
        <div className="flex items-end justify-between mb-3">
          <div>
            {daysUntil === 0 ? (
              <span className="text-4xl font-bold text-white leading-none">Hoy</span>
            ) : (
              <>
                <span className="text-5xl font-bold text-white leading-none">{daysUntil}</span>
                <span className="text-sm text-white/70 ml-1.5">días</span>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60 mb-1">
              {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {daysUntil > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-white/60 mb-1.5">
              <span>Cuenta atrás</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default CompetitionCountdown;
