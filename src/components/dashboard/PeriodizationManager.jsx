import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiChevronDown, FiChevronUp,
  FiCalendar, FiTarget, FiLayers,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMesocycles, getMesocyclesByAthlete, getOrCreateActivePlan,
  createMesocycle, updateMesocycle, deleteMesocycle,
  createMicrocycle, updateMicrocycle,
} from '../../services/trainingLoadService';
import { showSuccess, showError } from '../../lib/toast';
import { toLocalDateStr } from '../../lib/dateUtils';

export const PHASE_OPTIONS = [
  { value: 'base', label: 'Base', color: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { value: 'build', label: 'Construcción', color: '#F59E0B', bg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  { value: 'peak', label: 'Pico', color: '#EF4444', bg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  { value: 'taper', label: 'Taper', color: '#10B981', bg: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  { value: 'recovery', label: 'Recuperación', color: '#8B5CF6', bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  { value: 'competition', label: 'Competición', color: '#EC4899', bg: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
  { value: 'transition', label: 'Transición', color: '#6B7280', bg: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
];

export const WEEK_TYPES = [
  { value: 'normal', label: 'Normal' },
  { value: 'recovery', label: 'Recuperación' },
  { value: 'deload', label: 'Descarga' },
  { value: 'test', label: 'Test' },
  { value: 'race_week', label: 'Semana de carrera' },
];

export const getPhaseInfo = (phase) => PHASE_OPTIONS.find(p => p.value === phase) || PHASE_OPTIONS[6];

export default function PeriodizationManager({ planId: externalPlanId, athleteId }) {
  const { profile } = useAuth();
  const [resolvedPlanId, setResolvedPlanId] = useState(externalPlanId || null);
  const [mesocycles, setMesocycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedMeso, setExpandedMeso] = useState(null);
  const [editingMeso, setEditingMeso] = useState(null);

  const [newMeso, setNewMeso] = useState({
    name: '', phase: 'base', start_date: '', end_date: '',
    weeks: 4, focus: '', target_weekly_km: '', target_weekly_tss: '',
  });

  useEffect(() => {
    if (externalPlanId) {
      setResolvedPlanId(externalPlanId);
      loadMesocycles(externalPlanId);
    } else if (athleteId) {
      loadMesocyclesByAthlete();
    }
  }, [externalPlanId, athleteId]);

  const loadMesocyclesByAthlete = async () => {
    try {
      const data = await getMesocyclesByAthlete(athleteId);
      setMesocycles(data);
      if (data.length > 0 && !expandedMeso) setExpandedMeso(data[0].id);
    } catch (err) {
      console.error('Error loading mesocycles by athlete:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMesocycles = async (pId) => {
    try {
      const data = await getMesocycles(pId || resolvedPlanId);
      setMesocycles(data);
      if (data.length > 0 && !expandedMeso) setExpandedMeso(data[0].id);
    } catch (err) {
      console.error('Error loading mesocycles:', err);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    if (resolvedPlanId) loadMesocycles(resolvedPlanId);
    else if (athleteId) loadMesocyclesByAthlete();
  };

  const handleAddMesocycle = async () => {
    if (!newMeso.name || !newMeso.start_date || !newMeso.end_date) {
      showError('Nombre, fecha inicio y fin son requeridos');
      return;
    }
    try {
      // Resolve planId if we don't have one yet
      let activePlanId = resolvedPlanId;
      if (!activePlanId && athleteId && profile?.id) {
        activePlanId = await getOrCreateActivePlan(athleteId, profile.id);
        setResolvedPlanId(activePlanId);
      }
      if (!activePlanId) {
        showError('No se pudo determinar el plan de entrenamiento');
        return;
      }

      const meso = await createMesocycle(activePlanId, {
        ...newMeso,
        target_weekly_km: newMeso.target_weekly_km ? parseFloat(newMeso.target_weekly_km) : null,
        target_weekly_tss: newMeso.target_weekly_tss ? parseFloat(newMeso.target_weekly_tss) : null,
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
          planned_tss: newMeso.target_weekly_tss ? parseFloat(newMeso.target_weekly_tss) : null,
        });
      }

      showSuccess('Mesociclo creado');
      setShowAddForm(false);
      setNewMeso({ name: '', phase: 'base', start_date: '', end_date: '', weeks: 4, focus: '', target_weekly_km: '', target_weekly_tss: '' });
      reload();
    } catch (err) {
      console.error('Error creating mesocycle:', err);
      showError('Error al crear mesociclo');
    }
  };

  const handleDeleteMesocycle = async (mesoId) => {
    try {
      await deleteMesocycle(mesoId);
      showSuccess('Mesociclo eliminado');
      reload();
    } catch (err) {
      showError('Error al eliminar');
    }
  };

  const handleUpdateMicrocycle = async (microId, updates) => {
    try {
      await updateMicrocycle(microId, updates);
      reload();
    } catch (err) {
      showError('Error al actualizar semana');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiLayers className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Periodización</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Añadir Mesociclo
        </button>
      </div>

      {/* Timeline visualization */}
      {mesocycles.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-2">
          {mesocycles.map((meso) => {
            const phase = getPhaseInfo(meso.phase);
            const weeks = meso.microcycles?.length || meso.weeks || 1;
            return (
              <div
                key={meso.id}
                className={`flex-shrink-0 rounded-lg px-3 py-2 cursor-pointer transition-all border-2 ${
                  expandedMeso === meso.id ? 'border-indigo-500 shadow-md' : 'border-transparent'
                }`}
                style={{ backgroundColor: `${phase.color}20`, minWidth: `${Math.max(weeks * 24, 80)}px` }}
                onClick={() => setExpandedMeso(expandedMeso === meso.id ? null : meso.id)}
              >
                <p className="text-xs font-semibold truncate" style={{ color: phase.color }}>{meso.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{weeks} sem.</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Mesocycle Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
          >
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Nuevo Mesociclo</h4>
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
                  className="w-full min-w-0 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Fin</label>
                <input
                  type="date"
                  value={newMeso.end_date}
                  onChange={(e) => setNewMeso({ ...newMeso, end_date: e.target.value })}
                  className="w-full min-w-0 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMesocycle}
                className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Crear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mesocycle List */}
      {mesocycles.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FiLayers className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay mesociclos definidos</p>
          <p className="text-xs mt-1">Crea el primero para organizar las fases de entrenamiento</p>
        </div>
      )}

      {mesocycles.map((meso) => {
        const phase = getPhaseInfo(meso.phase);
        const isExpanded = expandedMeso === meso.id;
        const micros = meso.microcycles || [];

        return (
          <motion.div
            key={meso.id}
            layout
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Mesocycle Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              onClick={() => setExpandedMeso(isExpanded ? null : meso.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-full" style={{ backgroundColor: phase.color }} />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{meso.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${phase.bg}`}>
                      {phase.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <FiCalendar className="w-3 h-3" />
                      {new Date(meso.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — {new Date(meso.end_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>{micros.length} semanas</span>
                    {meso.focus && <span className="hidden sm:inline">· {meso.focus}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteMesocycle(meso.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                {isExpanded ? <FiChevronUp className="w-4 h-4 text-gray-400" /> : <FiChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {/* Microcycles (Weeks) */}
            <AnimatePresence>
              {isExpanded && micros.length > 0 && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-gray-100 dark:border-gray-700"
                >
                  <div className="p-4 space-y-2">
                    {/* Desktop table header */}
                    <div className="hidden sm:grid grid-cols-12 text-[10px] font-medium text-gray-500 dark:text-gray-400 px-3 mb-1">
                      <span className="col-span-2">Semana</span>
                      <span className="col-span-2">Inicio</span>
                      <span className="col-span-2">Tipo</span>
                      <span className="col-span-2 text-right">Km plan</span>
                      <span className="col-span-2 text-right">Km real</span>
                      <span className="col-span-2 text-right">Cumplim.</span>
                    </div>
                    {micros
                      .sort((a, b) => a.week_number - b.week_number)
                      .map((micro) => {
                        const compliance = micro.planned_km && micro.actual_km
                          ? Math.round((micro.actual_km / micro.planned_km) * 100)
                          : null;
                        return (
                          <div key={micro.id}>
                            {/* Desktop row */}
                            <div className="hidden sm:grid grid-cols-12 items-center text-sm px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                              <span className="col-span-2 font-medium text-gray-900 dark:text-white">
                                S{micro.week_number}
                              </span>
                              <span className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
                                {new Date(micro.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="col-span-2">
                                <select
                                  value={micro.week_type}
                                  onChange={(e) => handleUpdateMicrocycle(micro.id, { week_type: e.target.value })}
                                  className="text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {WEEK_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </span>
                              <span className="col-span-2 text-right text-gray-600 dark:text-gray-400">
                                {micro.planned_km ? `${micro.planned_km} km` : '-'}
                              </span>
                              <span className="col-span-2 text-right font-medium text-gray-900 dark:text-white">
                                {micro.actual_km ? `${micro.actual_km} km` : '-'}
                              </span>
                              <span className="col-span-2 text-right">
                                {compliance !== null ? (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    compliance >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      : compliance >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  }`}>
                                    {compliance}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </span>
                            </div>

                            {/* Mobile card */}
                            <div className="sm:hidden flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-900 dark:text-white w-8">
                                  S{micro.week_number}
                                </span>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(micro.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </p>
                                  <select
                                    value={micro.week_type}
                                    onChange={(e) => handleUpdateMicrocycle(micro.id, { week_type: e.target.value })}
                                    className="text-xs mt-0.5 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  >
                                    {WEEK_TYPES.map(t => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-right">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Plan</p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {micro.planned_km ? `${micro.planned_km} km` : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Real</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {micro.actual_km ? `${micro.actual_km} km` : '-'}
                                  </p>
                                </div>
                                {compliance !== null ? (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    compliance >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      : compliance >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  }`}>
                                    {compliance}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
