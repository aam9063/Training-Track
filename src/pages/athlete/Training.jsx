import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiCalendar,
  FiLoader,
  FiX,
  FiClock,
  FiTarget,
  FiActivity,
  FiHeart,
  FiMapPin,
  FiTrendingUp,
  FiFlag,
  FiExternalLink,
  FiZap,
  FiCheck,
  FiCheckCircle,
  FiSkipForward,
  FiRotateCcw,
  FiChevronDown,
  FiFileText,
} from 'react-icons/fi';
import { listGymFilesForAthlete } from '../../services/gymFilesService';
import { SiStrava } from 'react-icons/si';
import { generateWeeklyPDF } from '../../lib/pdfExport';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWeeklyTraining,
  DAYS_OF_WEEK,
  completeSession,
  skipSession,
  revertSession,
  updateTrainingSession,
} from '../../services/weeklyTrainingService';
import useWeeklyTrainings from '../../hooks/useWeeklyTrainings';
import {
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
  formatStravaActivity,
} from '../../services/stravaService';
import { getCachedActivityByStravaId } from '../../services/stravaCacheService';
import { getRPEEmoji, RPE_OPTIONS } from '../../services/rpeService';
import { showSuccess, showError } from '../../lib/toast';
import { inferTrainingType } from '../../lib/dateUtils';
import RPEModal from '../../components/athlete/RPEModal';
import useMapbox from '../../hooks/useMapbox';
import useAthleteTestData from '../../hooks/useAthleteTestData';
import useStravaActivities from '../../hooks/useStravaActivities';

const Training = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    currentWeek, trainings, loading,
    loadTrainings, goToPreviousWeek, goToNextWeek, getWeekDays,
  } = useWeeklyTrainings({
    fetchFn: (weekStart) => getWeeklyTraining(profile?.id, weekStart),
    deps: [profile?.id],
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  const { athletePaces, latestVam, latestConconiTest, personalBests } = useAthleteTestData(profile?.id);

  const {
    stravaConnected, stravaActivities, loadingStrava,
    selectedActivity, setSelectedActivity, visibleActivities,
    activitiesRPE, editRpeActivity, setEditRpeActivity,
    loadActivityDetail, handleEditRPESave, showMoreActivities,
  } = useStravaActivities(profile?.id);

  // Gym files count (just for the badge on the entry card)
  const [gymFilesCount, setGymFilesCount] = useState(0);

  useEffect(() => {
    const coachId = profile?.athlete?.coach_athlete_relationship?.[0]?.coach_id;
    if (!coachId) return;
    listGymFilesForAthlete(coachId).then(({ data }) => {
      setGymFilesCount(data?.length ?? 0);
    });
  }, [profile?.athlete]);

  // Strava-linked activities for auto-completed sessions
  const [linkedActivities, setLinkedActivities] = useState({});
  const [showStravaRpeFlow, setShowStravaRpeFlow] = useState(false);

  // Fetch linked Strava activities for sessions that have strava_activity_id
  useEffect(() => {
    if (!profile?.id) return;
    const entries = Object.entries(trainings);
    const stravaLinked = entries.filter(([, t]) => t.stravaActivityId);
    if (stravaLinked.length === 0) {
      setLinkedActivities({});
      return;
    }
    (async () => {
      const result = {};
      await Promise.all(
        stravaLinked.map(async ([dayIdx, t]) => {
          try {
            const activity = await getCachedActivityByStravaId(profile.id, t.stravaActivityId);
            if (activity) {
              result[dayIdx] = formatStravaActivity(activity);
            }
          } catch (err) {
            console.error('Error fetching linked activity:', err);
          }
        })
      );
      setLinkedActivities(result);
    })();
  }, [profile?.id, trainings]);

  // Completion flow state
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [rpeScore, setRpeScore] = useState(null);
  const [rpeNotes, setRpeNotes] = useState('');
  const [athleteNotes, setAthleteNotes] = useState('');
  const [actualDuration, setActualDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const { mapContainerRef } = useMapbox(selectedActivity?.polyline, selectedActivity?.loading);

  const weekDays = getWeekDays(currentWeek);

  const openDayDetail = (training, dayIndex) => {
    if (training) {
      setSelectedDay(training);
      setSelectedDayIndex(dayIndex);
      setShowCompletionFlow(false);
      setShowStravaRpeFlow(false);
      setRpeScore(training.rpeScore || null);
      setRpeNotes(training.rpeNotes || '');
      setAthleteNotes(training.notesAthlete || '');
      setActualDuration(training.actualDuration ? String(training.actualDuration) : '');
    }
  };

  const closeDayDetail = () => {
    setSelectedDay(null);
    setSelectedDayIndex(null);
    setShowCompletionFlow(false);
    setShowStravaRpeFlow(false);
    setSaving(false);
  };

  const isPastOrToday = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d <= today;
  };

  const handleCompleteSession = async () => {
    if (!selectedDay?.id) return;
    setSaving(true);
    try {
      const { error } = await completeSession(selectedDay.id, {
        rpeScore: rpeScore || null,
        rpeNotes: rpeNotes || null,
        notesAthlete: athleteNotes || null,
        actualDurationMinutes: actualDuration ? parseInt(actualDuration) : null,
      });
      if (error) throw error;
      showSuccess('Sesión completada correctamente');
      closeDayDetail();
      loadTrainings();
    } catch (error) {
      console.error('Error completing session:', error);
      showError('Error al completar la sesión');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipSession = async () => {
    if (!selectedDay?.id) return;
    setSaving(true);
    try {
      const { error } = await skipSession(selectedDay.id, athleteNotes || null);
      if (error) throw error;
      showSuccess('Sesión marcada como omitida');
      closeDayDetail();
      loadTrainings();
    } catch (error) {
      console.error('Error skipping session:', error);
      showError('Error al omitir la sesión');
    } finally {
      setSaving(false);
    }
  };

  const handleRevertSession = async () => {
    if (!selectedDay?.id) return;
    setSaving(true);
    try {
      const { error } = await revertSession(selectedDay.id);
      if (error) throw error;
      showSuccess('Sesión revertida a planificada');
      closeDayDetail();
      loadTrainings();
    } catch (error) {
      console.error('Error reverting session:', error);
      showError('Error al revertir la sesión');
    } finally {
      setSaving(false);
    }
  };

  const handleStravaRpeSave = async () => {
    if (!selectedDay?.id) return;
    setSaving(true);
    try {
      const { error } = await updateTrainingSession(selectedDay.id, {
        rpe_score: rpeScore || null,
        rpe_notes: rpeNotes || null,
        notes_athlete: athleteNotes || null,
      });
      if (error) throw error;
      showSuccess('RPE guardado correctamente');
      setShowStravaRpeFlow(false);
      closeDayDetail();
      loadTrainings();
    } catch (error) {
      console.error('Error saving RPE:', error);
      showError('Error al guardar el RPE');
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    generateWeeklyPDF({
      athleteName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim().toUpperCase(),
      personalBests,
      athletePaces,
      latestVam,
      latestConconiTest,
      trainings,
      weekDays,
    });
  };

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

  const getPaceLabel = (paceCode) => {
    const paces = {
      R1: 'R1 - Regenerativo',
      R2: 'R2 - Aeróbico 1',
      R3: 'R3 - Aeróbico 2',
      R4: 'R4 - Aeróbico 3',
      R5: 'R5 - Umbral',
      R6: 'R6 - VO2 Bajo',
      R7: 'R7 - VO2 Alto',
      R8: 'R8 - Anaeróbico',
      R9: 'R9 - Velocidad',
      R10: 'R10 - Sprint',
    };
    return paces[paceCode] || paceCode;
  };

  const formatDistance = (meters) => {
    if (!meters) return null;
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  };

  const formatRest = (seconds) => {
    if (!seconds) return null;
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}' ${secs}"` : `${mins} min`;
    }
    return `${seconds} seg`;
  };

  const hasAnyTraining = Object.keys(trainings).length > 0;

  const [activeTab, setActiveTab] = useState('week'); // 'week' | 'recents'
  const [showConconiTable, setShowConconiTable] = useState(false);
  const [showVamTable, setShowVamTable] = useState(false);

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

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Mis Entrenamientos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTab === 'week' ? 'Plan semanal de entrenamiento' : 'Últimos 30 días · Strava'}
          </p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={!hasAnyTraining}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FiDownload className="w-4 h-4" />
          <span>PDF</span>
        </button>
      </div>

      {/* ===== MATERIAL DE FUERZA ===== */}
      {gymFilesCount > 0 && (
        <button
          onClick={() => navigate('/athlete/gym-files')}
          className="w-full flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
        >
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-red-400 to-orange-500 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[9px] font-black text-white tracking-wider leading-none">PDF</span>
            <FiFileText className="w-3 h-3 text-white/80 mt-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Material de Fuerza</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {gymFilesCount} {gymFilesCount === 1 ? 'documento disponible' : 'documentos disponibles'}
            </p>
          </div>
          <FiChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
        </button>
      )}

      {/* ===== TESTS DE RENDIMIENTO ===== */}
      {(athletePaces.length > 0 || latestVam) && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <FiZap className="w-3 h-3" /> Tests de Rendimiento
          </p>

          {/* CONCONI CARD */}
          {athletePaces.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiZap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Test de Conconi</span>
                  {latestConconiTest && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      FC Máx: <span className="font-semibold text-slate-600 dark:text-slate-300">{latestConconiTest.max_hr_reached} bpm</span>
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

              <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">FC Máxima</p>
                  <p className="text-2xl font-bold text-red-500 leading-none">{conconiMaxHr ?? '–'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">bpm</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Ritmo R10</p>
                  <p className="text-2xl font-bold text-orange-500 leading-none font-mono">{conconiR10 ? fmtPaceTest(conconiR10.pace_seconds_per_km) : '–'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">min/km</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Recup. 120p</p>
                  <p className="text-2xl font-bold text-blue-500 leading-none font-mono">{conconiFirstRecov ? fmtRecTest(conconiFirstRecov) : '–'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">al 120 bpm</p>
                </div>
              </div>

              {showConconiTable && (
                <div className="border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-3 text-slate-400 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 w-20">Zona</th>
                        {sortedPaces.map(pace => (
                          <th key={pace.pace_code} className={`px-1.5 py-1.5 text-center text-white font-bold whitespace-nowrap ${bgColors[pace.pace_code] || 'bg-gray-500'}`}>
                            {pace.pace_code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1 px-3 text-slate-400 text-[10px] sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10">% FC</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{pctLabels[pace.pace_code] || ''}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold sticky left-0 bg-white dark:bg-gray-800 z-10">Ritmo</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmtPaceTest(pace.pace_seconds_per_km)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10">Pulso</td>
                        {sortedPaces.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {pace.heart_rate_max || ''}
                          </td>
                        ))}
                      </tr>
                      {Object.keys(seriesRecovery).length > 0 && (
                        <tr className="border-t border-gray-100 dark:border-gray-700">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">Recu. 120p</td>
                          {sortedPaces.map(pace => (
                            <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Test VAM</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
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

              <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
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
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <FiActivity className="w-3.5 h-3.5 text-blue-400" />
                  VT2: {vamVt2Kmh} km/h · <span className="font-mono">{fmtVamP(vamVt2Pace)}</span> min/km
                </div>
              )}

              {showVamTable && (
                <div className="border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
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
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        {[conconiMaxHr??'-', vamKmh?.toFixed(1), vamVo2max, vamMlssKmh, vamVt2Kmh, vamKmh ? (vamKmh*0.775).toFixed(1) : '-'].map((val,i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        {[conconiMaxHr?'ppm':'','km/h','ml/kg/min','km/h','km/h','km/h'].map((u,i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-slate-400 whitespace-nowrap">{u}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        {['', fmtVamP(latestVam.pace_seconds_per_km), '', fmtVamP(vamMlssPace), fmtVamP(vamVt2Pace), vamKmh ? fmtVamP(Math.round(3600/(vamKmh*0.775))) : '-'].map((val,i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
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

      {/* Week Navigator — only on "Esta semana" tab */}
      {activeTab === 'week' && (
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
      )}

      {/* ===== ESTA SEMANA TAB ===== */}
      {activeTab === 'week' && (
      <>
      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : !hasAnyTraining ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
          <FiCalendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            No hay entrenamientos esta semana
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tu entrenador aún no ha creado un plan para esta semana.
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
                  <motion.button
                    key={index}
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => openDayDetail(training, index)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      isToday
                        ? 'bg-blue-50/60 dark:bg-blue-900/10'
                        : hasTraining ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : ''
                    }`}
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
                      {/* Status dot bar */}
                      <div className={`w-1 h-8 rounded-full ml-1 ${
                        isCompleted ? 'bg-green-500'
                          : isSkipped ? 'bg-gray-300 dark:bg-gray-600'
                          : isRest ? 'bg-gray-200 dark:bg-gray-700'
                          : hasTraining ? 'bg-blue-400'
                          : 'bg-transparent'
                      }`} />
                      {isCompleted && <FiCheckCircle className="w-4 h-4 text-green-500" />}
                      {isSkipped && <FiSkipForward className="w-4 h-4 text-gray-400" />}
                      {canComplete && <FiCheck className="w-4 h-4 text-green-500" />}
                      {hasTraining && !isCompleted && !isSkipped && !canComplete && (
                        <FiChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>
                  </motion.button>
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
                  onClick={() => openDayDetail(training, index)}
                  className={`
                    bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2 relative
                    ${isCompleted
                      ? 'border-green-500 dark:border-green-400'
                      : isSkipped
                        ? 'border-gray-400 dark:border-gray-500'
                        : isToday
                          ? 'border-blue-500 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700'}
                    ${isRest ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                    ${hasTraining ? 'cursor-pointer hover:shadow-md transition-all' : ''}
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
                    <div className="space-y-3">
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
                              <span className="text-sm">📏</span>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{training.totalDistance}</p>
                            </div>
                          )}
                          {training.duration && (
                            <div className="flex items-start space-x-2">
                              <span className="text-sm">⏰</span>
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
                          <div className="mt-2 pt-2 text-center">
                            {canComplete ? (
                              <span className="inline-flex items-center space-x-1 text-xs font-medium text-green-600 dark:text-green-400">
                                <FiCheck className="w-3.5 h-3.5" />
                                <span>Completar sesión</span>
                              </span>
                            ) : (
                              <span className="text-xs text-blue-500 dark:text-blue-400">
                                {isCompleted ? 'Ver resultado →' : 'Ver detalles →'}
                              </span>
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
      )}{/* end Esta semana tab */}

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
                    {/* Card header */}
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

                    {/* Stats row */}
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

                    {/* Footer: kcal + kudos + RPE + Ver detalle */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
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
      )}{/* end Recientes tab */}

      {/* Strava Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className={`p-6 border-b border-gray-200 dark:border-gray-700 ${
                selectedActivity.type === 'Run' || selectedActivity.type === 'VirtualRun'
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : selectedActivity.type === 'WeightTraining' || selectedActivity.type === 'Workout'
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : selectedActivity.type === 'Yoga' || selectedActivity.type === 'Pilates'
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : selectedActivity.type === 'Ride' || selectedActivity.type === 'VirtualRide'
                        ? 'bg-orange-50 dark:bg-orange-900/20'
                        : 'bg-slate-50 dark:bg-gray-800'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedActivity.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })} · {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/60 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <FiX className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hover">
                {selectedActivity.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiLoader className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="ml-3 text-gray-500">Cargando detalles...</span>
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
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.total_elevation_gain || 0}m</p>
                        <p className="text-xs text-gray-500">desnivel+</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.max_heartrate || '-'}</p>
                        <p className="text-xs text-gray-500">FC max</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.calories || '-'}</p>
                        <p className="text-xs text-gray-500">kcal</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.suffer_score || '-'}</p>
                        <p className="text-xs text-gray-500">esfuerzo</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.kudos_count || 0}</p>
                        <p className="text-xs text-gray-500">kudos</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedActivity.achievement_count || 0}</p>
                        <p className="text-xs text-gray-500">logros</p>
                      </div>
                    </div>

                    {/* Map */}
                    {selectedActivity.polyline && (
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />Recorrido
                        </h3>
                        <div ref={mapContainerRef} className="h-64 rounded-lg overflow-hidden" style={{ minHeight: '256px' }} />
                      </div>
                    )}

                    {/* Laps */}
                    {selectedActivity.laps && selectedActivity.laps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />Vueltas ({selectedActivity.laps.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-700">
                                <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400">#</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Distancia</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Tiempo</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Ritmo</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">FC</th>
                                <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">Cadencia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {selectedActivity.laps.map((lap, index) => (
                                <tr key={lap.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{lap.name || `Vuelta ${index + 1}`}</td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{(lap.distance / 1000).toFixed(2)} km</td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatDuration(lap.moving_time)}</td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{calculatePace(lap.moving_time, lap.distance)}</td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}</td>
                                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}</td>
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
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />Parciales por Kilómetro
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {selectedActivity.splits_metric.map((split, index) => {
                            const pace = calculatePace(split.moving_time, split.distance);
                            const isGoodPace = split.average_heartrate && split.average_heartrate < (selectedActivity.average_heartrate || 150);
                            return (
                              <div key={index} className={`p-2 rounded-lg text-center ${isGoodPace ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                                <p className="text-xs text-gray-500 mb-1">km {index + 1}</p>
                                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{pace}</p>
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
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2 text-sm">
                          <span className="text-slate-500">≡</span> Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => {
                            const distKm = ((effort.segment?.distance || effort.distance || 0) / 1000).toFixed(3);
                            return (
                              <div key={effort.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                  <FiFlag className="w-3.5 h-3.5 text-[#FC4C02]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{effort.segment?.name || effort.name}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{distKm} km</p>
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

      {/* Training Detail Modal */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {selectedDayIndex !== null && DAYS_OF_WEEK[selectedDayIndex]} -{' '}
                      {selectedDay.date && new Date(selectedDay.date).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedDay.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-block text-xs px-3 py-1 rounded-full ${getTypeColor(selectedDay)}`}>
                        {getTypeLabel(selectedDay)}
                      </span>
                      {selectedDay.status === 'completed' && (
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Completado
                        </span>
                      )}
                      {selectedDay.status === 'skipped' && (
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          Omitido
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={closeDayDetail}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedDay.type === 'rest' ? (
                  <div className="text-center py-12">
                    <span className="text-6xl mb-4 block">💤</span>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Día de Descanso
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Aprovecha para recuperarte y prepararte para el próximo entrenamiento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Completed Session RPE Summary */}
                    {selectedDay.status === 'completed' && selectedDay.rpeScore && (
                      <div className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-100 dark:border-green-800/50">
                        <span className="text-4xl flex-shrink-0">{getRPEEmoji(selectedDay.rpeScore)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-0.5">Percepción de esfuerzo</p>
                          <p className="font-semibold text-green-900 dark:text-green-200">
                            {RPE_OPTIONS.find(o => o.score === selectedDay.rpeScore)?.label}
                          </p>
                          {selectedDay.rpeNotes && (
                            <p className="text-sm text-green-700 dark:text-green-400 mt-1">{selectedDay.rpeNotes}</p>
                          )}
                          {selectedDay.notesAthlete && (
                            <p className="text-sm text-green-700 dark:text-green-400 mt-1 italic">"{selectedDay.notesAthlete}"</p>
                          )}
                        </div>
                        {selectedDay.actualDuration && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] uppercase tracking-widest text-green-500 dark:text-green-400">Duración</p>
                            <p className="text-lg font-bold text-green-800 dark:text-green-200">{selectedDay.actualDuration} <span className="text-sm font-normal">min</span></p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Strava Auto-completed Banner */}
                    {selectedDay.status === 'completed' && selectedDay.stravaActivityId && linkedActivities[selectedDayIndex] && (
                      <div className="rounded-2xl border border-[#FC4C02]/20 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FC4C02]/10 dark:bg-[#FC4C02]/15">
                          <SiStrava className="w-4 h-4 text-[#FC4C02]" />
                          <p className="text-xs font-bold uppercase tracking-widest text-[#FC4C02]">Completado vía Strava</p>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                          <div className="flex flex-col items-center py-3">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Distancia</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{linkedActivities[selectedDayIndex].distanceKm} <span className="text-xs font-normal text-slate-400">km</span></p>
                          </div>
                          <div className="flex flex-col items-center py-3">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Tiempo</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{linkedActivities[selectedDayIndex].formattedTime}</p>
                          </div>
                          <div className="flex flex-col items-center py-3">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Ritmo</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{linkedActivities[selectedDayIndex].pace} <span className="text-xs font-normal text-slate-400">min/km</span></p>
                          </div>
                        </div>
                        {linkedActivities[selectedDayIndex].average_heartrate && (
                          <div className="flex items-center justify-center gap-1.5 py-2 bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/30">
                            <FiHeart className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-red-600 dark:text-red-400">FC media: <strong>{Math.round(linkedActivities[selectedDayIndex].average_heartrate)} bpm</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Skipped Session Info */}
                    {selectedDay.status === 'skipped' && (
                      <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-600">
                        <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <FiSkipForward className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sesión omitida</p>
                          {selectedDay.notesAthlete && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedDay.notesAthlete}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDay.totalDistance && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                            <FiTarget className="w-3 h-3" /> Distancia
                          </p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {selectedDay.totalDistance}
                          </p>
                        </div>
                      )}
                      {selectedDay.duration && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                            <FiClock className="w-3 h-3" /> Duración est.
                          </p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {selectedDay.duration} <span className="text-sm font-normal text-slate-400">min</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedDay.description && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Descripción</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 leading-relaxed">
                          {selectedDay.description}
                        </p>
                      </div>
                    )}

                    {/* Exercises List */}
                    {selectedDay.exercises?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                          Ejercicios · {selectedDay.exercises.length}
                        </p>
                        <div className="space-y-2">
                          {selectedDay.exercises.map((exercise, index) => (
                            <div
                              key={exercise.id || index}
                              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-start gap-2">
                                  {selectedDay.status === 'completed' ? (
                                    <FiCheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <span className="w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">{index + 1}</span>
                                  )}
                                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {exercise.name}
                                  </h5>
                                </div>
                                {exercise.paceCode && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                    {exercise.paceCode}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                {exercise.sets && <span><span className="font-medium text-slate-700 dark:text-slate-300">{exercise.sets}</span> series</span>}
                                {exercise.reps && <span><span className="font-medium text-slate-700 dark:text-slate-300">{exercise.reps}</span> reps</span>}
                                {exercise.distance && <span><span className="font-medium text-slate-700 dark:text-slate-300">{formatDistance(exercise.distance)}</span></span>}
                                {exercise.rest && <span>r: <span className="font-medium text-slate-700 dark:text-slate-300">{formatRest(exercise.rest)}</span></span>}
                                {exercise.paceCode && <span>Ritmo: <span className="font-medium text-slate-700 dark:text-slate-300">{getPaceLabel(exercise.paceCode)}</span></span>}
                              </div>

                              {exercise.notes && (
                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic">
                                  {exercise.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coach Notes — only show if different from description */}
                    {selectedDay.notes && selectedDay.notes !== selectedDay.description && (
                      <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/40">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-sm">💬</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Nota del entrenador</p>
                          <p className="text-sm text-amber-800 dark:text-amber-300">{selectedDay.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Strava RPE Section (for auto-completed sessions missing RPE) */}
                    {showStravaRpeFlow && selectedDay.status === 'completed' && selectedDay.stravaActivityId && !selectedDay.rpeScore && (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Percepción de esfuerzo</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white mb-4">¿Cómo te has sentido?</p>

                        <div className="flex justify-between gap-1 mb-5">
                          {RPE_OPTIONS.map((option) => (
                            <button
                              key={option.score}
                              onClick={() => setRpeScore(option.score)}
                              className={`flex flex-col items-center flex-1 py-2.5 rounded-xl transition-all duration-150 ${
                                rpeScore === option.score
                                  ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-slate-400 dark:ring-slate-500 scale-105'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="text-2xl mb-1">{option.emoji}</span>
                              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-tight text-center">{option.label}</span>
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={athleteNotes}
                          onChange={(e) => setAthleteNotes(e.target.value)}
                          placeholder="Sensaciones, comentarios... (opcional)"
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none mb-3"
                        />

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleStravaRpeSave}
                            disabled={saving}
                            className="flex-1 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-900 rounded-xl font-semibold transition-colors text-sm"
                          >
                            {saving ? 'Guardando...' : 'Guardar RPE'}
                          </button>
                          <button
                            onClick={() => setShowStravaRpeFlow(false)}
                            className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* RPE Section (inline, shown when completing) */}
                    {showCompletionFlow && selectedDay.status === 'planned' && (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Percepción de esfuerzo</p>
                        <p className="text-base font-bold text-slate-900 dark:text-white mb-4">¿Cómo te has sentido?</p>

                        <div className="flex justify-between gap-1 mb-5">
                          {RPE_OPTIONS.map((option) => (
                            <button
                              key={option.score}
                              onClick={() => setRpeScore(option.score)}
                              className={`flex flex-col items-center flex-1 py-2.5 rounded-xl transition-all duration-150 ${
                                rpeScore === option.score
                                  ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-slate-400 dark:ring-slate-500 scale-105'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="text-2xl mb-1">{option.emoji}</span>
                              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-tight text-center">{option.label}</span>
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={athleteNotes}
                          onChange={(e) => setAthleteNotes(e.target.value)}
                          placeholder="Sensaciones, comentarios... (opcional)"
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none mb-3"
                        />

                        <div className="flex items-center gap-2 mb-3">
                          <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Duración real</label>
                          <input
                            type="number"
                            value={actualDuration}
                            onChange={(e) => setActualDuration(e.target.value)}
                            placeholder={selectedDay.duration ? `${selectedDay.duration} est.` : 'min'}
                            className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          />
                          <span className="text-xs text-slate-400">min</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCompleteSession}
                            disabled={saving}
                            className="flex-1 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-900 rounded-xl font-semibold transition-colors text-sm"
                          >
                            {saving ? 'Guardando...' : 'Guardar y Completar'}
                          </button>
                          <button
                            onClick={() => setShowCompletionFlow(false)}
                            className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {selectedDay.type !== 'rest' && !showCompletionFlow && !showStravaRpeFlow && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  {selectedDay.status === 'planned' && isPastOrToday(selectedDay.date) ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCompletionFlow(true)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-900 rounded-xl font-semibold transition-colors text-sm"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        <span>Completar Sesión</span>
                      </button>
                      <button
                        onClick={handleSkipSession}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                        <FiSkipForward className="w-4 h-4" />
                        <span>Omitir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'completed' && selectedDay.stravaActivityId && !selectedDay.rpeScore ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowStravaRpeFlow(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-100 text-white dark:text-slate-900 rounded-xl font-semibold transition-colors text-sm"
                      >
                        <SiStrava className="w-4 h-4" />
                        <span>Indicar RPE</span>
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={closeDayDetail}
                        className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'skipped' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={closeDayDetail}
                        className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center gap-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={closeDayDetail}
                      className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              )}
              {selectedDay.type === 'rest' && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <button
                    onClick={closeDayDetail}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RPE Modal */}
      {editRpeActivity && (
        <RPEModal
          activity={editRpeActivity}
          athleteName={profile?.first_name || 'Atleta'}
          onSubmit={handleEditRPESave}
          onClose={() => setEditRpeActivity(null)}
          initialScore={activitiesRPE[String(editRpeActivity.id)]?.score}
          initialNotes={activitiesRPE[String(editRpeActivity.id)]?.notes || ''}
          editMode
        />
      )}
      </div>
    </div>
  );
};

export default Training;
