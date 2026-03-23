import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiCheck,
  FiLoader,
  FiTrash2,
  FiPlus,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { showSuccess, showError } from '../../lib/toast';
import { toLocalDateStr } from '../../lib/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import {
  createPlan,
  createMesocycle,
  updateMicrocycleContent,
  assignPlanToAthletes,
} from '../../services/planningService';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_MAP = {
  monday: { index: 0, label: 'Lunes', short: 'Lun' },
  tuesday: { index: 1, label: 'Martes', short: 'Mar' },
  wednesday: { index: 2, label: 'Miércoles', short: 'Mié' },
  thursday: { index: 3, label: 'Jueves', short: 'Jue' },
  friday: { index: 4, label: 'Viernes', short: 'Vie' },
  saturday: { index: 5, label: 'Sábado', short: 'Sáb' },
  sunday: { index: 6, label: 'Domingo', short: 'Dom' },
};

const TYPE_CONFIG = {
  carrera: { label: 'Carrera', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  gimnasio: { label: 'Fuerza', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  cross_training: { label: 'Cross', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  descanso: { label: 'Descanso', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

const INTENSITY_CONFIG = {
  low: { label: 'Baja', color: 'text-green-600 dark:text-green-400' },
  moderate: { label: 'Media', color: 'text-yellow-600 dark:text-yellow-400' },
  high: { label: 'Alta', color: 'text-red-600 dark:text-red-400' },
  recovery: { label: 'Recup.', color: 'text-gray-500 dark:text-gray-400' },
};

const TIER_LABELS = {
  full: 'Basado en datos completos',
  mixed: 'Datos + perfil',
  profile_heavy: 'Basado en perfil',
  profile_only: 'Solo perfil',
};

const TRAINING_TYPE_OPTIONS = [
  { value: 'carrera', label: 'Carrera' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'cross_training', label: 'Cross Training' },
  { value: 'descanso', label: 'Descanso' },
];

const WEEK_LABELS = ['Carga 1', 'Carga 2', 'Pico', 'Descarga'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Calculate the next Monday from today (timezone-safe, uses local date). */
const getNextMonday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to midnight local time
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday;
};

/** Map day_of_week string to numeric index 0-6 (Mon-Sun). */
const dayToIndex = (dow) => DAY_MAP[dow]?.index ?? 0;

/** Compute weekly totals. */
const computeWeekStats = (sessions) => {
  let totalKm = 0;
  let totalMin = 0;
  let trainingDays = 0;
  for (const s of sessions) {
    if (s.training_type !== 'descanso') {
      totalKm += s.estimated_distance_km || 0;
      totalMin += s.estimated_duration_minutes || 0;
      trainingDays++;
    }
  }
  return { totalKm: Math.round(totalKm * 10) / 10, totalMin, trainingDays };
};

// ─── Component ──────────────────────────────────────────────────────────────

const AIPlanReviewModal = ({ isOpen, onClose, planData, athleteId, athleteName, onAssigned }) => {
  const { profile: authProfile } = useAuth();
  const coachId = authProfile?.id;

  const [weeks, setWeeks] = useState([]);
  const [activeWeek, setActiveWeek] = useState(0);
  const [assigning, setAssigning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);

  // Deep-clone planData into editable state whenever planData changes
  useEffect(() => {
    if (!planData?.weeks) {
      setWeeks([]);
      return;
    }
    setWeeks(
      planData.weeks.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s })),
      })),
    );
    setActiveWeek(0);
    setExpandedDay(null);
  }, [planData]);

  // Recompute stats when sessions change
  const weekStats = useMemo(
    () => weeks.map((w) => computeWeekStats(w.sessions)),
    [weeks],
  );

  // ─── Session editing ─────────────────────────────────────────────────

  const updateSession = (weekIdx, sessionIdx, field, value) => {
    setWeeks((prev) => {
      const next = prev.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s })),
      }));
      next[weekIdx].sessions[sessionIdx] = {
        ...next[weekIdx].sessions[sessionIdx],
        [field]: value,
      };
      // If type changed to descanso, clear training fields
      if (field === 'training_type' && value === 'descanso') {
        next[weekIdx].sessions[sessionIdx].estimated_distance_km = 0;
        next[weekIdx].sessions[sessionIdx].estimated_duration_minutes = 0;
        next[weekIdx].sessions[sessionIdx].intensity = 'recovery';
        next[weekIdx].sessions[sessionIdx].title = 'Descanso';
        next[weekIdx].sessions[sessionIdx].description = 'Día de recuperación completa';
      }
      return next;
    });
  };

  const deleteSession = (weekIdx, sessionIdx) => {
    setWeeks((prev) => {
      const next = prev.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s })),
      }));
      // Replace with rest day
      const dayOfWeek = next[weekIdx].sessions[sessionIdx].day_of_week;
      next[weekIdx].sessions[sessionIdx] = {
        day_of_week: dayOfWeek,
        title: 'Descanso',
        description: 'Día de recuperación completa',
        training_type: 'descanso',
        estimated_distance_km: 0,
        estimated_duration_minutes: 0,
        intensity: 'recovery',
      };
      return next;
    });
  };

  const addSession = (weekIdx, sessionIdx) => {
    setWeeks((prev) => {
      const next = prev.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s })),
      }));
      const dayOfWeek = next[weekIdx].sessions[sessionIdx].day_of_week;
      next[weekIdx].sessions[sessionIdx] = {
        day_of_week: dayOfWeek,
        title: '',
        description: '',
        training_type: 'carrera',
        estimated_distance_km: 0,
        estimated_duration_minutes: 0,
        intensity: 'moderate',
      };
      return next;
    });
  };

  // ─── Assignment flow ──────────────────────────────────────────────────

  const handleAssign = async () => {
    if (!coachId || !athleteId) return;

    setAssigning(true);
    try {
      // 1. Create the plan
      const { data: plan, error: planError } = await createPlan({
        coachId,
        name: planData.plan_name || 'Plan IA',
        description: `Plan generado con IA (${TIER_LABELS[planData.tier] || planData.tier})`,
        modality: null,
      });
      if (planError) throw planError;

      // 2. Create 1 mesocycle (4 weeks)
      const { data: meso, error: mesoError } = await createMesocycle(plan.id, {
        name: 'Mesociclo IA',
        phase: 'base',
        weeks: 4,
        sortOrder: 0,
      });
      if (mesoError) throw mesoError;

      // 3. Update each microcycle content with the AI sessions
      const microcycles = (meso.microcycles || []).sort(
        (a, b) => a.week_number - b.week_number,
      );

      for (let i = 0; i < Math.min(weeks.length, microcycles.length); i++) {
        const weekSessions = weeks[i].sessions;
        const days = weekSessions
          .map((s) => {
            const idx = dayToIndex(s.day_of_week);
            if (s.training_type === 'descanso') return null;
            return {
              dayIndex: idx,
              description: `${s.title}\n${s.description}`.trim(),
              duration: s.estimated_duration_minutes || null,
            };
          })
          .filter(Boolean);

        const totalKm = weekSessions.reduce(
          (sum, s) => sum + (s.training_type !== 'descanso' ? (s.estimated_distance_km || 0) : 0),
          0,
        );

        await updateMicrocycleContent(
          microcycles[i].id,
          { days },
          Math.round(totalKm * 10) / 10,
        );
      }

      // 4. Assign plan to athlete (creates training_sessions)
      const startDate = getNextMonday();
      const { error: assignError } = await assignPlanToAthletes(
        plan.id,
        coachId,
        [athleteId],
        toLocalDateStr(startDate),
      );
      if (assignError) throw assignError;

      showSuccess('Plan asignado correctamente');
      onAssigned?.();
      onClose();
    } catch (err) {
      showError(err.message || 'Error al asignar el plan');
    } finally {
      setAssigning(false);
      setShowConfirm(false);
    }
  };

  if (!isOpen || !planData) return null;

  const startDate = getNextMonday();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-plan-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
          >
            {/* ─── Header ──────────────────────────────────────── */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    {planData.plan_name || 'Plan generado con IA'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {TIER_LABELS[planData.tier] || planData.tier}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {planData.duration_weeks} semanas &middot; Inicio: {startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* ─── Week Tabs ──────────────────────────────────── */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {weeks.map((w, idx) => {
                  const stats = weekStats[idx];
                  return (
                    <button
                      key={w.week_number}
                      onClick={() => {
                        setActiveWeek(idx);
                        setExpandedDay(null);
                      }}
                      className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeWeek === idx
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span className="block">Sem {w.week_number}</span>
                      <span className="block text-xs opacity-75">
                        {WEEK_LABELS[idx] || `Semana ${w.week_number}`} &middot; {stats?.totalKm}km
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Body: Week grid ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {/* Week summary bar */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{weekStats[activeWeek]?.trainingDays} días de entreno</span>
                <span>{weekStats[activeWeek]?.totalKm} km total</span>
                <span>{weekStats[activeWeek]?.totalMin} min total</span>
              </div>

              {/* Day cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {weeks[activeWeek]?.sessions.map((session, sIdx) => {
                  const dayInfo = DAY_MAP[session.day_of_week] || { label: session.day_of_week, short: session.day_of_week?.slice(0, 3) };
                  const typeConf = TYPE_CONFIG[session.training_type] || TYPE_CONFIG.carrera;
                  const intensityConf = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.low;
                  const isRest = session.training_type === 'descanso';
                  const isExpanded = expandedDay === `${activeWeek}-${sIdx}`;

                  // Calculate date for this day
                  const dayDate = new Date(startDate);
                  dayDate.setDate(dayDate.getDate() + activeWeek * 7 + (dayInfo.index ?? sIdx));

                  return (
                    <motion.div
                      key={`${activeWeek}-${sIdx}`}
                      layout
                      className={`rounded-xl border transition-all ${
                        isRest
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
                      }`}
                    >
                      {/* Day header */}
                      <div
                        className="px-3 py-2 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedDay(isExpanded ? null : `${activeWeek}-${sIdx}`)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              <span className="hidden lg:inline">{dayInfo.label}</span>
                              <span className="lg:hidden">{dayInfo.short}</span>
                            </span>
                            <span className="text-xs text-gray-400">
                              {dayDate.getDate()}/{dayDate.getMonth() + 1}
                            </span>
                          </div>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${typeConf.color}`}>
                            {typeConf.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!isRest && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(activeWeek, sIdx);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Convertir a descanso"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isRest && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addSession(activeWeek, sIdx);
                              }}
                              className="p-1 text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded transition-colors"
                              title="Agregar entrenamiento"
                            >
                              <FiPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isExpanded ? (
                            <FiChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <FiChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Collapsed preview */}
                      {!isExpanded && !isRest && (
                        <div className="px-3 pb-2">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                            {session.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {session.estimated_distance_km > 0 && (
                              <span>{session.estimated_distance_km}km</span>
                            )}
                            {session.estimated_duration_minutes > 0 && (
                              <span>{session.estimated_duration_minutes}min</span>
                            )}
                            <span className={intensityConf.color}>{intensityConf.label}</span>
                          </div>
                        </div>
                      )}

                      {/* Expanded editor */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {/* Type selector */}
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Tipo</label>
                                <select
                                  value={session.training_type}
                                  onChange={(e) => updateSession(activeWeek, sIdx, 'training_type', e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  {TRAINING_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>

                              {!isRest && (
                                <>
                                  {/* Title */}
                                  <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Título</label>
                                    <input
                                      type="text"
                                      value={session.title}
                                      onChange={(e) => updateSession(activeWeek, sIdx, 'title', e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                  </div>

                                  {/* Description */}
                                  <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Descripción</label>
                                    <textarea
                                      value={session.description}
                                      onChange={(e) => updateSession(activeWeek, sIdx, 'description', e.target.value)}
                                      rows={3}
                                      className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                    />
                                  </div>

                                  {/* Distance + Duration row */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Distancia (km)</label>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={session.estimated_distance_km || ''}
                                        onChange={(e) => updateSession(activeWeek, sIdx, 'estimated_distance_km', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Duración (min)</label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={session.estimated_duration_minutes || ''}
                                        onChange={(e) => updateSession(activeWeek, sIdx, 'estimated_duration_minutes', parseInt(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ─── Footer ──────────────────────────────────────── */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={assigning}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {assigning ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Asignando...
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

          {/* ─── Confirmation dialog ───────────────────────────── */}
          <AnimatePresence>
            {showConfirm && (
              <motion.div
                key="confirm-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
                onClick={() => setShowConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Confirmar asignación
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    ¿Asignar este plan de {planData.duration_weeks} semanas a{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {athleteName || 'este atleta'}
                    </span>
                    ?
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                    Se crearán las sesiones a partir del{' '}
                    {startDate.toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    .
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAssign}
                      disabled={assigning}
                      className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {assigning ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiCheck className="w-4 h-4" />
                      )}
                      Confirmar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIPlanReviewModal;
