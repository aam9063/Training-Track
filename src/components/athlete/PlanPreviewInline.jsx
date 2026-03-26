import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FiCheck,
  FiLoader,
  FiMapPin,
  FiClock,
  FiZap,
} from 'react-icons/fi';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MAP = {
  monday:        { label: 'Lunes' },
  tuesday:       { label: 'Martes' },
  wednesday:     { label: 'Miércoles' },
  thursday:      { label: 'Jueves' },
  friday:        { label: 'Viernes' },
  saturday:      { label: 'Sábado' },
  sunday:        { label: 'Domingo' },
};

const TYPE_CONFIG = {
  carrera:       { label: 'Carrera',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  running:       { label: 'Carrera',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  gimnasio:      { label: 'Gimnasio', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  gym:           { label: 'Gimnasio', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  cross_training: { label: 'Cross',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  descanso:      { label: 'Descanso', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  rest:          { label: 'Descanso', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const INTENSITY_CONFIG = {
  low:      { label: 'Suave',        dot: 'bg-green-500' },
  moderate: { label: 'Moderada',     dot: 'bg-yellow-500' },
  high:     { label: 'Alta',         dot: 'bg-red-500' },
  recovery: { label: 'Recuperación', dot: 'bg-blue-400' },
};

const TIER_LABELS = {
  full:          'Datos completos',
  mixed:         'Datos + perfil',
  profile_heavy: 'Basado en perfil',
  profile_only:  'Solo perfil',
};

const WEEK_PHASE_LABELS = ['Carga 1', 'Carga 2', 'Pico', 'Descarga'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeConfig(type) {
  return TYPE_CONFIG[type] ?? { label: type ?? 'Entrenamiento', color: 'bg-slate-100 text-slate-700' };
}

function getIntensityConfig(intensity) {
  return INTENSITY_CONFIG[intensity] ?? { label: intensity ?? '', dot: 'bg-slate-400' };
}

function computeWeekStats(sessions) {
  const trainingSessions = sessions.filter(
    s => s.training_type !== 'descanso' && s.training_type !== 'rest',
  );
  const totalKm = sessions.reduce((sum, s) => {
    const isRest = s.training_type === 'descanso' || s.training_type === 'rest';
    return sum + (isRest ? 0 : (s.estimated_distance_km ?? 0));
  }, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.estimated_duration_minutes ?? 0), 0);
  return {
    trainingDays: trainingSessions.length,
    totalKm: Math.round(totalKm * 10) / 10,
    totalMinutes,
  };
}

// ─── PreviewSessionCard ───────────────────────────────────────────────────────

function PreviewSessionCard({ session }) {
  const typeConf = getTypeConfig(session.training_type);
  const intensityConf = getIntensityConfig(session.intensity);
  const isRest = session.training_type === 'descanso' || session.training_type === 'rest';
  const dayLabel = DAY_MAP[session.day_of_week]?.label ?? session.day_of_week ?? '';

  return (
    <div
      className={`rounded-xl border p-3 min-w-0 overflow-hidden ${
        isRest
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          {dayLabel}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeConf.color}`}>
          {typeConf.label}
        </span>
      </div>

      {isRest ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          Descanso — recuperación completa
        </p>
      ) : (
        <>
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">
            {session.title || 'Entrenamiento'}
          </h4>

          {session.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
              {session.description}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {(session.estimated_distance_km ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <FiMapPin className="w-3 h-3" />
                <span>{session.estimated_distance_km} km</span>
              </div>
            )}
            {(session.estimated_duration_minutes ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <FiClock className="w-3 h-3" />
                <span>{session.estimated_duration_minutes} min</span>
              </div>
            )}
            {session.intensity && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span className={`w-2 h-2 rounded-full ${intensityConf.dot}`} />
                <span>{intensityConf.label}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── PlanPreviewInline ────────────────────────────────────────────────────────

export default function PlanPreviewInline({ plan, onAssign, onDiscard, isAssigning }) {
  const [activeWeek, setActiveWeek] = useState(0);

  const weekStatsList = useMemo(
    () => (plan?.weeks ?? []).map(w => computeWeekStats(w.sessions ?? [])),
    [plan],
  );

  if (!plan) return null;

  const weeks = plan.weeks ?? [];
  const tierLabel = TIER_LABELS[plan.tier] ?? plan.tier ?? '';
  const activeSessions = weeks[activeWeek]?.sessions ?? [];
  const activeStats = weekStatsList[activeWeek];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
    >
      {/* ── Header ── */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Vista previa
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {plan.plan_name || 'Plan generado con IA'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <FiZap className="w-3 h-3" />
                {tierLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {plan.duration_weeks ?? weeks.length} semanas
              </span>
            </div>
          </div>
        </div>

        {/* Week selector: select on mobile, tabs on desktop */}
        <div className="mt-4">
          {/* Mobile: native select */}
          <select
            value={activeWeek}
            onChange={(e) => setActiveWeek(Number(e.target.value))}
            className="md:hidden w-full max-w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 truncate"
          >
            {weeks.map((w, idx) => (
              <option key={w.week_number ?? idx} value={idx}>
                S{w.week_number ?? idx + 1} · {WEEK_PHASE_LABELS[idx] ?? `Sem ${idx + 1}`} · {weekStatsList[idx].totalKm}km
              </option>
            ))}
          </select>

          {/* Desktop: tab buttons */}
          <div className="hidden md:flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {weeks.map((w, idx) => (
              <button
                key={w.week_number ?? idx}
                type="button"
                onClick={() => setActiveWeek(idx)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeWeek === idx
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="block">Sem {w.week_number ?? idx + 1}</span>
                <span className="block text-xs opacity-75">
                  {WEEK_PHASE_LABELS[idx] ?? `Semana ${idx + 1}`} · {weekStatsList[idx].totalKm}km
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Session cards ── */}
      <div className="px-4 sm:px-6 py-4 overflow-hidden">
        {activeSessions.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
            No hay sesiones para esta semana.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeSessions.map((session, idx) => (
              <PreviewSessionCard
                key={`${activeWeek}-${session.day_of_week ?? idx}`}
                session={session}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Week summary stats ── */}
      {activeStats && (
        <div className="px-4 sm:px-6 pb-4">
          <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-400">
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{activeStats.trainingDays}</span> días de entrenamiento
            </span>
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{activeStats.totalKm}</span> km totales
            </span>
            {activeStats.totalMinutes > 0 && (
              <span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{activeStats.totalMinutes}</span> min totales
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isAssigning}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onAssign}
          disabled={isAssigning}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {isAssigning ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Asignando…
            </>
          ) : (
            <>
              <FiCheck className="w-4 h-4" />
              Asignar Plan
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
