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
  FiTrendingUp,
  FiFlag,
  FiExternalLink,
  FiChevronDown,
  FiPlus,
} from 'react-icons/fi';
import { SiStrava } from 'react-icons/si';
import { useAuth } from '../../contexts/AuthContext';
import useMyPlanData from '../../hooks/useMyPlanData';
import useWeeklyTrainings from '../../hooks/useWeeklyTrainings';
import useStravaActivities from '../../hooks/useStravaActivities';
import OnboardingWizard from '../../components/athlete/OnboardingWizard';
import PlanPreviewInline from '../../components/athlete/PlanPreviewInline';
import SessionCompletionModal from '../../components/athlete/SessionCompletionModal';
import { saveRpeToSession } from '../../services/sessionCompletionService';
import { showError, showSuccess } from '../../lib/toast';
import { generateWeeklyPDF } from '../../lib/pdfExport';
import { getMyWeeklySessions } from '../../services/independentPlanService';
import { DAYS_OF_WEEK } from '../../services/weeklyTrainingService';
import { getActivityTypeLabel, formatDuration, calculatePace } from '../../services/stravaService';
import useMapbox from '../../hooks/useMapbox';
import { getRPEEmoji } from '../../services/rpeService';
import { inferTrainingType, toLocalDateStr } from '../../lib/dateUtils';
import useAthleteTestData from '../../hooks/useAthleteTestData';
import VAMTestModal from '../../components/dashboard/VAMTestModal';

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
  if (!dateStr) return false;
  const todayStr = toLocalDateStr(new Date());
  return dateStr <= todayStr;
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
      <div className="w-20 h-20 rounded-2xl bg-ath-accent-surface flex items-center justify-center">
        <FiClipboard className="w-10 h-10 text-ath-accent-text" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-ath-text-primary mb-2">
          Aún no tienes un plan
        </h2>
        <p className="text-ath-text-muted max-w-md">
          ¡Genera uno con IA! La IA analizará tu perfil y creará un plan de entrenamiento
          personalizado de 4 semanas, adaptado a tus objetivos y disponibilidad.
        </p>
        <p className="text-xs text-ath-text-muted mt-2">
          Basado en tu perfil
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating || !rateLimit.canGenerate}
        className="flex items-center gap-2 px-6 py-3 bg-ath-accent hover:bg-ath-accent-hover disabled:bg-slate-300 dark:disabled:bg-slate-700 text-ath-on-accent font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
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
  const [rpeSession, setRpeSession] = useState(null);
  const [rpeValue, setRpeValue] = useState(null);
  const [savingRpe, setSavingRpe] = useState(false);

  const {
    stravaConnected, stravaActivities, loadingStrava,
    selectedActivity, setSelectedActivity, visibleActivities,
    activitiesRPE, editRpeActivity, setEditRpeActivity,
    loadActivityDetail, handleEditRPESave, showMoreActivities,
  } = useStravaActivities(profile?.id);

  const { athletePaces, latestVam, latestConconiTest, refresh: refreshTestData } = useAthleteTestData(profile?.id);

  const [showConconiTable, setShowConconiTable] = useState(false);
  const [showVamTable, setShowVamTable] = useState(false);
  const [showVamModal, setShowVamModal] = useState(false);

  // ---- Tests de rendimiento: cálculos compartidos ----
  const paceOrder = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];
  const sortedPaces = paceOrder.map(code => athletePaces.find(p => p.pace_code === code)).filter(Boolean);
  const bgColors = { RM:'bg-red-600', R10:'bg-red-500', R9:'bg-red-400', R8:'bg-orange-500', R7:'bg-orange-400', R6:'bg-yellow-500', R5:'bg-yellow-400', R4:'bg-lime-400', R3:'bg-lime-500', R2:'bg-green-400', R1:'bg-green-500', RR:'bg-emerald-600' };
  const pctLabels = { RM:'100%', R10:'92%', R9:'90%', R8:'88%', R7:'86%', R6:'84%', R5:'82%', R4:'78%', R3:'72%', R2:'62%', R1:'50%', RR:'42%' };
  const seriesRecovery = (() => {
    const rec = {};
    if (latestConconiTest?.conconi_test_series) {
      const series = [...latestConconiTest.conconi_test_series].sort((a, b) => a.series_number - b.series_number);
      sortedPaces.forEach((pace, i) => {
        if (pace.pace_code === 'RR') return;
        const idx = Math.round((i / (sortedPaces.length - 1)) * (series.length - 1));
        const s = series[Math.min(idx, series.length - 1)];
        if (s?.recovery_time_seconds) rec[pace.pace_code] = s.recovery_time_seconds;
      });
    }
    return rec;
  })();
  const conconiMaxHr = latestConconiTest?.max_hr_reached;
  const fmtPaceTest = (secs) => { const m=Math.floor(secs/60); const s=Math.round(secs%60); return `${m}'${String(s).padStart(2,'0')}"`; };
  const fmtRecTest  = (secs) => { if(!secs) return ''; const m=Math.floor(secs/60); const s=secs%60; return s>0?`${m}'${String(s).padStart(2,'0')}"` :`${m}'`; };
  const conconiR10 = sortedPaces.find(p => p.pace_code === 'R10');
  const conconiFirstRecov = Object.values(seriesRecovery)[0];
  const vamKmh = latestVam ? parseFloat(latestVam.vam_kmh) : null;
  const vamVo2max = vamKmh ? (vamKmh * 3.5).toFixed(1) : null;
  const vamMlssKmh = vamKmh ? (vamKmh * 0.88).toFixed(1) : null;
  const vamMlssPace = vamKmh ? Math.round(3600 / (vamKmh * 0.88)) : null;
  const vamVt2Kmh = vamKmh ? (vamKmh * 0.875).toFixed(1) : null;
  const vamVt2Pace = vamKmh ? Math.round(3600 / (vamKmh * 0.875)) : null;
  const fmtVamP = (secs) => { const m=Math.floor(secs/60); const s=Math.round(secs%60); return `${m}'${String(s).padStart(2,'0')}"`; };

  const { mapContainerRef } = useMapbox(selectedActivity?.polyline, selectedActivity?.loading);

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

  const openRpeModal = (e, session) => {
    e.stopPropagation();
    setRpeSession(session);
    setRpeValue(null);
  };

  const handleSaveRpe = async () => {
    if (!rpeValue || !rpeSession) return;
    setSavingRpe(true);
    const { error } = await saveRpeToSession(rpeSession.id, { rpe: rpeValue, notes: null });
    setSavingRpe(false);
    if (error) {
      showError('Error al guardar RPE');
      return;
    }
    showSuccess('RPE guardado');
    setRpeSession(null);
    setRpeValue(null);
    loadTrainings();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ath-text-primary tracking-tight">
            Mi Plan
          </h1>
          <p className="text-sm text-ath-text-muted mt-0.5">
            {activeTab === 'week' ? 'Plan semanal de entrenamiento' : 'Últimos 30 días · Strava'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPDF}
            disabled={!hasAnyTraining}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ath-text-secondary border border-ath-border rounded-xl hover:bg-ath-inset disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiDownload className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={onGenerate}
            disabled={generating || !rateLimit.canGenerate}
            className="flex items-center gap-1.5 px-3 py-2 bg-ath-accent hover:bg-ath-accent-hover disabled:bg-slate-300 dark:disabled:bg-slate-700 text-ath-on-accent text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
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
            className="flex items-center gap-3 p-4 bg-ath-accent-surface border border-ath-border-accent rounded-xl"
          >
            <FiLoader className="w-5 h-5 animate-spin text-ath-accent-text flex-shrink-0" />
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

      {/* ===== TESTS DE RENDIMIENTO ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ath-text-muted flex items-center gap-1.5">
            <FiZap className="w-3 h-3" /> Tests de Rendimiento
          </p>
          <button
            onClick={() => setShowVamModal(true)}
            className="text-xs font-medium text-ath-accent-text hover:underline flex items-center gap-1"
          >
            <FiPlus className="w-3 h-3" /> Añadir test VAM
          </button>
        </div>

        {/* Empty state */}
        {!latestVam && athletePaces.length === 0 && (
          <div className="bg-ath-surface rounded-2xl border border-ath-border p-6 text-center">
            <FiZap className="w-8 h-8 text-ath-text-muted mx-auto mb-2" />
            <p className="text-sm font-medium text-ath-text-primary mb-1">Sin tests de rendimiento</p>
            <p className="text-xs text-ath-text-muted mb-3">Registra tu primer test VAM para calcular tus zonas</p>
            <button
              onClick={() => setShowVamModal(true)}
              className="px-4 py-2 bg-ath-accent text-ath-on-accent rounded-xl text-sm font-medium hover:bg-ath-accent-hover transition-colors"
            >
              Registrar test VAM
            </button>
          </div>
        )}

          {/* CONCONI CARD */}
          {athletePaces.length > 0 && (
            <div className="bg-ath-surface rounded-2xl border border-ath-border overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiZap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-ath-text-primary">Test de Conconi</span>
                  {latestConconiTest && (
                    <span className="text-[10px] text-ath-text-muted">
                      FC Máx: <span className="font-semibold text-ath-text-secondary">{latestConconiTest.max_hr_reached} bpm</span>
                      {latestConconiTest.test_date && <> · {new Date(latestConconiTest.test_date).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}</>}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowConconiTable(v => !v)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                >
                  {showConconiTable ? 'Ocultar' : 'Ver todo'} <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${showConconiTable ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-3 divide-x divide-ath-border border-t border-ath-border">
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-ath-text-muted mb-1">FC Máxima</p>
                  <p className="text-2xl font-bold text-red-500 leading-none">{conconiMaxHr ?? '–'}</p>
                  <p className="text-[10px] text-ath-text-muted mt-0.5">bpm</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-ath-text-muted mb-1">Ritmo R10</p>
                  <p className="text-2xl font-bold text-orange-500 leading-none font-mono">{conconiR10 ? fmtPaceTest(conconiR10.pace_seconds_per_km) : '–'}</p>
                  <p className="text-[10px] text-ath-text-muted mt-0.5">min/km</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-ath-text-muted mb-1">Recup. 120p</p>
                  <p className="text-2xl font-bold text-blue-500 leading-none font-mono">{conconiFirstRecov ? fmtRecTest(conconiFirstRecov) : '–'}</p>
                  <p className="text-[10px] text-ath-text-muted mt-0.5">al 120 bpm</p>
                </div>
              </div>

              {showConconiTable && (
                <div className="border-t border-ath-border overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-3 text-slate-400 font-medium whitespace-nowrap sticky left-0 bg-ath-surface z-10 w-20">Zona</th>
                        {sortedPaces.map(pace => (
                          <th key={pace.pace_code} className={`px-1.5 py-1.5 text-center text-white font-bold whitespace-nowrap ${bgColors[pace.pace_code] || 'bg-gray-500'}`}>
                            {pace.pace_code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-ath-inset">
                        <td className="py-1 px-3 text-slate-400 text-[10px] sticky left-0 bg-ath-inset z-10">% FC</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1 text-center text-ath-text-muted whitespace-nowrap">{pctLabels[pace.pace_code] || ''}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-ath-border">
                        <td className="py-1.5 px-3 text-ath-text-secondary font-semibold sticky left-0 bg-ath-surface z-10">Ritmo</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono font-semibold text-ath-text-primary whitespace-nowrap">{fmtPaceTest(pace.pace_seconds_per_km)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-ath-border bg-ath-inset">
                        <td className="py-1.5 px-3 text-ath-text-secondary font-semibold sticky left-0 bg-ath-inset z-10">Pulso</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-ath-text-secondary whitespace-nowrap">
                            {pace.heart_rate_max || ''}
                          </td>
                        ))}
                      </tr>
                      {Object.keys(seriesRecovery).length > 0 && (
                        <tr className="border-t border-ath-border">
                          <td className="py-1.5 px-3 text-ath-text-secondary font-semibold whitespace-nowrap sticky left-0 bg-ath-surface z-10">Recu. 120p</td>
                          {sortedPaces.map(pace => (
                            <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-ath-text-secondary whitespace-nowrap">
                              {seriesRecovery[pace.pace_code] ? fmtRecTest(seriesRecovery[pace.pace_code]) : ''}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VAM CARD */}
          {latestVam && (
            <div className="bg-ath-surface rounded-2xl border border-ath-border overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-bold text-ath-text-primary">Test VAM</span>
                  <span className="text-[10px] text-ath-text-muted">
                    {new Date(latestVam.test_date).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}
                    {' · '}{latestVam.distance_meters}m{' · '}{Math.floor(latestVam.duration_seconds/60)}'{String(latestVam.duration_seconds%60).padStart(2,'0')}"
                  </span>
                </div>
                <button
                  onClick={() => setShowVamTable(v => !v)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                >
                  {showVamTable ? 'Ocultar' : 'Ver todo'} <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${showVamTable ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 border-t border-ath-border pt-3">
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">FC MÁX</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">{conconiMaxHr ?? '–'} <span className="text-sm font-normal">bpm</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">–</p>
                </div>
                <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1">VAM</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 leading-none">{vamKmh?.toFixed(1)} <span className="text-sm font-normal">km/h</span></p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{fmtVamP(latestVam.pace_seconds_per_km)} min/km</p>
                </div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-1">VO2 MÁX</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">{vamVo2max} <span className="text-sm font-normal">ml/kg</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">–</p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">MLSS</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">{vamMlssKmh} <span className="text-sm font-normal">km/h</span></p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{fmtVamP(vamMlssPace)} min/km</p>
                </div>
              </div>

              {vamVt2Kmh && (
                <div className="px-4 py-2 border-t border-ath-border flex items-center gap-1.5 text-xs text-ath-text-muted">
                  <FiActivity className="w-3.5 h-3.5 text-blue-400" />
                  VT2: {vamVt2Kmh} km/h · <span className="font-mono">{fmtVamP(vamVt2Pace)}</span> min/km
                </div>
              )}

              {showVamTable && (
                <div className="border-t border-ath-border overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[440px]">
                    <thead>
                      <tr>
                        {[
                          { label: 'FCmax', color: 'bg-red-500' },
                          { label: 'VAM', color: 'bg-orange-500' },
                          { label: 'VO2max', color: 'bg-blue-500' },
                          { label: 'MLSS', color: 'bg-green-500' },
                          { label: 'VT2', color: 'bg-yellow-500' },
                          { label: 'VT1', color: 'bg-lime-500' },
                        ].map(col => (
                          <th key={col.label} className={`px-2 py-1.5 text-center text-white font-bold whitespace-nowrap ${col.color}`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-ath-border">
                        {[conconiMaxHr??'-', vamKmh?.toFixed(1), vamVo2max, vamMlssKmh, vamVt2Kmh, vamKmh ? (vamKmh*0.775).toFixed(1) : '-'].map((val,i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono font-semibold text-ath-text-primary whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-ath-inset">
                        {[conconiMaxHr?'ppm':'','km/h','ml/kg/min','km/h','km/h','km/h'].map((u,i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-slate-400 whitespace-nowrap">{u}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-ath-border">
                        {['', fmtVamP(latestVam.pace_seconds_per_km), '', fmtVamP(vamMlssPace), fmtVamP(vamVt2Pace), vamKmh ? fmtVamP(Math.round(3600/(vamKmh*0.775))) : '-'].map((val,i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono text-ath-text-secondary whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-ath-inset">
                        {['','min/km','','min/km','min/km','min/km'].map((u,i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-slate-400 whitespace-nowrap">{u}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Tab toggle */}
      <div className="flex bg-ath-surface rounded-xl border border-ath-border p-1 gap-1">
        <button
          onClick={() => setActiveTab('week')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'week'
              ? 'bg-ath-accent text-ath-on-accent'
              : 'text-ath-text-muted hover:text-ath-text-secondary'
          }`}
        >
          Esta semana
        </button>
        <button
          onClick={() => setActiveTab('recents')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'recents'
              ? 'bg-ath-accent text-ath-on-accent'
              : 'text-ath-text-muted hover:text-ath-text-secondary'
          }`}
        >
          Recientes
        </button>
      </div>

      {/* ===== ESTA SEMANA TAB ===== */}
      {activeTab === 'week' && (
        <>
          {/* Week navigator */}
          <div className="flex items-center justify-between bg-ath-surface rounded-xl border border-ath-border px-4 py-3">
            <button
              onClick={goToPreviousWeek}
              className="p-1.5 hover:bg-ath-inset rounded-lg transition-colors"
            >
              <FiChevronLeft className="w-5 h-5 text-ath-text-muted" />
            </button>
            <span className="font-semibold text-sm text-ath-text-primary">
              {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {' – '}
              {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={goToNextWeek}
              className="p-1.5 hover:bg-ath-inset rounded-lg transition-colors"
            >
              <FiChevronRight className="w-5 h-5 text-ath-text-muted" />
            </button>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-8 h-8 animate-spin text-ath-accent" />
            </div>
          ) : !hasAnyTraining ? (
            /* Empty state for this week */
            <div className="bg-ath-surface rounded-2xl p-8 text-center border border-ath-border">
              <FiCalendar className="w-12 h-12 text-ath-text-muted mx-auto mb-3" />
              <h3 className="text-base font-semibold text-ath-text-primary mb-1">
                No hay entrenamientos esta semana
              </h3>
              <p className="text-sm text-ath-text-muted">
                No tienes sesiones planificadas para esta semana. ¡Regenera tu plan!
              </p>
            </div>
          ) : (
            <>
              {/* ===== MOBILE: Session list (< lg) ===== */}
              <div className="lg:hidden bg-ath-surface rounded-2xl border border-ath-border overflow-hidden">
                <div className="divide-y divide-ath-border">
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
                            isToday ? 'text-blue-600 dark:text-blue-400' : 'text-ath-text-muted'
                          }`}>
                            {DAYS_OF_WEEK[index].slice(0, 3)}
                          </span>
                          <span className={`text-xl font-bold leading-tight ${
                            isCompleted ? 'text-green-600 dark:text-green-400'
                              : isToday ? 'text-blue-600 dark:text-blue-400'
                              : 'text-ath-text-primary'
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
                                  isRest ? 'text-ath-text-muted' : 'text-ath-text-primary'
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
                                    <span className="text-[11px] text-ath-text-muted">{training.totalDistance}</span>
                                  )}
                                  {training.duration && !training.totalDistance && (
                                    <span className="text-[11px] text-ath-text-muted">{training.duration} min</span>
                                  )}
                                </div>
                              )}
                              {isRest && (
                                <span className="text-[11px] text-ath-text-muted">Descanso</span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-ath-text-muted">Sin entrenamiento</span>
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
                          {isCompleted && !training.rpe && !training.rpeScore && (
                            <button
                              type="button"
                              onClick={(e) => openRpeModal(e, training)}
                              aria-label="Añadir RPE"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[11px] font-semibold border border-orange-200 dark:border-orange-800/40 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                            >
                              RPE
                            </button>
                          )}
                          {canComplete && (
                            <button
                              type="button"
                              onClick={(e) => openCompletionModal(e, training)}
                              aria-label="Marcar sesión como completada"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-ath-accent-surface text-ath-accent-text text-[11px] font-semibold border border-ath-border-accent hover:bg-ath-accent-surface/80 transition-colors"
                            >
                              <FiCheck className="w-3 h-3" />
                              Completar
                            </button>
                          )}
                          {hasTraining && !isCompleted && !isSkipped && !canComplete && (
                            <FiChevronRight className="w-4 h-4 text-ath-text-muted" />
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
                        bg-ath-surface rounded-xl p-4 shadow-sm border-2 relative flex flex-col
                        ${isCompleted
                          ? 'border-ath-border-accent'
                          : isSkipped
                            ? 'border-gray-400 dark:border-gray-500'
                            : isToday
                              ? 'border-blue-500 dark:border-blue-400'
                              : 'border-ath-border'}
                        ${isRest ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                        min-h-[300px]
                      `}
                    >
                      {/* Day Header */}
                      <div className="mb-4 pb-3 border-b border-ath-border">
                        <p className="text-xs font-semibold text-ath-text-muted uppercase mb-1">
                          {DAYS_OF_WEEK[index]}
                        </p>
                        <p className="text-lg font-bold text-ath-text-primary">
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
                            isRest ? 'text-ath-text-muted' : 'text-ath-text-primary'
                          }`}>
                            {training.title}
                          </h3>

                          {!isRest && (
                            <>
                              {training.totalDistance && (
                                <div className="flex items-start space-x-2">
                                  <FiMapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-ath-text-secondary">{training.totalDistance}</p>
                                </div>
                              )}
                              {training.duration && (
                                <div className="flex items-start space-x-2">
                                  <FiClock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-ath-text-secondary">{training.duration} min</p>
                                </div>
                              )}
                              {training.exercises?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-ath-border">
                                  <p className="text-xs text-ath-text-muted mb-1">Ejercicios:</p>
                                  <ul className="space-y-1">
                                    {training.exercises.slice(0, 3).map((ex, i) => (
                                      <li key={i} className="text-xs text-ath-text-secondary truncate">
                                        • {ex.name}
                                        {ex.sets && <span className="text-gray-500"> ({ex.sets}x{ex.reps || ''})</span>}
                                      </li>
                                    ))}
                                    {training.exercises.length > 3 && (
                                      <li className="text-xs text-ath-text-muted">
                                        +{training.exercises.length - 3} más
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                              {training.description && !training.exercises?.length && (
                                <p className="text-xs text-ath-text-muted line-clamp-3">{training.description}</p>
                              )}
                              <div className="mt-auto pt-2 text-center space-y-1.5">
                                {canComplete && (
                                  <button
                                    type="button"
                                    onClick={(e) => openCompletionModal(e, training)}
                                    aria-label="Marcar sesión como completada"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ath-accent hover:bg-ath-accent-hover text-ath-on-accent text-xs font-semibold transition-colors"
                                  >
                                    <FiCheck className="w-3.5 h-3.5" />
                                    Marcar completado
                                  </button>
                                )}
                                {isCompleted && training.actualDistanceKm && (
                                  <div className="flex items-center justify-center gap-3 text-xs text-ath-text-muted">
                                    <span className="font-semibold text-ath-accent-text">{training.actualDistanceKm} km</span>
                                    {(training.rpe || training.rpeScore) && <span>RPE {training.rpe || training.rpeScore}/10</span>}
                                  </div>
                                )}
                                {isCompleted && !training.rpe && !training.rpeScore && (
                                  <button
                                    type="button"
                                    onClick={(e) => openRpeModal(e, training)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-semibold border border-orange-200 dark:border-orange-800/40 hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors"
                                  >
                                    Añadir RPE
                                  </button>
                                )}
                                {!canComplete && !isCompleted && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedSession(training); }}
                                    className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                  >
                                    Ver detalles →
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {isRest && (
                            <div className="text-center py-6">
                              <span className="text-4xl">💤</span>
                              <p className="text-sm text-ath-text-muted mt-2">Día de recuperación</p>
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
            <div className="bg-ath-surface rounded-2xl p-8 text-center border border-ath-border">
              <SiStrava className="w-10 h-10 text-[#FC4C02] mx-auto mb-3" />
              <p className="text-sm font-semibold text-ath-text-secondary mb-1">Conecta Strava</p>
              <p className="text-xs text-ath-text-muted">Ve a Dispositivos para conectar tu cuenta de Strava</p>
            </div>
          ) : loadingStrava ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-6 h-6 animate-spin text-[#FC4C02]" />
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="bg-ath-surface rounded-2xl p-8 text-center border border-ath-border">
              <FiActivity className="w-10 h-10 text-ath-text-muted mx-auto mb-2" />
              <p className="text-sm text-ath-text-muted">No hay actividades en los últimos 30 días</p>
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
                    className="bg-ath-surface rounded-2xl border border-ath-border overflow-hidden cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-ath-text-primary text-base leading-tight truncate">
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
                        <span className="text-xs text-ath-text-muted">
                          {new Date(activity.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 divide-x divide-ath-border border-t border-ath-border">
                      {[
                        { val: activity.distanceKm, unit: 'km', color: 'text-ath-text-primary' },
                        { val: activity.formattedTime, unit: 'tiempo', color: 'text-ath-text-primary' },
                        { val: activity.pace || '–', unit: 'ritmo', color: 'text-ath-accent-text' },
                        { val: activity.total_elevation_gain ?? 0, unit: 'm+', color: 'text-ath-text-primary' },
                      ].map(({ val, unit, color }, i) => (
                        <div key={i} className="py-2.5 text-center">
                          <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
                          <p className="text-[10px] text-ath-text-muted">{unit}</p>
                        </div>
                      ))}
                    </div>

                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-ath-border">
                      <div className="flex items-center gap-3 text-xs text-ath-text-muted">
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
                        <span className="text-xs font-medium text-ath-text-muted">Ver detalle &rsaquo;</span>
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
              className="bg-ath-surface rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className={`p-6 border-b border-ath-border ${
                selectedActivity.type === 'Run' || selectedActivity.type === 'VirtualRun'
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : selectedActivity.type === 'WeightTraining' || selectedActivity.type === 'Workout'
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : selectedActivity.type === 'Yoga' || selectedActivity.type === 'Pilates'
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : selectedActivity.type === 'Ride' || selectedActivity.type === 'VirtualRide'
                        ? 'bg-orange-50 dark:bg-orange-900/20'
                        : 'bg-ath-inset'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-ath-text-primary">{selectedActivity.name}</h2>
                    <p className="text-ath-text-muted text-sm mt-1">
                      {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })} · {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-ath-inset rounded-lg transition-colors">
                    <FiX className="w-6 h-6 text-ath-text-muted" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hover">
                {selectedActivity.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="ml-3 text-ath-text-muted">Cargando detalles...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Main Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedActivity.distanceKm}</p>
                        <p className="text-xs text-blue-500">km</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{selectedActivity.formattedTime}</p>
                        <p className="text-xs text-purple-500">tiempo</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedActivity.pace}</p>
                        <p className="text-xs text-green-500">ritmo medio</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedActivity.average_heartrate || '-'}</p>
                        <p className="text-xs text-red-500">bpm medio</p>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.total_elevation_gain || 0}m</p>
                        <p className="text-xs text-ath-text-muted">desnivel+</p>
                      </div>
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.max_heartrate || '-'}</p>
                        <p className="text-xs text-ath-text-muted">FC max</p>
                      </div>
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.calories || '-'}</p>
                        <p className="text-xs text-ath-text-muted">kcal</p>
                      </div>
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.suffer_score || '-'}</p>
                        <p className="text-xs text-ath-text-muted">esfuerzo</p>
                      </div>
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.kudos_count || 0}</p>
                        <p className="text-xs text-ath-text-muted">kudos</p>
                      </div>
                      <div className="bg-ath-inset rounded-lg p-3 text-center">
                        <p className="font-semibold text-ath-text-primary">{selectedActivity.achievement_count || 0}</p>
                        <p className="text-xs text-ath-text-muted">logros</p>
                      </div>
                    </div>

                    {/* Map */}
                    {selectedActivity.polyline && (
                      <div className="bg-ath-inset rounded-xl p-4">
                        <h3 className="font-semibold text-ath-text-primary mb-3 flex items-center">
                          <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />Recorrido
                        </h3>
                        <div ref={mapContainerRef} className="h-64 rounded-lg overflow-hidden" style={{ minHeight: '256px' }} />
                      </div>
                    )}

                    {/* Laps */}
                    {selectedActivity.laps && selectedActivity.laps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-ath-text-primary mb-3 flex items-center">
                          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />Vueltas ({selectedActivity.laps.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-ath-inset">
                                <th className="px-3 py-2 text-left text-ath-text-secondary">#</th>
                                <th className="px-3 py-2 text-right text-ath-text-secondary">Distancia</th>
                                <th className="px-3 py-2 text-right text-ath-text-secondary">Tiempo</th>
                                <th className="px-3 py-2 text-right text-ath-text-secondary">Ritmo</th>
                                <th className="px-3 py-2 text-right text-ath-text-secondary">FC</th>
                                <th className="px-3 py-2 text-right text-ath-text-secondary">Cadencia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ath-border">
                              {selectedActivity.laps.map((lap, index) => (
                                <tr key={lap.id || index} className="hover:bg-ath-inset">
                                  <td className="px-3 py-2 font-medium text-ath-text-primary">{lap.name || `Vuelta ${index + 1}`}</td>
                                  <td className="px-3 py-2 text-right text-ath-text-secondary">{(lap.distance / 1000).toFixed(2)} km</td>
                                  <td className="px-3 py-2 text-right text-ath-text-secondary">{formatDuration(lap.moving_time)}</td>
                                  <td className="px-3 py-2 text-right font-mono text-ath-text-primary">{calculatePace(lap.moving_time, lap.distance)}</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}</td>
                                  <td className="px-3 py-2 text-right text-ath-text-secondary">{lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Splits per KM */}
                    {selectedActivity.splits_metric && selectedActivity.splits_metric.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-ath-text-primary mb-3 flex items-center">
                          <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />Parciales por Kilómetro
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {selectedActivity.splits_metric.map((split, index) => {
                            const pace = calculatePace(split.moving_time, split.distance);
                            const isGoodPace = split.average_heartrate && split.average_heartrate < (selectedActivity.average_heartrate || 150);
                            return (
                              <div key={index} className={`p-2 rounded-lg text-center ${isGoodPace ? 'bg-green-50 dark:bg-green-900/20' : 'bg-ath-inset'}`}>
                                <p className="text-xs text-ath-text-muted mb-1">km {index + 1}</p>
                                <p className="font-mono text-sm font-bold text-ath-text-primary">{pace}</p>
                                {split.average_heartrate && <p className="text-xs text-red-500 mt-1">{Math.round(split.average_heartrate)}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Segments */}
                    {selectedActivity.segment_efforts && selectedActivity.segment_efforts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-ath-text-primary mb-2 flex items-center gap-2 text-sm">
                          <span className="text-slate-500">≡</span> Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => {
                            const distKm = ((effort.segment?.distance || effort.distance || 0) / 1000).toFixed(3);
                            return (
                              <div key={effort.id} className="flex items-center gap-3 px-3 py-2.5 bg-ath-inset rounded-xl hover:bg-ath-inset transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                  <FiFlag className="w-3.5 h-3.5 text-[#FC4C02]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ath-text-primary truncate">{effort.segment?.name || effort.name}</p>
                                  <p className="text-xs text-ath-text-muted">{distKm} km</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-mono font-semibold text-[#FC4C02]">{formatDuration(effort.moving_time || effort.elapsed_time)}</p>
                                  {effort.pr_rank === 1 && (
                                    <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold">PR</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Strava Link */}
                    <a
                      href={`https://www.strava.com/activities/${selectedActivity.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl transition-colors font-medium text-sm"
                    >
                      <span>Ver en Strava</span>
                      <FiExternalLink className="w-4 h-4" />
                    </a>
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

      {/* RPE quick modal — portal to body */}
      {rpeSession && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRpeSession(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-ath-surface rounded-2xl shadow-xl w-full max-w-sm p-5"
          >
            <h3 className="text-base font-bold text-ath-text-primary mb-1">
              Añadir RPE
            </h3>
            <p className="text-sm text-ath-text-muted mb-4">
              {rpeSession.title} — ¿Cómo te sentiste?
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRpeValue(v)}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                    rpeValue === v
                      ? 'bg-orange-500 text-white scale-110 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {rpeValue && (
              <p className="text-center text-sm text-ath-text-muted mb-3">
                RPE seleccionado: <span className="font-bold text-orange-500">{rpeValue}/10</span>
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRpeSession(null)}
                className="flex-1 px-3 py-2 text-sm font-medium text-ath-text-secondary border border-ath-border rounded-xl hover:bg-ath-inset transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRpe}
                disabled={!rpeValue || savingRpe}
                className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {savingRpe ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </motion.div>
        </motion.div>,
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
              className="bg-ath-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-ath-text-primary">
                      {selectedSession.title || 'Entrenamiento'}
                    </h3>
                    <p className="text-sm text-ath-text-muted mt-0.5">
                      {selectedSession.date ? new Date(selectedSession.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="p-1 text-ath-text-muted hover:text-ath-text-secondary"
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
                  <p className="text-sm text-ath-text-secondary mb-4 whitespace-pre-line">
                    {selectedSession.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {selectedSession.totalDistance && (
                    <div className="bg-ath-inset rounded-xl p-3">
                      <p className="text-xs text-ath-text-muted">Distancia</p>
                      <p className="text-base font-bold text-ath-text-primary">{selectedSession.totalDistance}</p>
                    </div>
                  )}
                  {selectedSession.duration && (
                    <div className="bg-ath-inset rounded-xl p-3">
                      <p className="text-xs text-ath-text-muted">Duración</p>
                      <p className="text-base font-bold text-ath-text-primary">{selectedSession.duration} min</p>
                    </div>
                  )}
                </div>

                {selectedSession.exercises?.length > 0 && (
                  <div className="border-t border-ath-border pt-4">
                    <h4 className="text-sm font-semibold text-ath-text-primary mb-2">Ejercicios</h4>
                    <ul className="space-y-2">
                      {selectedSession.exercises.map((ex, i) => (
                        <li key={i} className="text-sm text-ath-text-secondary flex items-start gap-2">
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
                  <div className="border-t border-ath-border pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-ath-text-primary mb-1">Notas</h4>
                    <p className="text-sm text-ath-text-secondary">{selectedSession.notesCoach}</p>
                  </div>
                )}

                {selectedSession.status === 'completed' && (
                  <div className="border-t border-ath-border pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-ath-accent-text mb-2">Resultado</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedSession.actualDistanceKm && (
                        <div className="bg-ath-accent-surface rounded-xl p-3">
                          <p className="text-xs text-ath-accent-text">Distancia real</p>
                          <p className="text-base font-bold text-ath-accent-text">{selectedSession.actualDistanceKm} km</p>
                        </div>
                      )}
                      {selectedSession.rpe && (
                        <div className="bg-ath-accent-surface rounded-xl p-3">
                          <p className="text-xs text-ath-accent-text">RPE</p>
                          <p className="text-base font-bold text-ath-accent-text">{selectedSession.rpe}/10</p>
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

      {showVamModal && (
        <VAMTestModal
          isOpen={showVamModal}
          onClose={() => setShowVamModal(false)}
          athlete={{ id: profile?.id }}
          coachId={null}
          onSuccess={() => {
            setShowVamModal(false);
            refreshTestData();
          }}
        />
      )}
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
        <FiLoader className="w-8 h-8 animate-spin text-ath-accent" />
      </div>
    );
  }

  // ── Onboarding gate: show wizard if no profile ──
  if (hasProfile === false) {
    return (
      <div className="px-4 lg:px-8 py-5 lg:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ath-text-primary">Mi Plan</h1>
          <p className="text-ath-text-muted mt-1">
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
          <h1 className="text-2xl font-bold text-ath-text-primary">Mi Plan</h1>
          <p className="text-ath-text-muted mt-1">
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
              className="flex items-center gap-3 p-4 bg-ath-accent-surface border border-ath-border-accent rounded-xl"
            >
              <FiLoader className="w-5 h-5 animate-spin text-ath-accent-text flex-shrink-0" />
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
    <div className="bg-ath-base min-h-screen">
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
