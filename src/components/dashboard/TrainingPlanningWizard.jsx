import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiChevronRight, FiChevronLeft, FiPlus, FiLayers,
  FiCalendar, FiTarget, FiLoader, FiSkipForward,
} from 'react-icons/fi';
import { PHASE_OPTIONS, WEEK_TYPES, getPhaseInfo } from './PeriodizationManager';
import WeeklyTrainingModal from './WeeklyTrainingModal';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMesocyclesByAthlete, getOrCreateActivePlan,
  createMesocycle, createMicrocycle,
} from '../../services/trainingLoadService';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { toLocalDateStr } from '../../lib/dateUtils';
import { showSuccess, showError } from '../../lib/toast';

const STEPS = [
  { num: 1, label: 'Mesociclo' },
  { num: 2, label: 'Semana' },
  { num: 3, label: 'Planificación' },
];

export default function TrainingPlanningWizard({ isOpen, onClose, athlete, coachId, onSuccess }) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [mesocycles, setMesocycles] = useState([]);
  const [selectedMeso, setSelectedMeso] = useState(null);
  const [selectedMicro, setSelectedMicro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resolvedPlanId, setResolvedPlanId] = useState(null);
  const [skipPeriodization, setSkipPeriodization] = useState(false);

  const [newMeso, setNewMeso] = useState({
    name: '', phase: 'base', start_date: '', end_date: '',
    weeks: 4, focus: '', target_weekly_km: '',
  });

  // Load mesocycles when wizard opens
  useEffect(() => {
    if (isOpen && athlete?.id) {
      setLoading(true);
      setCurrentStep(1);
      setSelectedMeso(null);
      setSelectedMicro(null);
      setSkipPeriodization(false);
      setShowCreateForm(false);
      loadMesocycles();
    }
  }, [isOpen, athlete?.id]);

  const loadMesocycles = async () => {
    try {
      const data = await getMesocyclesByAthlete(athlete.id);
      setMesocycles(data);
      if (data.length > 0) {
        const active = findActiveMesocycle(data);
        setSelectedMeso(active);
      }
    } catch (err) {
      console.error('Error loading mesocycles:', err);
    } finally {
      setLoading(false);
    }
  };

  const findActiveMesocycle = (mesoList) => {
    const today = toLocalDateStr(new Date());
    const active = mesoList.find(m => m.start_date <= today && m.end_date >= today);
    return active || mesoList[mesoList.length - 1] || null;
  };

  const handleCreateMesocycle = async () => {
    if (!newMeso.name || !newMeso.start_date || !newMeso.end_date) {
      showError('Nombre, fecha inicio y fin son requeridos');
      return;
    }
    setCreating(true);
    try {
      let planId = resolvedPlanId;
      if (!planId) {
        planId = await getOrCreateActivePlan(athlete.id, coachId || profile?.id);
        setResolvedPlanId(planId);
      }

      const meso = await createMesocycle(planId, {
        ...newMeso,
        target_weekly_km: newMeso.target_weekly_km ? parseFloat(newMeso.target_weekly_km) : null,
        sort_order: mesocycles.length,
      });

      // Auto-create microcycles
      const weeks = newMeso.weeks || 4;
      const startDate = new Date(newMeso.start_date);
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + i * 7);
        await createMicrocycle(meso.id, {
          week_number: i + 1,
          start_date: toLocalDateStr(weekStart),
          week_type: i === weeks - 1 && newMeso.phase !== 'recovery' ? 'recovery' : 'normal',
          planned_km: newMeso.target_weekly_km ? parseFloat(newMeso.target_weekly_km) : null,
        });
      }

      showSuccess('Mesociclo creado');
      setShowCreateForm(false);
      setNewMeso({ name: '', phase: 'base', start_date: '', end_date: '', weeks: 4, focus: '', target_weekly_km: '' });
      await loadMesocycles();
    } catch (err) {
      console.error('Error creating mesocycle:', err);
      showError('Error al crear mesociclo');
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    setSkipPeriodization(true);
    setCurrentStep(3);
  };

  const handleSelectMeso = (meso) => {
    setSelectedMeso(meso);
  };

  const handleNextFromStep1 = () => {
    if (!selectedMeso) {
      showError('Selecciona un mesociclo o crea uno nuevo');
      return;
    }
    // Auto-select current week microcycle
    const micros = selectedMeso.microcycles || [];
    const todayWeekStart = getWeekStartDate();
    const autoMicro = micros.find(m => {
      const microWeekStart = getWeekStartDate(new Date(m.start_date + 'T12:00:00'));
      return microWeekStart.getTime() === todayWeekStart.getTime();
    }) || micros[0] || null;
    setSelectedMicro(autoMicro);
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!selectedMicro) {
      showError('Selecciona una semana');
      return;
    }
    setCurrentStep(3);
  };

  const getWeekStartFromMicrocycle = (micro) => {
    const [year, month, day] = micro.start_date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return getWeekStartDate(date);
  };

  const getMesocycleContext = () => {
    if (!selectedMeso || !selectedMicro) return null;
    const phase = getPhaseInfo(selectedMeso.phase);
    return {
      name: selectedMeso.name,
      phase: phase.label,
      weekNumber: selectedMicro.week_number,
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Top bar: Stepper + Close */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Planificar Entrenamiento
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {athlete?.firstName} {athlete?.lastName}
            {currentStep === 3 && selectedMeso && selectedMicro && (
              <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                · {selectedMeso.name} · {getPhaseInfo(selectedMeso.phase).label} · Semana {selectedMicro.week_number}
              </span>
            )}
          </p>

          {/* Step indicator */}
          {!skipPeriodization && (
            <div className="flex items-center justify-center gap-2">
              {STEPS.map((step, i) => (
                <div key={step.num} className="flex items-center">
                  <button
                    onClick={() => step.num < currentStep && setCurrentStep(step.num)}
                    disabled={step.num >= currentStep}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                      step.num === currentStep
                        ? 'bg-indigo-600 text-white'
                        : step.num < currentStep
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <span>{step.num}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <FiChevronRight className="w-4 h-4 mx-1 text-gray-300 dark:text-gray-600" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* STEP 1: Mesociclo */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-4 sm:p-6"
              >
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                ) : mesocycles.length === 0 && !showCreateForm ? (
                  /* Empty state */
                  <div className="text-center py-12">
                    <FiLayers className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay mesociclos definidos
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Crea un mesociclo para organizar las fases de entrenamiento,
                      o planifica directamente sin periodización.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <FiPlus className="w-4 h-4" />
                        Crear Mesociclo
                      </button>
                      <button
                        onClick={handleSkip}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiSkipForward className="w-4 h-4" />
                        Planificar sin periodizar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Mesocycle selector */}
                    {mesocycles.length > 0 && !showCreateForm && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Selecciona un mesociclo
                          </h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowCreateForm(true)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                              <FiPlus className="w-3 h-3" />
                              Nuevo
                            </button>
                            <button
                              onClick={handleSkip}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <FiSkipForward className="w-3 h-3" />
                              Saltar
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {mesocycles.map(meso => {
                            const phase = getPhaseInfo(meso.phase);
                            const isSelected = selectedMeso?.id === meso.id;
                            const micros = meso.microcycles || [];
                            return (
                              <button
                                key={meso.id}
                                onClick={() => handleSelectMeso(meso)}
                                className={`text-left p-4 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
                                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{meso.name}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${phase.bg}`}>
                                    {phase.label}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <FiCalendar className="w-3 h-3" />
                                    {new Date(meso.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — {new Date(meso.end_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span>{micros.length} semanas</span>
                                  {meso.target_weekly_km && (
                                    <span className="flex items-center gap-1">
                                      <FiTarget className="w-3 h-3" />
                                      {meso.target_weekly_km} km/sem
                                    </span>
                                  )}
                                </div>
                                {meso.focus && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{meso.focus}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Create form */}
                    {showCreateForm && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Nuevo Mesociclo</h4>
                          {mesocycles.length > 0 && (
                            <button
                              onClick={() => setShowCreateForm(false)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Nombre</label>
                            <input
                              value={newMeso.name}
                              onChange={(e) => setNewMeso({ ...newMeso, name: e.target.value })}
                              placeholder="Ej: Fase de Base 1"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Fase</label>
                            <select
                              value={newMeso.phase}
                              onChange={(e) => setNewMeso({ ...newMeso, phase: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              {PHASE_OPTIONS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Inicio</label>
                            <input
                              type="date"
                              value={newMeso.start_date}
                              onChange={(e) => setNewMeso({ ...newMeso, start_date: e.target.value })}
                              className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white [&::-webkit-calendar-picker-indicator]:dark:invert"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Fin</label>
                            <input
                              type="date"
                              value={newMeso.end_date}
                              onChange={(e) => setNewMeso({ ...newMeso, end_date: e.target.value })}
                              className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white [&::-webkit-calendar-picker-indicator]:dark:invert"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Semanas</label>
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={newMeso.weeks}
                              onChange={(e) => setNewMeso({ ...newMeso, weeks: parseInt(e.target.value) || 4 })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Km/semana objetivo</label>
                            <input
                              type="number"
                              value={newMeso.target_weekly_km}
                              onChange={(e) => setNewMeso({ ...newMeso, target_weekly_km: e.target.value })}
                              placeholder="Ej: 60"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Foco del mesociclo</label>
                          <input
                            value={newMeso.focus}
                            onChange={(e) => setNewMeso({ ...newMeso, focus: e.target.value })}
                            placeholder="Ej: Desarrollo VO2max + progresión de umbral"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={handleCreateMesocycle}
                            disabled={creating}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {creating && <FiLoader className="w-4 h-4 animate-spin" />}
                            Crear Mesociclo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Semana */}
            {currentStep === 2 && selectedMeso && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-4 sm:p-6"
              >
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getPhaseInfo(selectedMeso.phase).color }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedMeso.name}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPhaseInfo(selectedMeso.phase).bg}`}>
                      {getPhaseInfo(selectedMeso.phase).label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Selecciona la semana que quieres planificar
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(selectedMeso.microcycles || [])
                    .sort((a, b) => a.week_number - b.week_number)
                    .map(micro => {
                      const isSelected = selectedMicro?.id === micro.id;
                      const todayWeekStart = getWeekStartDate();
                      const microWeekStart = getWeekStartDate(new Date(micro.start_date + 'T12:00:00'));
                      const isCurrentWeek = microWeekStart.getTime() === todayWeekStart.getTime();
                      const weekType = WEEK_TYPES.find(t => t.value === micro.week_type);

                      return (
                        <button
                          key={micro.id}
                          onClick={() => setSelectedMicro(micro)}
                          className={`relative text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          {isCurrentWeek && (
                            <span className="absolute -top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                              Esta semana
                            </span>
                          )}
                          <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            S{micro.week_number}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(micro.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {weekType?.label || 'Normal'}
                          </p>
                          {micro.planned_km && (
                            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                              {micro.planned_km} km
                            </p>
                          )}
                        </button>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Planificación */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full"
              >
                <WeeklyTrainingModal
                  isOpen={true}
                  onClose={() => {
                    onClose();
                  }}
                  athlete={athlete}
                  coachId={coachId}
                  onSuccess={() => {
                    if (onSuccess) onSuccess();
                    onClose();
                  }}
                  embedded={true}
                  initialWeekStartDate={
                    selectedMicro
                      ? getWeekStartFromMicrocycle(selectedMicro)
                      : null
                  }
                  mesocycleContext={null}
                  onBack={!skipPeriodization ? () => setCurrentStep(2) : null}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer navigation (steps 1 & 2 only) */}
        {currentStep < 3 && (
          <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Atrás
                  </button>
                )}
              </div>
              <button
                onClick={currentStep === 1 ? handleNextFromStep1 : handleNextFromStep2}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Siguiente
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
