import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus,
  FiChevronRight,
  FiChevronDown,
  FiTrash2,
  FiEdit3,
  FiUsers,
  FiArrowLeft,
  FiLock,
  FiCalendar,
  FiClock,
} from 'react-icons/fi';
import { showSuccess, showError } from '../../lib/toast';
import usePlanningData from '../../hooks/usePlanningData';
import WeeklyPlanEditor from '../../components/dashboard/WeeklyPlanEditor';
import PlanAssignmentModal from '../../components/dashboard/PlanAssignmentModal';

const PHASES = {
  base: 'Base',
  build: 'Construcción',
  peak: 'Pico',
  taper: 'Tapering',
  recovery: 'Recuperación',
  competition: 'Competición',
  transition: 'Transición',
};

const PHASE_COLORS = {
  base: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  build: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  peak: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  taper: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  recovery: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  competition: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  transition: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const WEEK_TYPES = {
  normal: 'Normal',
  recovery: 'Recuperación',
  deload: 'Descarga',
  test: 'Test',
  race_week: 'Competición',
};

const Planning = () => {
  const { profile } = useAuth();
  const coachId = profile?.coach_id || profile?.id;
  const {
    plans, selectedPlan, loading, saving,
    loadPlans, selectPlan, createNewPlan, updatePlanDetails, removePlan,
    addMesocycle, updateMesocycleDetails, removeMesocycle,
    updateWeekContent, assignToAthletes,
  } = usePlanningData(coachId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedMeso, setExpandedMeso] = useState(null);
  const [editingWeek, setEditingWeek] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMesoForm, setShowMesoForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Create plan form
  const [newPlanForm, setNewPlanForm] = useState({ name: '', description: '', modality: 'asfalto' });
  // Create mesocycle form
  const [newMesoForm, setNewMesoForm] = useState({ name: '', phase: 'base', weeks: 4 });

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleCreatePlan = useCallback(async (type) => {
    if (type === 'predefined') return; // Proximamente
    if (!newPlanForm.name.trim()) {
      showError('El nombre del plan es obligatorio');
      return;
    }
    const { error } = await createNewPlan(newPlanForm);
    if (error) {
      showError('Error al crear el plan');
    } else {
      showSuccess('Plan creado correctamente');
      setShowCreateModal(false);
      setNewPlanForm({ name: '', description: '', modality: 'asfalto' });
    }
  }, [newPlanForm, createNewPlan]);

  const handleAddMesocycle = useCallback(async () => {
    if (!selectedPlan || !newMesoForm.name.trim()) {
      showError('El nombre del mesociclo es obligatorio');
      return;
    }
    const { error } = await addMesocycle(selectedPlan.id, newMesoForm);
    if (error) {
      showError('Error al crear el mesociclo');
    } else {
      showSuccess('Mesociclo creado');
      setShowMesoForm(false);
      setNewMesoForm({ name: '', phase: 'base', weeks: 4 });
    }
  }, [selectedPlan, newMesoForm, addMesocycle]);

  const handleDeletePlan = useCallback(async (planId) => {
    const { error } = await removePlan(planId);
    if (error) {
      showError('Error al eliminar el plan');
    } else {
      showSuccess('Plan eliminado');
      setDeleteConfirm(null);
    }
  }, [removePlan]);

  const handleDeleteMeso = useCallback(async (mesoId) => {
    const { error } = await removeMesocycle(mesoId);
    if (error) {
      showError('Error al eliminar el mesociclo');
    } else {
      showSuccess('Mesociclo eliminado');
      setDeleteConfirm(null);
    }
  }, [removeMesocycle]);

  const handleSaveWeek = useCallback(async (microcycleId, content, plannedKm) => {
    const { error } = await updateWeekContent(microcycleId, content, plannedKm);
    if (error) {
      showError('Error al guardar la semana');
    } else {
      showSuccess('Semana guardada');
      setEditingWeek(null);
    }
  }, [updateWeekContent]);

  const getWeekDaysPreview = (content) => {
    if (!content?.days) return null;
    const filledDays = content.days.filter(d => d && d.description?.trim());
    return filledDays.length;
  };

  const getTotalKm = (content) => {
    if (!content?.days) return 0;
    return content.days.reduce((sum, d) => sum + (d?.km || 0), 0);
  };

  // ===== PLAN LIST VIEW =====
  if (!selectedPlan) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planificación</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Crea y gestiona planes de entrenamiento para tus atletas
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm w-full sm:w-auto"
          >
            <FiPlus className="w-4 h-4" />
            Nuevo Plan
          </button>
        </div>

        {/* Plans Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4">
              <FiCalendar className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sin planes de entrenamiento
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
              Crea tu primer plan de entrenamiento y asígnalo a tus atletas para empezar a planificar.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <FiPlus className="w-4 h-4" />
              Crear plan
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan, i) => {
              const totalWeeks = (plan.mesocycles || []).reduce((sum, m) => sum + (m.weeks || 0), 0);
              const assignedCount = (plan.plan_assignments || []).length;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => selectPlan(plan.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <FiChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {plan.modality && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        plan.modality === 'pista'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {plan.modality === 'pista' ? 'Pista' : 'Asfalto'}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FiClock className="w-3.5 h-3.5" />
                      {totalWeeks} sem.
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FiUsers className="w-3.5 h-3.5" />
                      {assignedCount} atleta{assignedCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ type: 'plan', id: plan.id, name: plan.name });
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create Plan Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Nuevo Plan de Entrenamiento
                </h2>

                {/* Plan Type Selection */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => handleCreatePlan('custom')}
                    disabled={saving || !newPlanForm.name.trim()}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                  >
                    <FiEdit3 className="w-6 h-6 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Personalizado</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Crea tu propio plan</span>
                  </button>
                  <div className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl opacity-50 cursor-not-allowed relative">
                    <FiLock className="w-6 h-6 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Predeterminado</span>
                    <span className="text-xs text-gray-400">Planes estándar</span>
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded text-[10px] font-medium">
                      Próximamente
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre del plan *
                    </label>
                    <input
                      type="text"
                      value={newPlanForm.name}
                      onChange={(e) => setNewPlanForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Preparación Media Maratón"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={newPlanForm.description}
                      onChange={(e) => setNewPlanForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción opcional del plan..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Modalidad
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'pista', label: 'Pista', sub: 'Medio fondo / Fondo' },
                        { value: 'asfalto', label: 'Asfalto', sub: '5K / 10K / Media / Maratón' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewPlanForm(prev => ({ ...prev, modality: opt.value }))}
                          className={`flex-1 p-3 rounded-xl border-2 transition-colors text-left ${
                            newPlanForm.modality === opt.value
                              ? opt.value === 'pista'
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600'
                                : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewPlanForm({ name: '', description: '', modality: 'asfalto' });
                    }}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation */}
        <AnimatePresence>
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Eliminar {deleteConfirm.type === 'plan' ? 'plan' : 'mesociclo'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  ¿Seguro que quieres eliminar <strong>"{deleteConfirm.name}"</strong>? Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteConfirm.type === 'plan'
                      ? handleDeletePlan(deleteConfirm.id)
                      : handleDeleteMeso(deleteConfirm.id)
                    }
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== PLAN EDITOR VIEW =====
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectPlan(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPlan.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {selectedPlan.modality && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedPlan.modality === 'pista'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {selectedPlan.modality === 'pista' ? 'Pista' : 'Asfalto'}
                </span>
              )}
              {selectedPlan.description && (
                <span className="text-sm text-gray-500 dark:text-gray-400">{selectedPlan.description}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMesoForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
          >
            <FiPlus className="w-4 h-4" />
            Añadir Mesociclo
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
          >
            <FiUsers className="w-4 h-4" />
            Asignar
          </button>
        </div>
      </div>

      {/* Mesocycles */}
      <div className="space-y-4">
        {(selectedPlan.mesocycles || []).map((meso, mesoIdx) => (
          <motion.div
            key={meso.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mesoIdx * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Mesocycle Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setExpandedMeso(expandedMeso === meso.id ? null : meso.id)}
            >
              <div className="flex items-center gap-3">
                {expandedMeso === meso.id ? (
                  <FiChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <FiChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{meso.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PHASE_COLORS[meso.phase] || PHASE_COLORS.base}`}>
                      {PHASES[meso.phase] || meso.phase}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {meso.weeks || 0} semanas
                    {meso.focus && ` — ${meso.focus}`}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ type: 'meso', id: meso.id, name: meso.name });
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Expanded: Microcycles (Weeks) */}
            <AnimatePresence>
              {expandedMeso === meso.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {(meso.microcycles || []).map((micro) => {
                      const daysCount = getWeekDaysPreview(micro.content);
                      const totalKm = getTotalKm(micro.content);
                      const isEditing = editingWeek?.id === micro.id;

                      return (
                        <div key={micro.id}>
                          <div
                            className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                              isEditing
                                ? 'bg-blue-50 dark:bg-blue-900/10'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                            onClick={() => setEditingWeek(isEditing ? null : micro)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                                isEditing
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              }`}>
                                {micro.week_number}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    Semana {micro.week_number}
                                  </span>
                                  {micro.week_type && micro.week_type !== 'normal' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                                      {WEEK_TYPES[micro.week_type] || micro.week_type}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {daysCount !== null ? (
                                    <>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {daysCount} sesión{daysCount !== 1 ? 'es' : ''}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {totalKm} km
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                      Sin contenido — click para editar
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <FiEdit3 className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-gray-400'}`} />
                          </div>

                          {/* Inline editor */}
                          {isEditing && (
                            <WeeklyPlanEditor
                              microcycle={micro}
                              onSave={handleSaveWeek}
                              onClose={() => setEditingWeek(null)}
                              saving={saving}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {/* Add Mesocycle Form */}
        {showMesoForm && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nuevo Mesociclo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newMesoForm.name}
                onChange={(e) => setNewMesoForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del mesociclo"
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <select
                value={newMesoForm.phase}
                onChange={(e) => setNewMesoForm(prev => ({ ...prev, phase: e.target.value }))}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {Object.entries(PHASES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={newMesoForm.weeks}
                  onChange={(e) => setNewMesoForm(prev => ({ ...prev, weeks: parseInt(e.target.value) || 4 }))}
                  className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">semanas</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setShowMesoForm(false); setNewMesoForm({ name: '', phase: 'base', weeks: 4 }); }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMesocycle}
                disabled={saving || !newMesoForm.name.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Plan Assignment Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <PlanAssignmentModal
            coachId={coachId}
            plan={selectedPlan}
            onAssign={assignToAthletes}
            onClose={() => setShowAssignModal(false)}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation (reused in editor view) */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Eliminar {deleteConfirm.type === 'plan' ? 'plan' : 'mesociclo'}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                ¿Seguro que quieres eliminar <strong>"{deleteConfirm.name}"</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteConfirm.type === 'plan'
                    ? handleDeletePlan(deleteConfirm.id)
                    : handleDeleteMeso(deleteConfirm.id)
                  }
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Planning;
