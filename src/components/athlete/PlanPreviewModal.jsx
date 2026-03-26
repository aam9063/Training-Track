import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiCheck,
  FiLoader,
  FiMapPin,
  FiClock,
  FiZap,
} from 'react-icons/fi';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_MAP = {
  monday:    { label: 'Lunes',     short: 'Lun' },
  tuesday:   { label: 'Martes',    short: 'Mar' },
  wednesday: { label: 'Miércoles', short: 'Mié' },
  thursday:  { label: 'Jueves',    short: 'Jue' },
  friday:    { label: 'Viernes',   short: 'Vie' },
  saturday:  { label: 'Sábado',    short: 'Sáb' },
  sunday:    { label: 'Domingo',   short: 'Dom' },
};

const TYPE_CONFIG = {
  carrera:      { label: 'Carrera',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  running:      { label: 'Carrera',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  gimnasio:     { label: 'Gimnasio',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  gym:          { label: 'Gimnasio',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  cross_training: { label: 'Cross',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  descanso:     { label: 'Descanso',  color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  rest:         { label: 'Descanso',  color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const INTENSITY_CONFIG = {
  low:      { label: 'Suave',         dot: 'bg-green-500' },
  moderate: { label: 'Moderada',      dot: 'bg-yellow-500' },
  high:     { label: 'Alta',          dot: 'bg-red-500' },
  recovery: { label: 'Recuperación',  dot: 'bg-blue-400' },
};

const TIER_LABELS = {
  full:          'Datos completos',
  mixed:         'Datos + perfil',
  profile_heavy: 'Basado en perfil',
  profile_only:  'Solo perfil',
};

const WEEK_PHASE_LABELS = ['Carga 1', 'Carga 2', 'Pico', 'Descarga'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeConfig(type) {
  return TYPE_CONFIG[type] ?? { label: type ?? 'Entrenamiento', color: 'bg-slate-100 text-slate-700' };
}

function getIntensityConfig(intensity) {
  return INTENSITY_CONFIG[intensity] ?? { label: intensity ?? '', dot: 'bg-slate-400' };
}

function computeWeekKm(sessions) {
  return sessions.reduce((sum, s) => {
    const isRest = s.training_type === 'descanso' || s.training_type === 'rest';
    return sum + (isRest ? 0 : (s.estimated_distance_km ?? 0));
  }, 0);
}

// ─── PreviewSessionCard ───────────────────────────────────────────────────────

function PreviewSessionCard({ session }) {
  const typeConf = getTypeConfig(session.training_type);
  const intensityConf = getIntensityConfig(session.intensity);
  const isRest = session.training_type === 'descanso' || session.training_type === 'rest';
  const dayInfo = DAY_MAP[session.day_of_week] ?? { label: session.day_of_week ?? '', short: '' };

  return (
    <div
      className={`rounded-xl border p-3 ${
        isRest
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      {/* Day + type badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          {dayInfo.label}
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

// ─── PlanPreviewModal ─────────────────────────────────────────────────────────

export default function PlanPreviewModal({ plan, onAssign, onDiscard, isAssigning }) {
  const [activeWeek, setActiveWeek] = useState(0);

  const weekKmList = useMemo(
    () => (plan?.weeks ?? []).map(w => Math.round(computeWeekKm(w.sessions ?? []) * 10) / 10),
    [plan],
  );

  if (!plan) return null;

  const weeks = plan.weeks ?? [];
  const tierLabel = TIER_LABELS[plan.tier] ?? plan.tier ?? '';
  const activeSessions = weeks[activeWeek]?.sessions ?? [];

  return (
    <AnimatePresence>
      <motion.div
        key="plan-preview-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-white dark:bg-slate-900 w-full sm:rounded-2xl sm:max-w-5xl max-h-[92dvh] sm:max-h-[88vh] overflow-hidden flex flex-col rounded-t-2xl shadow-2xl"
        >
          {/* ── Header ── */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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
              <button
                type="button"
                onClick={onDiscard}
                disabled={isAssigning}
                aria-label="Cerrar vista previa"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <FiX className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Week tabs */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
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
                    {WEEK_PHASE_LABELS[idx] ?? `Semana ${idx + 1}`} · {weekKmList[idx]}km
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {activeSessions.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">
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

          {/* ── Footer ── */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
