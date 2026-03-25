import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClipboard,
  FiRefreshCw,
  FiLoader,
  FiChevronDown,
  FiChevronUp,
  FiCalendar,
  FiZap,
  FiActivity,
  FiClock,
  FiMapPin,
  FiCheck,
  FiCheckCircle,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import useMyPlanData from '../../hooks/useMyPlanData';
import OnboardingWizard from '../../components/athlete/OnboardingWizard';
import SessionCompletionModal from '../../components/athlete/SessionCompletionModal';
import { toLocalDateStr } from '../../lib/dateUtils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS_ES = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const TYPE_CONFIG = {
  carrera: { label: 'Carrera', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  running: { label: 'Carrera', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  gimnasio: { label: 'Gimnasio', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  gym: { label: 'Gimnasio', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  cross_training: { label: 'Cross', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  descanso: { label: 'Descanso', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  rest: { label: 'Descanso', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const INTENSITY_CONFIG = {
  low: { label: 'Suave', dot: 'bg-green-500' },
  moderate: { label: 'Moderada', dot: 'bg-yellow-500' },
  high: { label: 'Alta', dot: 'bg-red-500' },
  recovery: { label: 'Recuperación', dot: 'bg-blue-400' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getSessionDayOfWeek = (scheduledDate) => {
  const date = new Date(scheduledDate + 'T00:00:00');
  const dayIndex = date.getDay(); // 0=Sunday
  return DAY_ORDER[dayIndex === 0 ? 6 : dayIndex - 1];
};

const getTypeConfig = (type) =>
  TYPE_CONFIG[type] ?? { label: type ?? 'Entrenamiento', color: 'bg-slate-100 text-slate-700' };

const getIntensityConfig = (intensity) =>
  INTENSITY_CONFIG[intensity] ?? { label: intensity ?? '', dot: 'bg-slate-400' };

// ---------------------------------------------------------------------------
// SessionCard component
// ---------------------------------------------------------------------------

function SessionCard({ session, onComplete }) {
  const typeConf = getTypeConfig(session.training_type);
  const intensityConf = getIntensityConfig(session.intensity);
  const isRest = session.training_type === 'descanso' || session.training_type === 'rest';
  const dayLabel = DAY_LABELS_ES[getSessionDayOfWeek(session.scheduled_date)] ?? '';
  const isCompleted = session.status === 'completed';

  const isPastOrToday = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d <= today;
  };

  const canComplete = !isRest && !isCompleted && isPastOrToday(session.scheduled_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${
        isCompleted
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
          : isRest
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          {dayLabel}
        </span>
        <div className="flex items-center gap-2">
          {isCompleted && <FiCheckCircle className="w-3.5 h-3.5 text-green-500" aria-label="Completado" />}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeConf.color}`}>
            {typeConf.label}
          </span>
        </div>
      </div>

      {isRest ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">Descanso — recuperación completa</p>
      ) : (
        <>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
            {session.title || 'Entrenamiento'}
          </h3>

          {session.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
              {session.description}
            </p>
          )}

          {/* Completion summary */}
          {isCompleted && session.actual_distance_km && (
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                {session.actual_distance_km} km
              </span>
              {session.rpe && (
                <span className="text-xs text-slate-500 dark:text-slate-400">RPE {session.rpe}/10</span>
              )}
            </div>
          )}

          {/* Stats row */}
          {!isCompleted && (
            <div className="flex items-center gap-3 flex-wrap">
              {session.estimated_distance_km > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <FiMapPin className="w-3 h-3" />
                  <span>{session.estimated_distance_km} km</span>
                </div>
              )}
              {session.estimated_duration_minutes > 0 && (
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
          )}

          {/* Complete button */}
          {canComplete && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => onComplete?.(session)}
                aria-label="Marcar sesión como completada"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
              >
                <FiCheck className="w-3.5 h-3.5" />
                Marcar completado
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <FiCheckCircle className="w-3 h-3" />
                Completado
              </span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// WeekHistoryCard component (collapsible)
// ---------------------------------------------------------------------------

function WeekHistoryCard({ week }) {
  const [open, setOpen] = useState(false);

  const weekDate = new Date(week.weekStart + 'T00:00:00');
  const weekEnd = new Date(weekDate);
  weekEnd.setDate(weekDate.getDate() + 6);

  const completedCount = week.sessions.filter(s => s.status === 'completed').length;
  const totalTraining = week.sessions.filter(
    s => s.training_type !== 'descanso' && s.training_type !== 'rest'
  ).length;

  const dateLabel = `${weekDate.getDate()} ${weekDate.toLocaleString('es', { month: 'short' })} — ${weekEnd.getDate()} ${weekEnd.toLocaleString('es', { month: 'short' })}`;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FiCalendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {completedCount}/{totalTraining} completadas
          </span>
          {open ? (
            <FiChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <FiChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 bg-white dark:bg-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {week.sessions
                .filter(s => s.training_type !== 'descanso' && s.training_type !== 'rest')
                .map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (no plan yet)
// ---------------------------------------------------------------------------

function NoPlanCTA({ onGenerate, generating, rateLimit }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 py-16 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <FiClipboard className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Crea tu primer plan
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          La IA analizará tu perfil y generará un plan de entrenamiento personalizado de 4 semanas,
          adaptado a tus objetivos y disponibilidad.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Basado en tu perfil
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating || !rateLimit.canGenerate}
        className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <FiLoader className="w-4 h-4 animate-spin" />
            Generando plan…
          </>
        ) : (
          <>
            <FiZap className="w-4 h-4" />
            Generar Plan con IA
          </>
        )}
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MyPlan() {
  const { user, profile } = useAuth();
  const {
    loading,
    generating,
    activePlan,
    planHistory,
    hasProfile,
    rateLimit,
    currentWeekStart,
    generatePlan,
    refresh,
  } = useMyPlanData(user?.id);

  const [showHistory, setShowHistory] = useState(false);
  const [completionModalSession, setCompletionModalSession] = useState(null);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  // ── Onboarding gate: show wizard if no profile ──
  if (hasProfile === false) {
    return (
      <div className="px-4 lg:px-8 py-5 lg:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Plan</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Completa tu perfil para generar tu plan personalizado con IA.
          </p>
        </div>
        <OnboardingWizard onComplete={refresh} />
      </div>
    );
  }

  // ── Current week date label ──
  const weekLabel = (() => {
    if (!currentWeekStart) return '';
    const monday = new Date(currentWeekStart);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.getDate()} ${monday.toLocaleString('es', { month: 'short' })} — ${sunday.getDate()} ${sunday.toLocaleString('es', { month: 'short' })}`;
  })();

  const hasActivePlan = activePlan.length > 0;

  return (
    <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Plan</h1>
          {hasActivePlan && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Semana actual: {weekLabel}
            </p>
          )}
        </div>

        {hasActivePlan && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={generatePlan}
              disabled={generating || !rateLimit.canGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <FiRefreshCw className="w-4 h-4" />
                  Regenerar Plan con IA
                </>
              )}
            </button>
            <span className={`text-xs ${rateLimit.remaining === 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
              {rateLimit.remaining}/2 regeneraciones restantes esta semana
            </span>
          </div>
        )}
      </div>

      {/* Generating overlay banner */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
          >
            <FiLoader className="w-5 h-5 animate-spin text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Generando tu plan personalizado…
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                La IA está analizando tu perfil. Esto puede tardar hasta 30 segundos.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No active plan CTA */}
      {!hasActivePlan && !generating && (
        <NoPlanCTA
          onGenerate={generatePlan}
          generating={generating}
          rateLimit={rateLimit}
        />
      )}

      {/* Active plan — current week sessions */}
      {hasActivePlan && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FiActivity className="w-4 h-4 text-green-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Semana actual
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activePlan.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onComplete={(s) => setCompletionModalSession(s)}
              />
            ))}
          </div>

          {activePlan.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
              No hay sesiones programadas para esta semana.
            </p>
          )}
        </section>
      )}

      {/* Plan history */}
      {planHistory.length > 0 && (
        <section>
          <button
            onClick={() => setShowHistory(prev => !prev)}
            className="flex items-center gap-2 mb-4 group"
          >
            <FiCalendar className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              Historial de semanas
            </h2>
            {showHistory ? (
              <FiChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <FiChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                {planHistory.map(week => (
                  <WeekHistoryCard key={week.weekStart} week={week} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Session completion modal */}
      {completionModalSession && (
        <SessionCompletionModal
          session={completionModalSession}
          onClose={() => setCompletionModalSession(null)}
          onComplete={() => {
            setCompletionModalSession(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
