import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FiStar,
  FiZap,
  FiClipboard,
  FiUpload,
  FiFileText,
  FiDownload,
  FiEye,
  FiPackage,
  FiCopy,
  FiBookmark,
  FiList,
} from 'react-icons/fi';
import {
  saveMesocycleAsTemplate,
  listMesocycleTemplates,
  deleteMesocycleTemplate,
  copyMesocycleContent,
  applyMesocycleTemplate,
  duplicateMesocycle,
} from '../../services/mesocycleTemplateService';
import {
  uploadGymFile,
  listGymFiles,
  deleteGymFile,
  getGymFileSignedUrl,
  formatFileSize,
  daysUntilExpiry,
} from '../../services/gymFilesService';
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
  transition: 'bg-gray-100 text-gray-700 dark:bg-coach-base/30 dark:text-gray-400',
};

const WEEK_TYPES = {
  normal: 'Normal',
  recovery: 'Recuperación',
  deload: 'Descarga',
  test: 'Test',
  race_week: 'Competición',
};

// Compute plan status based on assignments and weeks
function getPlanStatus(plan) {
  const assignments = plan.plan_assignments || [];
  if (assignments.length === 0) return 'draft';
  // If has active assignments, consider active
  return 'active';
}

// Compute progress pct: current week / total weeks
function getPlanProgress(plan) {
  const totalWeeks = (plan.mesocycles || []).reduce((s, m) => s + (m.weeks || 0), 0);
  if (totalWeeks === 0) return 0;
  const assignments = plan.plan_assignments || [];
  if (assignments.length === 0) return 0;
  // Use earliest start_date to estimate current week
  const earliest = assignments
    .filter(a => a.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
  if (!earliest) return 0;
  const weeksPassed = Math.floor((Date.now() - new Date(earliest.start_date)) / (7 * 86400000));
  return Math.min(100, Math.round((weeksPassed / totalWeeks) * 100));
}

function getCurrentWeek(plan) {
  const totalWeeks = (plan.mesocycles || []).reduce((s, m) => s + (m.weeks || 0), 0);
  const assignments = plan.plan_assignments || [];
  const earliest = assignments
    .filter(a => a.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
  if (!earliest) return null;
  const weeksPassed = Math.floor((Date.now() - new Date(earliest.start_date)) / (7 * 86400000)) + 1;
  return { current: Math.min(weeksPassed, totalWeeks), total: totalWeeks };
};

// Avatar stack for assigned athletes
const AvatarStack = ({ count }) => {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];
  const visible = Math.min(count, 3);
  return (
    <div className="flex items-center -space-x-1.5">
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          className={`w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 ${colors[i % colors.length]} flex items-center justify-center`}
        >
          <span className="text-white text-[9px] font-bold">A</span>
        </div>
      ))}
      {count > 3 && (
        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-coach-inset flex items-center justify-center">
          <span className="text-gray-600 dark:text-gray-300 text-[9px] font-bold">+{count - 3}</span>
        </div>
      )}
    </div>
  );
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
  const [activeFilter, setActiveFilter] = useState('all');

  // Planning tabs: 'plans' | 'gym'
  const [planningTab, setPlanningTab] = useState('plans');

  // Gym files state
  const [gymFiles, setGymFiles] = useState([]);
  const [gymLoading, setGymLoading] = useState(false);
  const [gymUploading, setGymUploading] = useState(false);
  const [gymDeleteConfirm, setGymDeleteConfirm] = useState(null);
  const [gymForm, setGymForm] = useState({ name: '', file: null });

  // Create plan form
  const [newPlanForm, setNewPlanForm] = useState({ name: '', description: '', modality: 'asfalto' });
  // Create mesocycle form
  const [newMesoForm, setNewMesoForm] = useState({ name: '', phase: 'base', weeks: 4 });

  // Mesocycle copy/template state
  const [mesoAction, setMesoAction] = useState(null); // { type: 'copy'|'saveTemplate'|'applyTemplate', meso }
  const [mesoTemplateName, setMesoTemplateName] = useState('');
  const [mesoTemplates, setMesoTemplates] = useState([]);
  const [loadingMesoTemplates, setLoadingMesoTemplates] = useState(false);
  const [savingMesoTemplate, setSavingMesoTemplate] = useState(false);
  const [mesoCopyTargetId, setMesoCopyTargetId] = useState('');
  const [mesoCopyMode, setMesoCopyMode] = useState('existing'); // 'existing' | 'duplicate'
  const [mesoDuplicateName, setMesoDuplicateName] = useState('');
  const [applyMesoTemplateId, setApplyMesoTemplateId] = useState('');
  const [deleteConfirmMesoTemplate, setDeleteConfirmMesoTemplate] = useState(null);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleCreatePlan = useCallback(async () => {
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

  const handleSaveWeek = useCallback(async (microcycleId, content, plannedKm, opts = {}) => {
    const { error } = await updateWeekContent(microcycleId, content, plannedKm);
    if (error) {
      showError('Error al guardar la semana');
    } else {
      showSuccess(opts.successMsg || 'Semana guardada');
      if (!opts.keepOpen) setEditingWeek(null);
    }
  }, [updateWeekContent]);

  const loadMesoTemplates = useCallback(async () => {
    setLoadingMesoTemplates(true);
    const { data } = await listMesocycleTemplates(coachId);
    setMesoTemplates(data || []);
    setLoadingMesoTemplates(false);
  }, [coachId]);

  const handleOpenMesoAction = useCallback(async (type, meso) => {
    setMesoAction({ type, meso });
    setMesoTemplateName(meso.name || '');
    setMesoCopyTargetId('');
    setMesoCopyMode('existing');
    setMesoDuplicateName(`${meso.name} (copia)`);
    setApplyMesoTemplateId('');
    setDeleteConfirmMesoTemplate(null);
    if (type === 'applyTemplate') {
      setLoadingMesoTemplates(true);
      const { data } = await listMesocycleTemplates(coachId);
      setMesoTemplates(data || []);
      setLoadingMesoTemplates(false);
    }
  }, [coachId]);

  const handleSaveMesoTemplate = useCallback(async () => {
    if (!mesoTemplateName.trim() || !mesoAction?.meso) return;
    setSavingMesoTemplate(true);
    const { error } = await saveMesocycleAsTemplate(coachId, mesoTemplateName, mesoAction.meso);
    setSavingMesoTemplate(false);
    if (error) {
      showError('Error al guardar la plantilla');
    } else {
      showSuccess('Plantilla de mesociclo guardada');
      setMesoAction(null);
    }
  }, [coachId, mesoTemplateName, mesoAction]);

  const handleCopyMeso = useCallback(async () => {
    if (!mesoCopyTargetId || !mesoAction?.meso) return;
    const targetMeso = (selectedPlan?.mesocycles || []).find(m => m.id === mesoCopyTargetId);
    if (!targetMeso) return;
    setSavingMesoTemplate(true);
    const { updated, error } = await copyMesocycleContent(mesoAction.meso, targetMeso);
    setSavingMesoTemplate(false);
    if (error) {
      showError('Error al copiar el mesociclo');
    } else {
      showSuccess(`Mesociclo copiado (${updated} semana${updated !== 1 ? 's' : ''})`);
      setMesoAction(null);
      // Reload so updated content appears
      loadPlans();
    }
  }, [mesoCopyTargetId, mesoAction, selectedPlan, loadPlans]);

  const handleDuplicateMeso = useCallback(async () => {
    if (!mesoAction?.meso || !selectedPlan) return;
    setSavingMesoTemplate(true);
    const sortOrder = (selectedPlan.mesocycles || []).length;
    const { data, error } = await duplicateMesocycle(
      selectedPlan.id,
      mesoAction.meso,
      mesoDuplicateName,
      sortOrder,
    );
    setSavingMesoTemplate(false);
    if (error) {
      showError('Error al duplicar el mesociclo');
    } else {
      showSuccess('Mesociclo duplicado');
      setMesoAction(null);
      // Optimistic: reload plans so new meso appears
      loadPlans();
      // Keep the plan selected after reload
      const planId = selectedPlan.id;
      setTimeout(() => selectPlan(planId), 300);
      void data;
    }
  }, [mesoAction, selectedPlan, mesoDuplicateName, loadPlans, selectPlan]);

  const handleApplyMesoTemplate = useCallback(async () => {
    if (!applyMesoTemplateId || !mesoAction?.meso) return;
    const template = mesoTemplates.find(t => t.id === applyMesoTemplateId);
    if (!template) return;
    setSavingMesoTemplate(true);
    const { updated, error } = await applyMesocycleTemplate(template, mesoAction.meso);
    setSavingMesoTemplate(false);
    if (error) {
      showError('Error al aplicar la plantilla');
    } else {
      showSuccess(`Plantilla aplicada (${updated} semana${updated !== 1 ? 's' : ''})`);
      setMesoAction(null);
      loadPlans();
    }
  }, [applyMesoTemplateId, mesoAction, mesoTemplates, loadPlans]);

  const handleDeleteMesoTemplate = useCallback(async (templateId) => {
    const { error } = await deleteMesocycleTemplate(templateId);
    if (error) {
      showError('Error al eliminar la plantilla');
    } else {
      showSuccess('Plantilla eliminada');
      setDeleteConfirmMesoTemplate(null);
      setMesoTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  }, []);

  const getWeekDaysPreview = (content) => {
    if (!content?.days) return null;
    return content.days.filter(d => d && d.description?.trim()).length;
  };

  const getTotalKm = (content) => {
    if (!content?.days) return 0;
    return content.days.reduce((sum, d) => sum + (d?.km || 0), 0);
  };

  // ===== GYM FILES =====
  const loadGymFiles = useCallback(async () => {
    if (!coachId) return;
    setGymLoading(true);
    const { data } = await listGymFiles(coachId);
    setGymFiles(data);
    setGymLoading(false);
  }, [coachId]);

  useEffect(() => {
    if (planningTab === 'gym') loadGymFiles();
  }, [planningTab, loadGymFiles]);

  const handleGymUpload = useCallback(async () => {
    if (!gymForm.file) { showError('Selecciona un archivo PDF'); return; }
    if (gymForm.file.size > 10 * 1024 * 1024) { showError('El archivo no puede superar 10 MB'); return; }
    const displayName = gymForm.name.trim() || gymForm.file.name;
    setGymUploading(true);
    const { error } = await uploadGymFile(coachId, gymForm.file, displayName);
    setGymUploading(false);
    if (error) { showError('Error al subir el archivo'); return; }
    showSuccess('Archivo subido correctamente');
    setGymForm({ name: '', file: null });
    loadGymFiles();
  }, [gymForm, coachId, loadGymFiles]);

  const handleGymDelete = useCallback(async (file) => {
    const { error } = await deleteGymFile(file.id, file.storage_path);
    if (error) { showError('Error al eliminar el archivo'); return; }
    showSuccess('Archivo eliminado');
    setGymDeleteConfirm(null);
    setGymFiles(prev => prev.filter(f => f.id !== file.id));
  }, []);

  const isPwa = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const handleGymView = useCallback(async (storagePath) => {
    const { url, error } = await getGymFileSignedUrl(storagePath);
    if (error || !url) { showError('No se pudo abrir el archivo'); return; }
    if (isPwa()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const handleGymDownload = useCallback(async (file) => {
    const { url, error } = await getGymFileSignedUrl(file.storage_path);
    if (error || !url) { showError('No se pudo descargar el archivo'); return; }
    if (isPwa()) {
      window.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  // Filtered plans
  const filteredPlans = useMemo(() => {
    if (activeFilter === 'all') return plans;
    if (activeFilter === 'active') return plans.filter(p => getPlanStatus(p) === 'active');
    if (activeFilter === 'draft') return plans.filter(p => getPlanStatus(p) === 'draft');
    return plans;
  }, [plans, activeFilter]);

  // ===== PLAN LIST VIEW =====
  if (!selectedPlan) {
    return (
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planificación</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {planningTab === 'plans' ? 'Planes de entrenamiento' : 'Archivos PDF de gimnasio'}
            </p>
          </div>
          {planningTab === 'plans' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
            >
              <FiPlus className="w-4 h-4" />
              Nuevo Plan
            </button>
          ) : null}
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'plans', label: 'Planes', icon: FiClipboard },
            { key: 'gym', label: 'Archivos Gym', icon: FiPackage },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPlanningTab(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                planningTab === key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-coach-surface border border-gray-200 dark:border-coach-border text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ===== GYM FILES TAB ===== */}
        {planningTab === 'gym' && (
          <div className="space-y-4">
            {/* Upload form */}
            <div className="bg-coach-surface rounded-2xl border border-gray-200 dark:border-coach-border p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <FiUpload className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Subir PDF de Gym</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nombre del archivo
                  </label>
                  <input
                    type="text"
                    value={gymForm.name}
                    onChange={e => setGymForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Plan Fuerza Semana 1"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-coach-border bg-white dark:bg-coach-elevated text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Archivo PDF <span className="text-slate-400 font-normal">(máx. 10 MB)</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={e => setGymForm(f => ({ ...f, file: e.target.files[0] || null }))}
                    className="w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600 dark:file:bg-blue-900/30 dark:file:text-blue-400 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {gymForm.file && (
                    <p className="text-xs text-slate-400 mt-1">
                      {gymForm.file.name} · {formatFileSize(gymForm.file.size)}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <FiClock className="w-3 h-3" /> Disponible 14 días
                  </p>
                  <button
                    onClick={handleGymUpload}
                    disabled={gymUploading || !gymForm.file}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {gymUploading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiUpload className="w-3.5 h-3.5" />
                    )}
                    {gymUploading ? 'Subiendo…' : 'Subir'}
                  </button>
                </div>
              </div>
            </div>

            {/* Files list */}
            {gymLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : gymFiles.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 px-4">
                <div className="w-16 h-16 rounded-full bg-coach-elevated/50 flex items-center justify-center mb-3">
                  <FiFileText className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sin archivos todavía</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Sube el primer PDF de gym para tus atletas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gymFiles.map(file => {
                  const days = daysUntilExpiry(file.expires_at);
                  const daysBadge = days <= 3
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : days <= 7
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';

                  return (
                    <div key={file.id} className="bg-coach-surface rounded-xl border border-gray-200 dark:border-coach-border p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                        <FiFileText className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.filename}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">{formatFileSize(file.file_size)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${daysBadge}`}>
                            {days}d
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleGymView(file.storage_path)}
                          title="Ver"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleGymDownload(file)}
                          title="Descargar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        >
                          <FiDownload className="w-3.5 h-3.5" />
                        </button>
                        {gymDeleteConfirm === file.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleGymDelete(file)}
                              className="px-2 py-1 text-[10px] font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setGymDeleteConfirm(null)}
                              className="px-2 py-1 text-[10px] font-semibold bg-gray-200 dark:bg-coach-inset text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setGymDeleteConfirm(file.id)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {planningTab === 'plans' && (loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          /* ── EMPTY STATE ── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-12 px-4"
          >
            {/* Illustration */}
            <div className="w-32 h-32 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6 relative">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-coach-elevated shadow-md flex items-center justify-center">
                <FiClipboard className="w-9 h-9 text-blue-400" />
              </div>
              <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow">
                <FiPlus className="w-4 h-4 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Crea tu primer plan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-8 leading-relaxed">
              Diseña planes de entrenamiento personalizados para cada atleta, con sesiones semana a semana y orientados a una competición objetivo.
            </p>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors font-semibold text-sm shadow-sm mb-4"
            >
              <FiPlus className="w-4 h-4" />
              Crear nuevo plan
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">o importar desde plantilla →</p>

            {/* Feature list */}
            <div className="w-full max-w-sm space-y-3">
              {[
                { icon: FiCalendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'Define semanas, sesiones y carga progresiva para cada atleta' },
                { icon: FiStar, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', text: 'Asigna una competición objetivo y TrainingTrack calcula el progreso' },
                { icon: FiZap, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'Usa IA para generar sesiones automáticamente según el nivel del atleta (próximamente)' },
              ].map(({ icon: Icon, color, bg, text }) => (
                <div key={text} className="flex items-start gap-3 p-3 bg-coach-surface rounded-xl border border-gray-100 dark:border-coach-border text-left">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'active', label: 'Activos' },
                { key: 'draft', label: 'Borrador' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === f.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-coach-surface border border-gray-200 dark:border-coach-border text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Plans list */}
            <div className="space-y-3">
              {filteredPlans.map((plan, i) => {
                const totalWeeks = (plan.mesocycles || []).reduce((s, m) => s + (m.weeks || 0), 0);
                const assignedCount = (plan.plan_assignments || []).length;
                const progress = getPlanProgress(plan);
                const weekInfo = getCurrentWeek(plan);
                const status = getPlanStatus(plan);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-coach-surface rounded-2xl border border-gray-100 dark:border-coach-border p-4 sm:p-5 cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => selectPlan(plan.id)}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {plan.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500'
                          }`}>
                            {status === 'active' ? 'Activo' : 'Borrador'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
                          {weekInfo && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Sem. {weekInfo.current}/{weekInfo.total}
                            </span>
                          )}
                        </div>
                      </div>
                      <FiChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                    </div>

                    {/* Progress bar */}
                    {status === 'active' && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Progreso del plan</span>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-coach-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {assignedCount > 0 && <AvatarStack count={assignedCount} />}
                        {(plan.plan_assignments || []).find(a => a.start_date) && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Inicio: {new Date((plan.plan_assignments || []).sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]?.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => selectPlan(plan.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <FiEdit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'plan', id: plan.id, name: plan.name })}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        ))}

        {/* Create Plan Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-coach-surface rounded-2xl shadow-xl max-w-lg w-full p-6"
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Nuevo Plan de Entrenamiento
                </h2>

                {/* Plan Type Selection */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex flex-col items-center gap-2 p-4 border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <FiEdit3 className="w-6 h-6 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Personalizado</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Crea tu propio plan</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-coach-border rounded-xl opacity-50 cursor-not-allowed relative">
                    <FiLock className="w-6 h-6 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Predeterminado</span>
                    <span className="text-xs text-gray-400">Planes estándar</span>
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-200 dark:bg-coach-inset text-gray-500 dark:text-gray-400 rounded text-[10px] font-medium">
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
                      onChange={e => setNewPlanForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Preparación Media Maratón"
                      className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      style={{ fontSize: '16px' }}
                      onKeyDown={e => e.key === 'Enter' && handleCreatePlan()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={newPlanForm.description}
                      onChange={e => setNewPlanForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción opcional del plan..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      style={{ fontSize: '16px' }}
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
                              : 'border-gray-200 dark:border-coach-border hover:border-gray-300'
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
                  <button
                    onClick={handleCreatePlan}
                    disabled={saving || !newPlanForm.name.trim()}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {saving ? 'Creando...' : 'Crear Plan'}
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
                className="bg-coach-surface rounded-2xl shadow-xl max-w-sm w-full p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Eliminar {deleteConfirm.type === 'plan' ? 'plan' : 'mesociclo'}
                </h3>
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
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectPlan(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPlan.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
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
            className="flex items-center gap-2 px-4 py-2 bg-coach-surface border border-gray-200 dark:border-coach-border text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
          >
            <FiPlus className="w-4 h-4" />
            Añadir Mesociclo
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium text-sm shadow-sm"
          >
            <FiUsers className="w-4 h-4" />
            Asignar
          </button>
        </div>
      </div>

      {/* Mesocycles */}
      <div className="space-y-3">
        {(selectedPlan.mesocycles || []).length === 0 && !showMesoForm && (
          <div className="flex flex-col items-center py-12 text-center bg-coach-surface rounded-2xl border border-dashed border-gray-200 dark:border-coach-border">
            <FiCalendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Sin mesociclos todavía</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Añade fases de entrenamiento a este plan</p>
            <button
              onClick={() => setShowMesoForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <FiPlus className="w-4 h-4" />
              Añadir Mesociclo
            </button>
          </div>
        )}

        {(selectedPlan.mesocycles || []).map((meso, mesoIdx) => (
          <motion.div
            key={meso.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mesoIdx * 0.04 }}
            className="bg-coach-surface rounded-2xl border border-gray-100 dark:border-coach-border overflow-hidden"
          >
            {/* Mesocycle Header */}
            <div
              className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setExpandedMeso(expandedMeso === meso.id ? null : meso.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${PHASE_COLORS[meso.phase] || PHASE_COLORS.base}`}>
                  {mesoIdx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{meso.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PHASE_COLORS[meso.phase] || PHASE_COLORS.base}`}>
                      {PHASES[meso.phase] || meso.phase}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {meso.weeks || 0} semanas
                    {meso.focus && ` · ${meso.focus}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); handleOpenMesoAction('copy', meso); }}
                  title="Copiar mesociclo a otro"
                  className="p-1.5 rounded-lg transition-colors text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <FiCopy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleOpenMesoAction('saveTemplate', meso); }}
                  title="Guardar como plantilla"
                  className="p-1.5 rounded-lg transition-colors text-purple-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <FiBookmark className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleOpenMesoAction('applyTemplate', meso); }}
                  title="Aplicar plantilla"
                  className="p-1.5 rounded-lg transition-colors text-green-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <FiList className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setDeleteConfirm({ type: 'meso', id: meso.id, name: meso.name });
                  }}
                  className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                </button>
                {expandedMeso === meso.id
                  ? <FiChevronDown className="w-4 h-4 text-gray-400" />
                  : <FiChevronRight className="w-4 h-4 text-gray-400" />
                }
              </div>
            </div>

            {/* Expanded: Microcycles */}
            <AnimatePresence>
              {expandedMeso === meso.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-100 dark:border-coach-border divide-y divide-gray-100 dark:divide-coach-border/50">
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
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                            onClick={() => setEditingWeek(isEditing ? null : micro)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                isEditing
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : 'bg-coach-elevated text-gray-600 dark:text-gray-300'
                              }`}>
                                {micro.week_number}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    Semana {micro.week_number}
                                  </span>
                                  {micro.week_type && micro.week_type !== 'normal' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-coach-inset text-gray-500 dark:text-gray-400">
                                      {WEEK_TYPES[micro.week_type] || micro.week_type}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2.5 mt-0.5">
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
                            <FiEdit3 className={`w-4 h-4 ${isEditing ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`} />
                          </div>

                          {isEditing && (
                            <WeeklyPlanEditor
                              microcycle={micro}
                              onSave={handleSaveWeek}
                              onClose={() => setEditingWeek(null)}
                              saving={saving}
                              coachId={coachId}
                              allMicrocycles={(selectedPlan.mesocycles || []).flatMap(m =>
                                (m.microcycles || []).map(mc => ({ ...mc, mesoName: m.name }))
                              )}
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
        <AnimatePresence>
          {showMesoForm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="bg-coach-surface rounded-2xl border border-gray-200 dark:border-coach-border p-4"
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nuevo Mesociclo</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newMesoForm.name}
                  onChange={e => setNewMesoForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del mesociclo"
                  className="px-3 py-2 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  style={{ fontSize: '16px' }}
                />
                <select
                  value={newMesoForm.phase}
                  onChange={e => setNewMesoForm(prev => ({ ...prev, phase: e.target.value }))}
                  className="px-3 py-2 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                    onChange={e => setNewMesoForm(prev => ({ ...prev, weeks: parseInt(e.target.value) || 4 }))}
                    className="w-20 px-3 py-2 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    style={{ fontSize: '16px' }}
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
        </AnimatePresence>
      </div>

      {/* ===== MESOCYCLE ACTION MODALS ===== */}
      <AnimatePresence>
        {mesoAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-coach-surface rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              {/* COPY modal */}
              {mesoAction.type === 'copy' && (
                <>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Copiar mesociclo</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Copia el contenido de <strong>"{mesoAction.meso.name}"</strong>.
                  </p>

                  {/* Mode toggle */}
                  <div className="flex gap-2 mb-4">
                    {[
                      { key: 'existing', label: 'Sobre uno existente' },
                      { key: 'duplicate', label: 'Duplicar (nuevo)' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setMesoCopyMode(opt.key)}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                          mesoCopyMode === opt.key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : 'border-gray-200 dark:border-coach-border text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {mesoCopyMode === 'existing' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Destino
                      </label>
                      <select
                        value={mesoCopyTargetId}
                        onChange={e => setMesoCopyTargetId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                      >
                        <option value="">— Selecciona mesociclo destino —</option>
                        {(selectedPlan?.mesocycles || [])
                          .filter(m => m.id !== mesoAction.meso.id)
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.weeks} sem · {PHASES[m.phase] || m.phase})
                            </option>
                          ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Nombre del nuevo mesociclo
                      </label>
                      <input
                        type="text"
                        value={mesoDuplicateName}
                        onChange={e => setMesoDuplicateName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                        style={{ fontSize: '16px' }}
                        onKeyDown={e => e.key === 'Enter' && handleDuplicateMeso()}
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 -mt-2">
                        Se creará con la misma fase ({PHASES[mesoAction.meso.phase] || mesoAction.meso.phase}) y {mesoAction.meso.weeks} semanas, copiando todo el contenido.
                      </p>
                    </>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setMesoAction(null)}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={mesoCopyMode === 'existing' ? handleCopyMeso : handleDuplicateMeso}
                      disabled={
                        savingMesoTemplate ||
                        (mesoCopyMode === 'existing' ? !mesoCopyTargetId : !mesoDuplicateName.trim())
                      }
                      className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {savingMesoTemplate
                        ? (mesoCopyMode === 'duplicate' ? 'Duplicando...' : 'Copiando...')
                        : (mesoCopyMode === 'duplicate' ? 'Duplicar' : 'Copiar')}
                    </button>
                  </div>
                </>
              )}

              {/* SAVE TEMPLATE modal */}
              {mesoAction.type === 'saveTemplate' && (
                <>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Guardar plantilla</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Guarda <strong>"{mesoAction.meso.name}"</strong> como plantilla reutilizable.
                  </p>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Nombre de la plantilla
                  </label>
                  <input
                    type="text"
                    value={mesoTemplateName}
                    onChange={e => setMesoTemplateName(e.target.value)}
                    placeholder="Ej: Mesociclo Base 4 semanas"
                    className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none mb-4"
                    style={{ fontSize: '16px' }}
                    onKeyDown={e => e.key === 'Enter' && handleSaveMesoTemplate()}
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setMesoAction(null)}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveMesoTemplate}
                      disabled={!mesoTemplateName.trim() || savingMesoTemplate}
                      className="px-5 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {savingMesoTemplate ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </>
              )}

              {/* APPLY TEMPLATE modal */}
              {mesoAction.type === 'applyTemplate' && (
                <>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Aplicar plantilla</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Aplica una plantilla sobre <strong>"{mesoAction.meso.name}"</strong>. Sobreescribe el contenido de las semanas existentes.
                  </p>
                  {loadingMesoTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : mesoTemplates.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
                      No tienes plantillas guardadas todavía.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                      {mesoTemplates.map(t => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                            applyMesoTemplateId === t.id
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-coach-border hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                          onClick={() => setApplyMesoTemplateId(t.id)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {PHASES[t.phase] || t.phase} · {t.weeks} sem. · {(t.mesocycle_template_weeks || []).length} semanas con contenido
                            </p>
                          </div>
                          {deleteConfirmMesoTemplate === t.id ? (
                            <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteMesoTemplate(t.id)}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-red-600 text-white rounded-lg"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setDeleteConfirmMesoTemplate(null)}
                                className="px-2 py-0.5 text-[10px] font-semibold bg-gray-200 dark:bg-coach-inset text-gray-700 dark:text-gray-300 rounded-lg"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirmMesoTemplate(t.id); }}
                              className="ml-2 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setMesoAction(null)}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleApplyMesoTemplate}
                      disabled={!applyMesoTemplateId || savingMesoTemplate}
                      className="px-5 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {savingMesoTemplate ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-coach-surface rounded-2xl shadow-xl max-w-sm w-full p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Eliminar {deleteConfirm.type === 'plan' ? 'plan' : 'mesociclo'}
              </h3>
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
