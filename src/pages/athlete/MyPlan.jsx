import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClipboard,
  FiRefreshCw,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiZap,
  FiActivity,
  FiClock,
  FiMapPin,
  FiCheck,
  FiCheckCircle,
  FiSkipForward,
  FiDownload,
  FiX,
  FiHeart,
} from 'react-icons/fi';
import { SiStrava } from 'react-icons/si';
import { useAuth } from '../../contexts/AuthContext';
import useMyPlanData from '../../hooks/useMyPlanData';
import useWeeklyTrainings from '../../hooks/useWeeklyTrainings';
import useStravaActivities from '../../hooks/useStravaActivities';
import OnboardingWizard from '../../components/athlete/OnboardingWizard';
import PlanPreviewInline from '../../components/athlete/PlanPreviewInline';
import SessionCompletionModal from '../../components/athlete/SessionCompletionModal';
import { generateWeeklyPDF } from '../../lib/pdfExport';
import { getMyWeeklySessions } from '../../services/independentPlanService';
import { DAYS_OF_WEEK } from '../../services/weeklyTrainingService';
import { getActivityTypeLabel } from '../../services/stravaService';
import { getRPEEmoji } from '../../services/rpeService';
import { inferTrainingType } from '../../lib/dateUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTypeLabel = (session) => {
  const t = typeof session === 'string' ? session : inferTrainingType(session);
  const labels = {
    running: 'Carrera',
    gym: 'Gimnasio',
    rest: 'Descanso',
    cross_training: 'Cross Training',
    bike: 'Bici / Rodillo',
  };
  return labels[t] || t;
};

const getTypeColor = (session) => {
  const t = typeof session === 'string' ? session : inferTrainingType(session);
  const colors = {
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    gym: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    rest: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    cross_training: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    bike: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return colors[t] || colors.running;
};

const isPastOrToday = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= today;
};

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
          Aún no tienes un plan
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          ¡Genera uno con IA! La IA analizará tu perfil y creará un plan de entrenamiento
          personalizado de 4 semanas, adaptado a tus objetivos y disponibilidad.
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
// Active plan UI — Training.jsx-style
// ---------------------------------------------------------------------------

function ActivePlanView({
  profile,
  trainings,
  loading,
  currentWeek,
  goToPreviousWeek,
  goToNextWeek,
  getWeekDays,
  loadTrainings,
  generating,
  rateLimit,
  onGenerate,
  pendingPlan,
  onAssignPlan,
  onDiscardPlan,
  assigning,
}) {
  const [activeTab, setActiveTab] = useState('week');
  const [completionModalSession, setCompletionModalSession] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  const {
    stravaConnected, stravaActivities, loadingStrava,
    selectedActivity, setSelectedActivity, visibleActivities,
    activitiesRPE, editRpeActivity, setEditRpeActivity,
    loadActivityDetail, handleEditRPESave, showMoreActivities,
  } = useStravaActivities(profile?.id);

  const weekDays = getWeekDays(currentWeek);
  const hasAnyTraining = Object.keys(trainings).length > 0;

  const downloadPDF = () => {
    generateWeeklyPDF({
      athleteName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim().toUpperCase(),
      personalBests: [],
      athletePaces: [],
      latestVam: null,
      latestConconiTest: null,
      trainings,
      weekDays,
    });
  };

  const openCompletionModal = (e, session) => {
    e.stopPropagation();
    setCompletionModalSession(session);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Mi Plan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTab === 'week' ? 'Plan semanal de entrenamiento' : 'Últimos 30 días · Strava'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPDF}
            disabled={!hasAnyTraining}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiDownload className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={onGenerate}
            disabled={generating || !rateLimit.canGenerate}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            {generating ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiRefreshCw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{generating ? 'Generando…' : 'Regenerar'}</span>
          </button>
        </div>
      </div>

      {/* Generating banner */}
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
                Generando tu nuevo plan…
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                La IA está analizando tu perfil. Puede tardar hasta 30 segundos.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending plan preview (after regeneration) */}
      {pendingPlan && !generating && (
        <PlanPreviewInline
          plan={pendingPlan}
          onAssign={onAssignPlan}
          onDiscard={onDiscardPlan}
          isAssigning={assigning}
        />
      )}

      {/* Tab toggle */}
      <div className="flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 gap-1">
        <button
          onClick={() => setActiveTab('week')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'week'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Esta semana
        </button>
        <button
          onClick={() => setActiveTab('recents')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'recents'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Recientes
        </button>
      </div>

      {/* ===== ESTA SEMANA TAB ===== */}
      {activeTab === 'week' && (
        <>
          {/* Week navigator */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
            <button
              onClick={goToPreviousWeek}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {' – '}
              {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={goToNextWeek}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : !hasAnyTraining ? (
            /* Empty state for this week */
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <FiCalendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                No hay entrenamientos esta semana
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No tienes sesiones planificadas para esta semana. ¡Regenera tu plan!
              </p>
            </div>
          ) : (
            <>
              {/* ===== MOBILE: Session list (< lg) ===== */}
              <div className="lg:hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {weekDays.map((day, index) => {
                    const training = trainings[index];
                    const isRest = training?.type === 'rest';
                    const isToday = day.toDateString() === new Date().toDateString();
                    const hasTraining = !!training;
                    const isCompleted = training?.status === 'completed';
                    const isSkipped = training?.status === 'skipped';
                    const canComplete = hasTraining && !isRest && training?.status === 'planned' && isPastOrToday(training.date);

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        role={hasTraining && !isRest ? 'button' : undefined}
                        tabIndex={hasTraining && !isRest ? 0 : undefined}
                        onClick={() => { if (hasTraining && !isRest) setSelectedSession(training); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 ${
                          isToday
                            ? 'bg-blue-50/60 dark:bg-blue-900/10'
                            : ''
                        } ${hasTraining && !isRest ? 'cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50' : ''}`}
                      >
                        {/* Day column */}
                        <div className="w-10 flex flex-col items-center flex-shrink-0">
                          <span className={`text-[10px] font-bold uppercase ${
                            isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            {DAYS_OF_WEEK[index].slice(0, 3)}
                          </span>
                          <span className={`text-xl font-bold leading-tight ${
                            isCompleted ? 'text-green-600 dark:text-green-400'
                              : isToday ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {day.getDate()}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {training ? (
                            <>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-sm font-semibold truncate ${
                                  isRest ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                                }`}>
                                  {isRest ? 'Sin entrenamiento' : training.title}
                                </span>
                                {isToday && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-md">
                                    HOY
                                  </span>
                                )}
                              </div>
                              {!isRest && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${getTypeColor(training)}`}>
                                    {getTypeLabel(training)}
                                  </span>
                                  {training.totalDistance && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{training.totalDistance}</span>
                                  )}
                                  {training.duration && !training.totalDistance && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{training.duration} min</span>
                                  )}
                                </div>
                              )}
                              {isRest && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">Descanso</span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-slate-300 dark:text-slate-600">Sin entrenamiento</span>
                          )}
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isCompleted && training.stravaActivityId && !training.rpeScore && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FC4C02] opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FC4C02]" />
                            </span>
                          )}
                          {isCompleted && training.rpeScore && (
                            <span className="text-base">{getRPEEmoji(training.rpeScore)}</span>
                          )}
                          {isCompleted && training.stravaActivityId && (
                            <SiStrava className="w-3.5 h-3.5 text-[#FC4C02]" />
                          )}
                          <div className={`w-1 h-8 rounded-full ml-1 ${
                            isCompleted ? 'bg-green-500'
                              : isSkipped ? 'bg-gray-300 dark:bg-gray-600'
                              : isRest ? 'bg-gray-200 dark:bg-gray-700'
                              : hasTraining ? 'bg-blue-400'
                              : 'bg-transparent'
                          }`} />
                          {isCompleted && <FiCheckCircle className="w-4 h-4 text-green-500" />}
                          {isSkipped && <FiSkipForward className="w-4 h-4 text-gray-400" />}
                          {canComplete && (
                            <button
                              type="button"
                              onClick={(e) => openCompletionModal(e, training)}
                              aria-label="Marcar sesión como completada"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[11px] font-semibold border border-green-200 dark:border-green-800/40 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            >
                              <FiCheck className="w-3 h-3" />
                              Completar
                            </button>
                          )}
                          {hasTraining && !isCompleted && !isSkipped && !canComplete && (
                            <FiChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* ===== DESKTOP: 7-column grid (lg+) ===== */}
              <div className="hidden lg:grid grid-cols-7 gap-4">
                {weekDays.map((day, index) => {
                  const training = trainings[index];
                  const isRest = training?.type === 'rest';
                  const isToday = day.toDateString() === new Date().toDateString();
                  const hasTraining = !!training;
                  const isCompleted = training?.status === 'completed';
                  const isSkipped = training?.status === 'skipped';
                  const canComplete = hasTraining && !isRest && training?.status === 'planned' && isPastOrToday(training.date);

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2 relative flex flex-col
                        ${isCompleted
                          ? 'border-green-500 dark:border-green-400'
                          : isSkipped
                            ? 'border-gray-400 dark:border-gray-500'
                            : isToday
                              ? 'border-blue-500 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-700'}
                        ${isRest ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                        min-h-[300px]
                      `}
                    >
                      {/* Day Header */}
                      <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          {DAYS_OF_WEEK[index]}
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {day.getDate()}
                        </p>
                        {isToday && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                            Hoy
                          </span>
                        )}
                      </div>

                      {/* Status indicator */}
                      {isCompleted && (
                        <div className="absolute top-3 right-3 flex items-center space-x-1">
                          {training.stravaActivityId && !training.rpeScore && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FC4C02] opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FC4C02]" />
                            </span>
                          )}
                          {training.rpeScore && <span className="text-lg">{getRPEEmoji(training.rpeScore)}</span>}
                          {training.stravaActivityId && <SiStrava className="w-4 h-4 text-[#FC4C02]" />}
                          <FiCheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      )}
                      {isSkipped && (
                        <div className="absolute top-3 right-3">
                          <FiSkipForward className="w-5 h-5 text-gray-400" />
                        </div>
                      )}

                      {/* Training Content */}
                      {training ? (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block text-xs px-2 py-1 rounded-full ${getTypeColor(training)}`}>
                              {getTypeLabel(training)}
                            </span>
                            {isCompleted && (
                              <span className="inline-block text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Completado
                              </span>
                            )}
                            {isSkipped && (
                              <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                Omitido
                              </span>
                            )}
                          </div>

                          <h3 className={`font-bold text-lg ${
                            isRest ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {training.title}
                          </h3>

                          {!isRest && (
                            <>
                              {training.totalDistance && (
                                <div className="flex items-start space-x-2">
                                  <FiMapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{training.totalDistance}</p>
                                </div>
                              )}
                              {training.duration && (
                                <div className="flex items-start space-x-2">
                                  <FiClock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{training.duration} min</p>
                                </div>
                              )}
                              {training.exercises?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ejercicios:</p>
                                  <ul className="space-y-1">
                                    {training.exercises.slice(0, 3).map((ex, i) => (
                                      <li key={i} className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                        • {ex.name}
                                        {ex.sets && <span className="text-gray-500"> ({ex.sets}x{ex.reps || ''})</span>}
                                      </li>
                                    ))}
                                    {training.exercises.length > 3 && (
                                      <li className="text-xs text-gray-500 dark:text-gray-400">
                                        +{training.exercises.length - 3} más
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                              {training.description && !training.exercises?.length && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{training.description}</p>
                              )}
                              <div className="mt-auto pt-2 text-center">
                                {canComplete ? (
                                  <button
                                    type="button"
                                    onClick={(e) => openCompletionModal(e, training)}
                                    aria-label="Marcar sesión como completada"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                                  >
                                    <FiCheck className="w-3.5 h-3.5" />
                                    Marcar completado
                                  </button>
                                ) : isCompleted && training.actualDistanceKm ? (
                                  <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold text-green-600 dark:text-green-400">{training.actualDistanceKm} km</span>
                                    {training.rpe && <span>RPE {training.rpe}/10</span>}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedSession(training); }}
                                    className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                  >
                                    {isCompleted ? 'Ver resultado →' : 'Ver detalles →'}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {isRest && (
                            <div className="text-center py-6">
                              <span className="text-4xl">💤</span>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Día de recuperación</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <p className="text-sm">Sin entrenamiento</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ===== RECIENTES TAB ===== */}
      {activeTab === 'recents' && (
        <>
          {!stravaConnected ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <SiStrava className="w-10 h-10 text-[#FC4C02] mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Conecta Strava</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ve a Dispositivos para conectar tu cuenta de Strava</p>
            </div>
          ) : loadingStrava ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-6 h-6 animate-spin text-[#FC4C02]" />
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <FiActivity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay actividades en los últimos 30 días</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stravaActivities.slice(0, visibleActivities).map((activity) => {
                const rpeData = activitiesRPE[String(activity.id)];
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => loadActivityDetail(activity)}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
                          {activity.name}
                        </h4>
                        {activity.has_heartrate && (
                          <span className="flex items-center gap-1 text-xs text-red-500 flex-shrink-0 whitespace-nowrap">
                            <FiHeart className="w-3 h-3" />
                            {activity.average_heartrate} bpm
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${getTypeColor(activity.type === 'Run' ? 'running' : activity.type === 'WeightTraining' ? 'gym' : 'cross_training')}`}>
                          {getActivityTypeLabel(activity.type)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(activity.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
                      {[
                        { val: activity.distanceKm, unit: 'km', color: 'text-slate-900 dark:text-white' },
                        { val: activity.formattedTime, unit: 'tiempo', color: 'text-slate-900 dark:text-white' },
                        { val: activity.pace || '–', unit: 'ritmo', color: 'text-green-600 dark:text-green-400' },
                        { val: activity.total_elevation_gain ?? 0, unit: 'm+', color: 'text-slate-900 dark:text-white' },
                      ].map(({ val, unit, color }, i) => (
                        <div key={i} className="py-2.5 text-center">
                          <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{unit}</p>
                        </div>
                      ))}
                    </div>

                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-100 dark:divide-gray-700">
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        {activity.calories > 0 && <span>{activity.calories} kcal</span>}
                        {activity.kudos_count > 0 && <span>· {activity.kudos_count} kudos</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {rpeData?.score ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                            className="text-xl hover:scale-110 transition-transform"
                          >
                            {getRPEEmoji(rpeData.score)}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                            className="px-2.5 py-1 text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            + Valorar sesión
                          </button>
                        )}
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Ver detalle &rsaquo;</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {visibleActivities < stravaActivities.length && (
                <div className="text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); showMoreActivities(); }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    Cargar más ({stravaActivities.length - visibleActivities} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Strava Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedActivity.name}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                    {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })} · {getActivityTypeLabel(selectedActivity.type)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {selectedActivity.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'km', val: selectedActivity.distanceKm, color: 'text-blue-600 dark:text-blue-400' },
                      { label: 'tiempo', val: selectedActivity.formattedTime, color: 'text-purple-600 dark:text-purple-400' },
                      { label: 'ritmo', val: selectedActivity.pace || '–', color: 'text-green-600 dark:text-green-400' },
                      { label: 'bpm medio', val: selectedActivity.average_heartrate || '–', color: 'text-red-600 dark:text-red-400' },
                      { label: 'desnivel+', val: `${selectedActivity.total_elevation_gain ?? 0}m`, color: 'text-slate-900 dark:text-white' },
                      { label: 'kcal', val: selectedActivity.calories || '–', color: 'text-slate-900 dark:text-white' },
                    ].map(({ label, val, color }, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session completion modal — portal to body to avoid stacking context issues */}
      {completionModalSession && createPortal(
        <SessionCompletionModal
          session={completionModalSession}
          onClose={() => setCompletionModalSession(null)}
          onComplete={() => {
            setCompletionModalSession(null);
            loadTrainings();
          }}
        />,
        document.body
      )}

      {/* Session detail modal — portal to body */}
      {createPortal(<AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setSelectedSession(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedSession.title || 'Entrenamiento'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedSession.date ? new Date(selectedSession.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label="Cerrar"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {selectedSession.type && (
                  <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${
                    selectedSession.type === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : selectedSession.type === 'gym' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : selectedSession.type === 'rest' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  }`}>
                    {selectedSession.type === 'running' ? 'Carrera' : selectedSession.type === 'gym' ? 'Gimnasio' : selectedSession.type === 'rest' ? 'Descanso' : 'Cross'}
                  </span>
                )}

                {selectedSession.description && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 whitespace-pre-line">
                    {selectedSession.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {selectedSession.totalDistance && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Distancia</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{selectedSession.totalDistance}</p>
                    </div>
                  )}
                  {selectedSession.duration && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Duración</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">{selectedSession.duration} min</p>
                    </div>
                  )}
                </div>

                {selectedSession.exercises?.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Ejercicios</h4>
                    <ul className="space-y-2">
                      {selectedSession.exercises.map((ex, i) => (
                        <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                          <span>
                            {ex.name}
                            {ex.sets && <span className="text-slate-500"> · {ex.sets}x{ex.reps || ''}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSession.notesCoach && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Notas</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{selectedSession.notesCoach}</p>
                  </div>
                )}

                {selectedSession.status === 'completed' && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Resultado</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedSession.actualDistanceKm && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                          <p className="text-xs text-green-600 dark:text-green-400">Distancia real</p>
                          <p className="text-base font-bold text-green-700 dark:text-green-300">{selectedSession.actualDistanceKm} km</p>
                        </div>
                      )}
                      {selectedSession.rpe && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                          <p className="text-xs text-green-600 dark:text-green-400">RPE</p>
                          <p className="text-base font-bold text-green-700 dark:text-green-300">{selectedSession.rpe}/10</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MyPlan() {
  const { user, profile } = useAuth();

  const {
    loading: planLoading,
    generating,
    assigning,
    activePlan,
    hasProfile,
    rateLimit,
    pendingPlan,
    generatePlan,
    assignPlan,
    discardPlan,
    refresh,
  } = useMyPlanData(user?.id);

  const {
    currentWeek,
    trainings,
    loading: trainingsLoading,
    loadTrainings,
    goToPreviousWeek,
    goToNextWeek,
    getWeekDays,
  } = useWeeklyTrainings({
    fetchFn: (weekStart) => getMyWeeklySessions(user?.id, weekStart),
    deps: [user?.id],
  });

  // ── Loading state ──
  if (planLoading) {
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

  // ── Determine mode: has active sessions this week? ──
  const hasActiveSessions = activePlan.length > 0;

  // ── Mode 1: No active plan — show preview or CTA ──
  if (!hasActiveSessions) {
    return (
      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi Plan</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Genera tu plan de entrenamiento personalizado con IA
          </p>
        </div>

        {/* Generating banner */}
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

        {pendingPlan && !generating ? (
          <PlanPreviewInline
            plan={pendingPlan}
            onAssign={assignPlan}
            onDiscard={discardPlan}
            isAssigning={assigning}
          />
        ) : !generating ? (
          <NoPlanCTA
            onGenerate={generatePlan}
            generating={generating}
            rateLimit={rateLimit}
          />
        ) : null}
      </div>
    );
  }

  // ── Mode 2: Active plan — show Training.jsx-style UI ──
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="px-4 lg:px-8 py-5 lg:py-8">
        <ActivePlanView
          profile={profile}
          trainings={trainings}
          loading={trainingsLoading}
          currentWeek={currentWeek}
          goToPreviousWeek={goToPreviousWeek}
          goToNextWeek={goToNextWeek}
          getWeekDays={getWeekDays}
          loadTrainings={loadTrainings}
          generating={generating}
          rateLimit={rateLimit}
          onGenerate={generatePlan}
          pendingPlan={pendingPlan}
          onAssignPlan={assignPlan}
          onDiscardPlan={discardPlan}
          assigning={assigning}
        />
      </div>
    </div>
  );
}
