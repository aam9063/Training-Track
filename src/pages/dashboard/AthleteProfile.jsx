import { useState, useEffect, useCallback } from 'react';
import { showSuccess, showError } from '../../lib/toast';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiActivity,
  FiHeart,
  FiTrendingUp,
  FiLoader,
  FiMessageCircle,
  FiFlag,
  FiTarget,
  FiZap,
  FiX,
  FiPlus,
  FiTrash2,
  FiAward,
  FiUser,
  FiFileText,
  FiChevronDown,
} from 'react-icons/fi';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import { useAuth } from '../../contexts/AuthContext';
import {
  getAthleteDetails,
  getAthleteMetrics,
  getAthleteCompetitions,
  createAthleteCompetition,
  deleteAthleteCompetition,
} from '../../services/athleteService';
import {
  getAthleteWeeklyTraining,
  DAYS_OF_WEEK,
} from '../../services/weeklyTrainingService';
import {
  formatDuration,
  calculatePace,
  getActivityTypeLabel,
} from '../../services/stravaService';
import { getRPEEmoji, getRPELabel, RPE_OPTIONS } from '../../services/rpeService';
import useMapbox from '../../hooks/useMapbox';
import useWeeklyTrainings from '../../hooks/useWeeklyTrainings';
import useCoachStravaData from '../../hooks/useCoachStravaData';
import ConconiTestModal from '../../components/dashboard/ConconiTestModal';
import VAMTestModal from '../../components/dashboard/VAMTestModal';

const AthleteProfile = () => {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // States
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const coachTrainingTransform = useCallback((data) => {
    const trainingsByDay = {};
    if (data?.length > 0) {
      data.forEach((session) => {
        const sessionDate = new Date(session.scheduled_date);
        const dayIndex = (sessionDate.getDay() + 6) % 7;
        const exercises = session.exercises?.map((ex) => {
          const exercise = ex.running_exercise || ex.gym_exercise;
          return {
            name: exercise?.name || 'Ejercicio',
            sets: ex.planned_sets,
            reps: ex.planned_reps,
            distance: ex.planned_distance_meters,
            paceCode: ex.pace_code,
          };
        }) || [];
        trainingsByDay[dayIndex] = {
          id: session.id,
          title: session.title || 'Entrenamiento',
          type: session.training_type,
          description: session.description,
          duration: session.estimated_duration_minutes,
          exercises,
          status: session.status,
          rpe_score: session.rpe_score,
        };
      });
    }
    return trainingsByDay;
  }, []);

  const {
    currentWeek, trainings, loading: trainingsLoading,
    loadTrainings, goToPreviousWeek, goToNextWeek, getWeekDays,
  } = useWeeklyTrainings({
    fetchFn: (weekStart) => getAthleteWeeklyTraining(profile?.id, athleteId, weekStart),
    deps: [profile?.id, athleteId],
    transformFn: coachTrainingTransform,
  });
  const {
    stravaActivities, stravaLoading, stravaConnected, visibleActivities,
    stravaMetrics, stravaBestEfforts, activitiesRPE,
    rpeDetailActivity, setRpeDetailActivity,
    selectedActivity, setSelectedActivity,
    loadActivityDetail, showMoreActivities,
  } = useCoachStravaData(athleteId);
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', distance: '', location: '', notes: '' });
  const [savingEvent, setSavingEvent] = useState(false);
  const { mapContainerRef } = useMapbox(selectedActivity?.polyline, selectedActivity?.loading);
  const [showConconiModal, setShowConconiModal] = useState(false);
  const [showVAMModal, setShowVAMModal] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [showConconiTable, setShowConconiTable] = useState(false);
  const [showVamTable, setShowVamTable] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Load athlete data
  useEffect(() => {
    const loadAthlete = async () => {
      if (!athleteId) return;

      setLoading(true);
      try {
        const { data, error } = await getAthleteDetails(athleteId);
        if (error) throw error;
        setAthlete(data);
      } catch (error) {
        console.error('Error loading athlete:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAthlete();
  }, [athleteId]);


  // Load competitions
  const loadCompetitions = useCallback(async () => {
    if (!athleteId) return;
    try {
      const { data, error } = await getAthleteCompetitions(athleteId);
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  }, [athleteId]);

  // Load metrics and competitions
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!athleteId) return;

      try {
        const [metricsRes, competitionsRes] = await Promise.all([
          getAthleteMetrics(athleteId),
          getAthleteCompetitions(athleteId),
        ]);

        setMetrics(metricsRes.data || []);
        setEvents(competitionsRes.data || []);
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    };

    loadAdditionalData();
  }, [athleteId]);

  // Handle save competition
  const handleSaveEvent = async () => {
    if (!newEvent.name || !newEvent.date) return;

    setSavingEvent(true);
    try {
      const competitionData = {
        name: newEvent.name,
        event_date: newEvent.date,
        distance_km: newEvent.distance ? parseFloat(newEvent.distance) : null,
        location: newEvent.location || null,
        notes: newEvent.notes || null,
      };

      const { error } = await createAthleteCompetition(profile.id, athleteId, competitionData);
      if (error) throw error;

      // Reset form and close modal
      setNewEvent({ name: '', date: '', distance: '', location: '', notes: '' });
      setShowEventModal(false);

      // Reload competitions
      await loadCompetitions();
      showSuccess('Competicion guardada correctamente');
    } catch (error) {
      console.error('Error saving competition:', error);
      showError('Error al guardar la competicion');
    } finally {
      setSavingEvent(false);
    }
  };

  // Handle delete competition
  const handleDeleteEvent = async (competitionId) => {
    if (!confirm('¿Eliminar esta competición?')) return;

    try {
      const { error } = await deleteAthleteCompetition(competitionId);
      if (error) throw error;

      // Reload competitions
      await loadCompetitions();
      showSuccess('Competicion eliminada');
    } catch (error) {
      console.error('Error deleting competition:', error);
      showError('Error al eliminar la competicion');
    }
  };

  // Week navigation
  const weekDays = getWeekDays(currentWeek);

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-500',
      gym: 'bg-purple-500',
      rest: 'bg-gray-400',
      cross_training: 'bg-orange-500',
      race: 'bg-red-500',
    };
    return colors[type] || 'bg-gray-400';
  };

  const getTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Cross',
      race: 'Competición',
    };
    return labels[type] || type;
  };

  // Get week number
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Atleta no encontrado</p>
        <button
          onClick={() => navigate('/dashboard/athletes')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Volver a mis atletas
        </button>
      </div>
    );
  }

  // Conconi computed vars
  const paceOrder = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];
  const conconiSorted = paceOrder.map(code => athlete?.athlete_paces?.find(p => p.pace_code === code)).filter(Boolean);
  const bgColors = {
    RM: 'bg-red-600', R10: 'bg-red-500', R9: 'bg-red-400', R8: 'bg-orange-500',
    R7: 'bg-orange-400', R6: 'bg-yellow-500', R5: 'bg-yellow-400', R4: 'bg-lime-400',
    R3: 'bg-lime-500', R2: 'bg-green-400', R1: 'bg-green-500', RR: 'bg-emerald-600',
  };
  const pctLabels = {
    RM: '100%', R10: '92%', R9: '90%', R8: '88%', R7: '86%', R6: '84%',
    R5: '82%', R4: '78%', R3: '72%', R2: '62%', R1: '50%', RR: '42%',
  };
  const conconiSeriesRecovery = (() => {
    const recovery = {};
    if (athlete?.latest_conconi?.conconi_test_series) {
      const series = [...athlete.latest_conconi.conconi_test_series].sort((a, b) => a.series_number - b.series_number);
      const totalSeries = series.length;
      const totalPaces = conconiSorted.length;
      conconiSorted.forEach((pace, i) => {
        if (pace.pace_code === 'RR') return;
        const seriesIdx = Math.round((i / (totalPaces - 1)) * (totalSeries - 1));
        const s = series[Math.min(seriesIdx, totalSeries - 1)];
        if (s?.recovery_time_seconds) recovery[pace.pace_code] = s.recovery_time_seconds;
      });
    }
    return recovery;
  })();
  const conconiMaxHr = athlete?.latest_conconi?.max_hr_reached;
  const conconiR10 = athlete?.athlete_paces?.find(p => p.pace_code === 'R10');
  const conconiFirstRecov = Object.values(conconiSeriesRecovery)[0] ?? null;
  const fmtPaceProfile = (secs) => { const m = Math.floor(secs / 60); const s = Math.round(secs % 60); return `${m}'${String(s).padStart(2, '0')}"`; };
  const fmtRecProfile = (secs) => { if (!secs) return ''; const m = Math.floor(secs / 60); const s = secs % 60; return s > 0 ? `${m}'${String(s).padStart(2, '0')}"` : `${m}'`; };

  // VAM computed vars
  const vamData = athlete?.latest_vam;
  const vamKmhVal = vamData ? parseFloat(vamData.vam_kmh) : null;
  const vamVo2maxVal = vamKmhVal ? (vamKmhVal * 3.5).toFixed(1) : null;
  const vamMlssKmhVal = vamKmhVal ? (vamKmhVal * 0.88).toFixed(1) : null;
  const vamMlssPaceVal = vamKmhVal ? Math.round(3600 / (vamKmhVal * 0.88)) : null;
  const vamVt2KmhVal = vamKmhVal ? (vamKmhVal * 0.875).toFixed(1) : null;
  const vamVt2PaceVal = vamKmhVal ? Math.round(3600 / (vamKmhVal * 0.875)) : null;
  const fmtVamProfile = (secs) => { if (!secs) return '–'; const m = Math.floor(secs / 60); const s = Math.round(secs % 60); return `${m}'${String(s).padStart(2, '0')}"`; };

  const athleteName = `${athlete.user?.first_name || ''} ${athlete.user?.last_name || ''}`.trim() || 'Atleta';
  const initials = `${athlete.user?.first_name?.[0] || ''}${athlete.user?.last_name?.[0] || ''}`.toUpperCase() || 'AT';

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard/athletes')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        >
          <FiArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Avatar */}
        {athlete.user?.profile_image ? (
          <img
            src={athlete.user.profile_image}
            alt={athleteName}
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-blue-500 flex-shrink-0"
          />
        ) : (
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base sm:text-lg font-bold flex-shrink-0">
            {initials}
          </div>
        )}

        {/* Name + badges */}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate leading-tight">
            {athleteName}
          </h1>
          {athlete.race_distances?.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {athlete.race_distances.map((dist) => (
                <span key={dist} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-medium">
                  {dist}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sin distancias</p>
          )}

          {/* Action buttons — mobile only: below name */}
          <div className="flex items-center gap-1.5 mt-2 lg:hidden">
            <button
              onClick={() => navigate('/dashboard/planning')}
              className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
              title="Planificación"
            >
              <FiPlus className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-green-600" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowTestMenu(!showTestMenu)}
                className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
                title="Tests"
              >
                <FiFileText className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-orange-600" />
              </button>
              {showTestMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTestMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[180px]">
                    <button
                      onClick={() => { setShowTestMenu(false); setShowConconiModal(true); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Test de Conconi
                    </button>
                    <button
                      onClick={() => { setShowTestMenu(false); setShowVAMModal(true); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Test VAM
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => navigate('/dashboard/messages', { state: { openConversationWith: athleteId } })}
              className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
              title="Enviar mensaje"
            >
              <FiMessageCircle className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
            </button>
          </div>
        </div>

        {/* Action buttons — desktop only: right side of header */}
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => navigate('/dashboard/planning')}
            className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
            title="Planificación"
          >
            <FiPlus className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-green-600" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTestMenu(!showTestMenu)}
              className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
              title="Tests"
            >
              <FiFileText className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-orange-600" />
            </button>
            {showTestMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTestMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[180px]">
                  <button
                    onClick={() => { setShowTestMenu(false); setShowConconiModal(true); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Test de Conconi
                  </button>
                  <button
                    onClick={() => { setShowTestMenu(false); setShowVAMModal(true); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Test VAM
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => navigate('/dashboard/messages', { state: { openConversationWith: athleteId } })}
            className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 group"
            title="Enviar mensaje"
          >
            <FiMessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
          </button>
        </div>
      </div>

      {/* Test Cards: Conconi + VAM side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">

        {/* Conconi Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {!athlete.athlete_paces?.length ? (
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
              <FiZap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Test de Conconi</span>
            </div>
          ) : (
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FiZap className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">Test de Conconi</span>
                {athlete.latest_conconi?.test_date && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(athlete.latest_conconi.test_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowConconiTable(v => !v)}
                className="lg:hidden text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
              >
                {showConconiTable ? 'Ocultar' : 'Ver todo'} <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${showConconiTable ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {!athlete.athlete_paces?.length ? (
            <div className="text-center py-6 px-4">
              <FiZap className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin test de Conconi</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sube un CSV desde el icono de tests</p>
            </div>
          ) : (
            <>
              {/* 3 stat chips */}
              <div className="grid grid-cols-3 gap-2.5 px-4 pb-4 pt-3">
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">FC Máxima</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">{conconiMaxHr ?? '–'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">bpm</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500 mb-1">Ritmo R10</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 leading-none font-mono">
                    {conconiR10 ? fmtPaceProfile(conconiR10.pace_seconds_per_km) : '–'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">min/km</p>
                </div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-1">Recup. 120p</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none font-mono">
                    {conconiFirstRecov ? fmtRecProfile(conconiFirstRecov) : '–'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">tiempo</p>
                </div>
              </div>

              {/* Expandable full table — always visible on desktop, toggle on mobile */}
              <div className={`${showConconiTable ? 'block' : 'hidden lg:block'} border-t border-gray-100 dark:border-gray-700 overflow-x-auto`}>
                  <table className="w-full text-[11px] min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-3 text-slate-400 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 w-20">Zona</th>
                        {conconiSorted.map(pace => (
                          <th key={pace.pace_code} className={`px-1.5 py-1.5 text-center text-white font-bold whitespace-nowrap ${bgColors[pace.pace_code] || 'bg-gray-500'}`}>
                            {pace.pace_code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1 px-3 text-slate-400 text-[10px] sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10">% FC</td>
                        {conconiSorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{pctLabels[pace.pace_code] || ''}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold sticky left-0 bg-white dark:bg-gray-800 z-10">Ritmo</td>
                        {conconiSorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmtPaceProfile(pace.pace_seconds_per_km)}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10">Pulso</td>
                        {conconiSorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {pace.heart_rate_max || ''}
                          </td>
                        ))}
                      </tr>
                      {Object.keys(conconiSeriesRecovery).length > 0 && (
                        <tr className="border-t border-gray-100 dark:border-gray-700">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">Recu. 120p</td>
                          {conconiSorted.map(pace => (
                            <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {conconiSeriesRecovery[pace.pace_code] ? fmtRecProfile(conconiSeriesRecovery[pace.pace_code]) : ''}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
            </>
          )}
        </motion.div>

        {/* VAM Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {!vamData ? (
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
              <FiTrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Test VAM</span>
            </div>
          ) : (
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">Test VAM</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(vamData.test_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{vamData.distance_meters}m{' · '}{Math.floor(vamData.duration_seconds / 60)}'{String(vamData.duration_seconds % 60).padStart(2, '0')}"
                </span>
              </div>
              <button
                onClick={() => setShowVamTable(v => !v)}
                className="lg:hidden text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
              >
                {showVamTable ? 'Ocultar' : 'Ver todo'} <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${showVamTable ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {!vamData ? (
            <div className="text-center py-6 px-4">
              <FiActivity className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin test de VAM</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Registra un test desde el icono de tests</p>
            </div>
          ) : (
            <>
              {/* 2×2 colored metric cards */}
              <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 pt-3">
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">FC MÁX</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">{conconiMaxHr ?? '–'} <span className="text-sm font-normal">bpm</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">–</p>
                </div>
                <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1">VAM</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 leading-none">{vamKmhVal?.toFixed(1)} <span className="text-sm font-normal">km/h</span></p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{fmtVamProfile(vamData.pace_seconds_per_km)} min/km</p>
                </div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-1">VO2 MÁX</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">{vamVo2maxVal} <span className="text-sm font-normal">ml/kg</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">–</p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">MLSS</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">{vamMlssKmhVal} <span className="text-sm font-normal">km/h</span></p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{fmtVamProfile(vamMlssPaceVal)} min/km</p>
                </div>
              </div>

              {/* VT2 footer */}
              {vamVt2KmhVal && (
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <FiActivity className="w-3.5 h-3.5 text-blue-400" />
                  VT2: {vamVt2KmhVal} km/h · <span className="font-mono">{fmtVamProfile(vamVt2PaceVal)}</span> min/km
                </div>
              )}

              {/* Expandable full table — always visible on desktop, toggle on mobile */}
              <div className={`${showVamTable ? 'block' : 'hidden lg:block'} border-t border-gray-100 dark:border-gray-700 overflow-x-auto`}>
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
                        {[conconiMaxHr ?? '–', vamKmhVal?.toFixed(1), vamVo2maxVal, vamMlssKmhVal, vamVt2KmhVal, vamKmhVal ? (vamKmhVal * 0.775).toFixed(1) : '–'].map((val, i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        {[conconiMaxHr ? 'ppm' : '', 'km/h', 'ml/kg/min', 'km/h', 'km/h', 'km/h'].map((u, i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-slate-400 whitespace-nowrap">{u}</td>
                        ))}
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        {['', fmtVamProfile(vamData.pace_seconds_per_km), '', fmtVamProfile(vamMlssPaceVal), fmtVamProfile(vamVt2PaceVal), vamKmhVal ? fmtVamProfile(Math.round(3600 / (vamKmhVal * 0.775))) : '–'].map((val, i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{val}</td>
                        ))}
                      </tr>
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        {['', 'min/km', '', 'min/km', 'min/km', 'min/km'].map((u, i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-slate-400 whitespace-nowrap">{u}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
            </>
          )}
        </motion.div>

      </div>

      {/* Main Content - Collage Layout */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6">
        {/* Weekly Training Grid - Spans full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Week Navigator */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
              Planificación Semanal
            </h2>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={goToPreviousWeek}
                className="p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center whitespace-nowrap">
                Semana {getWeekNumber(currentWeek)} ({weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: '2-digit' })})
              </span>
              <button
                onClick={goToNextWeek}
                className="p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Week Grid */}
          {trainingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Desktop: 7-column grid */}
              <div className="hidden sm:grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
                {weekDays.map((day, index) => {
                  const training = trainings[index];
                  const isToday = day.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={index}
                      onClick={() => training && setSelectedTraining({ ...training, dayLabel: DAYS_OF_WEEK[index], dayDate: day })}
                      className={`min-h-[180px] p-3 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${training ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-colors' : ''}`}
                    >
                      <div className="text-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          {DAYS_OF_WEEK[index].slice(0, 3)}
                        </p>
                        <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                          {day.getDate()}
                        </p>
                      </div>
                      {training ? (
                        <div className={`space-y-2 ${training.status === 'completed' ? 'border-l-2 border-green-500 pl-2' : training.status === 'skipped' ? 'border-l-2 border-gray-400 pl-2 opacity-60' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className={`h-1.5 rounded-full flex-1 ${training.status === 'completed' ? 'bg-green-500' : training.status === 'skipped' ? 'bg-gray-400' : getTypeColor(training.type)}`} />
                            {training.status === 'completed' && training.rpe_score && (
                              <span className="ml-1 text-sm" title={`RPE: ${RPE_OPTIONS.find(r => r.score === training.rpe_score)?.label}`}>
                                {RPE_OPTIONS.find(r => r.score === training.rpe_score)?.emoji}
                              </span>
                            )}
                            {training.status === 'skipped' && (
                              <span className="ml-1 text-[10px] text-gray-400">Omitido</span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {getTypeLabel(training.type)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {training.title}
                          </p>
                          {training.duration && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                              <FiClock className="w-3 h-3 mr-1" />
                              {training.duration} min
                            </p>
                          )}
                          {training.exercises?.length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {training.exercises.length} ejercicio{training.exercises.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-24 text-gray-300 dark:text-gray-600">
                          <span className="text-xs">Sin entreno</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: Stacked list */}
              <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {weekDays.map((day, index) => {
                  const training = trainings[index];
                  const isToday = day.toDateString() === new Date().toDateString();
                  if (!training && !isToday) return null;

                  return (
                    <div
                      key={index}
                      onClick={() => training && setSelectedTraining({ ...training, dayLabel: DAYS_OF_WEEK[index], dayDate: day })}
                      className={`p-3 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${training ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-colors' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 text-center w-10">
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            {DAYS_OF_WEEK[index].slice(0, 3)}
                          </p>
                          <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                            {day.getDate()}
                          </p>
                        </div>
                        {training ? (
                          <div className={`flex-1 min-w-0 ${training.status === 'skipped' ? 'opacity-60' : ''}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${training.status === 'completed' ? 'bg-green-500' : training.status === 'skipped' ? 'bg-gray-400' : getTypeColor(training.type)}`} />
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {training.title}
                              </p>
                              {training.status === 'completed' && training.rpe_score && (
                                <span className="text-sm flex-shrink-0">{RPE_OPTIONS.find(r => r.score === training.rpe_score)?.emoji}</span>
                              )}
                              {training.status === 'skipped' && (
                                <span className="text-[10px] text-gray-400 flex-shrink-0">Omitido</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {getTypeLabel(training.type)}
                              {training.duration ? ` · ${training.duration} min` : ''}
                              {training.exercises?.length > 0 ? ` · ${training.exercises.length} ejerc.` : ''}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Sin entreno</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>

        {/* Strava Activities - Large section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-7 bg-transparent rounded-2xl flex flex-col gap-3"
        >
          {/* Section header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-[#FC4C02]" />
              Últimos Entrenamientos (Strava)
            </h2>
          </div>

          {stravaLoading ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[#FC4C02]" />
            </div>
          ) : !stravaConnected ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <FiActivity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Este atleta no ha conectado Strava</p>
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <FiActivity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay actividades en los últimos 30 días</p>
            </div>
          ) : (
            <div>
            <div className="max-h-[600px] scrollbar-hover space-y-3 pr-1">
              {stravaActivities.slice(0, visibleActivities).map((activity) => {
                const rpeData = activitiesRPE[String(activity.id)];
                const actTypeClass = activity.type === 'Run' || activity.type === 'VirtualRun'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : activity.type === 'WeightTraining' || activity.type === 'Workout'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
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
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${actTypeClass}`}>
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

                    {/* Footer */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        {activity.calories > 0 && <span>{activity.calories} kcal</span>}
                        {activity.kudos_count > 0 && <span>· {activity.kudos_count} kudos</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {rpeData?.score && (
                          <span className="text-xl">{getRPEEmoji(rpeData.score)}</span>
                        )}
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Ver detalle &rsaquo;</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {visibleActivities < stravaActivities.length && (
              <div className="flex justify-center mt-3">
                <button
                  onClick={showMoreActivities}
                  className="px-4 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cargar más · {stravaActivities.length - visibleActivities} restantes
                </button>
              </div>
            )}
            </div>
          )}
        </motion.div>

        {/* Personal Data + Metrics Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        >
          {/* Personal Data */}
          {(athlete.date_of_birth || athlete.weight || athlete.height) && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                <FiUser className="w-4 h-4 mr-1.5" />
                Datos Personales
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {athlete.date_of_birth && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Edad</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.floor((new Date() - new Date(athlete.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))}
                    </p>
                    <p className="text-[10px] text-gray-400">{new Date(athlete.date_of_birth).toLocaleDateString('es-ES')}</p>
                  </div>
                )}
                {athlete.weight && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Peso</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {athlete.weight} <span className="text-xs font-normal">kg</span>
                    </p>
                  </div>
                )}
                {athlete.height && (
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Estatura</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {athlete.height} <span className="text-xs font-normal">cm</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiTrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Métricas
            </h2>
            <button
              onClick={() => navigate(`/dashboard/athletes/${athleteId}/metrics`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todo →
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[600px] scrollbar-hover">
            {stravaMetrics ? (
              <>
                {/* Main Stats — mismo estilo que Metrics.jsx del atleta */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 text-white shadow-sm">
                    <p className="text-xs font-medium opacity-80 mb-1">Running</p>
                    <p className="text-2xl font-bold">{stravaMetrics.totalDistanceKm}<span className="text-xs font-normal ml-1 opacity-75">km</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 text-white shadow-sm">
                    <p className="text-xs font-medium opacity-80 mb-1">Tiempo</p>
                    <p className="text-lg font-bold">{stravaMetrics.totalTimeFormatted}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 text-white shadow-sm">
                    <p className="text-xs font-medium opacity-80 mb-1">Ritmo Medio</p>
                    <p className="text-xl font-bold">{stravaMetrics.avgPace || '-'}<span className="text-xs font-normal ml-1 opacity-75">min/km</span></p>
                  </div>
                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 text-white shadow-sm">
                    <p className="text-xs font-medium opacity-80 mb-1">FC Media</p>
                    <p className="text-2xl font-bold">{stravaMetrics.avgHeartrate || '-'}<span className="text-xs font-normal ml-1 opacity-75">bpm</span></p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-2.5 text-white text-center shadow-sm">
                    <p className="text-lg font-bold">{stravaMetrics.totalActivities}</p>
                    <p className="text-[10px] opacity-75">Actividades</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-2.5 text-white text-center shadow-sm">
                    <p className="text-lg font-bold">{stravaMetrics.totalElevation}m</p>
                    <p className="text-[10px] opacity-75">Desnivel</p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-2.5 text-white text-center shadow-sm">
                    <p className="text-lg font-bold">{stravaMetrics.avgDistanceKm}km</p>
                    <p className="text-[10px] opacity-75">Media/Activ.</p>
                  </div>
                </div>

                {/* Weekly Stats Chart */}
                {stravaMetrics.weeklyStats?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Volumen Semanal (km)
                    </p>
                    <div className="h-24">
                      <Line
                        data={{
                          labels: stravaMetrics.weeklyStats.slice().reverse().map(w => w.weekNumber),
                          datasets: [
                            {
                              data: stravaMetrics.weeklyStats.slice().reverse().map(w => parseFloat(w.distanceKm)),
                              borderColor: '#1A6BFF',
                              backgroundColor: 'rgba(26, 107, 255, 0.1)',
                              fill: true,
                              tension: 0.4,
                              pointRadius: 4,
                              pointBackgroundColor: '#1A6BFF',
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { display: true, ticks: { font: { size: 9 } }, grid: { display: false } },
                            y: { display: true, ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Best Performances */}
                {(stravaMetrics.longestRun || stravaMetrics.fastestPace) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mejores resultados</p>
                    {stravaMetrics.longestRun && (
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <FiTarget className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Más larga</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {stravaMetrics.longestRun.distanceKm} km
                        </span>
                      </div>
                    )}
                    {stravaMetrics.fastestPace && (
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <FiZap className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Más rápida</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {stravaMetrics.fastestPace.pace}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Fallback sin Strava */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {athlete.vo2_max && (
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 text-white shadow-sm">
                      <p className="text-xs font-medium opacity-80 mb-1">VO2 Max</p>
                      <p className="text-2xl font-bold">{athlete.vo2_max}</p>
                    </div>
                  )}
                  {athlete.resting_heart_rate && (
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 text-white shadow-sm">
                      <p className="text-xs font-medium opacity-80 mb-1">FC Reposo</p>
                      <p className="text-2xl font-bold">{athlete.resting_heart_rate}<span className="text-xs font-normal ml-1 opacity-75">bpm</span></p>
                    </div>
                  )}
                  {athlete.max_heart_rate && (
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 text-white shadow-sm">
                      <p className="text-xs font-medium opacity-80 mb-1">FC Max</p>
                      <p className="text-2xl font-bold">{athlete.max_heart_rate}<span className="text-xs font-normal ml-1 opacity-75">bpm</span></p>
                    </div>
                  )}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 text-white shadow-sm">
                    <p className="text-xs font-medium opacity-80 mb-1">Actividades</p>
                    <p className="text-2xl font-bold">{stravaActivities.length}</p>
                  </div>
                </div>

                {metrics.length > 0 && (
                  <div className="h-32">
                    <Line
                      data={{
                        labels: metrics.slice(-7).map((_, i) => `D${i + 1}`),
                        datasets: [{
                          data: metrics.slice(-7).map((m) => m.distance_meters || 0),
                          borderColor: '#1A6BFF',
                          backgroundColor: 'rgba(26, 107, 255, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 0,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { display: false }, y: { display: false } },
                      }}
                    />
                  </div>
                )}

                {!stravaConnected && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    <FiActivity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Sin conexión a Strava</p>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-12 lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiFlag className="w-4 h-4 text-rose-500" />
              Próximos Eventos
            </h2>
            <button
              onClick={() => setShowEventModal(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
              title="Añadir evento"
            >
              <FiPlus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <div className="p-4 max-h-[280px] scrollbar-hover">
            {events.length === 0 ? (
              <div className="text-center py-6">
                <FiFlag className="w-8 h-8 text-gray-200 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-400">No hay eventos programados</p>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  + Añadir competición
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((competition) => (
                  <div
                    key={competition.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border-l-[3px] border-rose-400 dark:border-rose-500 group relative"
                  >
                    <button
                      onClick={() => handleDeleteEvent(competition.id)}
                      className="absolute top-2 right-2 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar competición"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm pr-6">
                      {competition.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {new Date(competition.event_date + 'T12:00:00').toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {competition.distance_km && (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {competition.distance_km} km
                        </span>
                      )}
                      {competition.location && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                          <FiMapPin className="w-3 h-3" />{competition.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal Bests - From Strava */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-12 lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <FiAward className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Mejores Marcas</h2>
          </div>

          <div className="p-4 max-h-[280px] scrollbar-hover">
            {stravaBestEfforts.length > 0 ? (
              <div className="space-y-1.5">
                {stravaBestEfforts.map((effort, index) => (
                  <div
                    key={effort.name + index}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {effort.name}
                      </span>
                      {effort.pace && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {effort.pace} /km
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {effort.timeFormatted}
                      </span>
                      {effort.date && (
                        <p className="text-xs text-slate-400">
                          {new Date(effort.date).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : athlete.personal_bests?.length > 0 ? (
              <div className="space-y-1.5">
                {athlete.personal_bests.slice(0, 5).map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {pb.distance_name || `${pb.distance_meters}m`}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {pb.time_formatted || formatDuration(pb.time_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FiAward className="w-8 h-8 text-gray-200 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {stravaConnected
                    ? 'No hay suficientes datos para calcular marcas'
                    : 'Conecta Strava para ver marcas'}
                </p>
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* Activity Detail Modal */}
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
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })} · {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="p-2 hover:bg-white/60 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
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
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedActivity.distanceKm}
                        </p>
                        <p className="text-xs text-blue-500">km</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedActivity.formattedTime}
                        </p>
                        <p className="text-xs text-purple-500">tiempo</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedActivity.pace}
                        </p>
                        <p className="text-xs text-green-500">ritmo medio</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {selectedActivity.average_heartrate || '-'}
                        </p>
                        <p className="text-xs text-red-500">bpm medio</p>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.total_elevation_gain || 0}m
                        </p>
                        <p className="text-xs text-gray-500">desnivel+</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.max_heartrate || '-'}
                        </p>
                        <p className="text-xs text-gray-500">FC max</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.calories || '-'}
                        </p>
                        <p className="text-xs text-gray-500">kcal</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.suffer_score || '-'}
                        </p>
                        <p className="text-xs text-gray-500">esfuerzo</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.kudos_count || 0}
                        </p>
                        <p className="text-xs text-gray-500">kudos</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedActivity.achievement_count || 0}
                        </p>
                        <p className="text-xs text-gray-500">logros</p>
                      </div>
                    </div>

                    {/* Activity Map */}
                    {selectedActivity.polyline && (
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiMapPin className="w-4 h-4 mr-2 text-orange-500" />
                          Recorrido
                        </h3>
                        <div
                          ref={mapContainerRef}
                          className="h-64 rounded-lg overflow-hidden"
                          style={{ minHeight: '256px' }}
                        />
                      </div>
                    )}

                    {/* Laps / Splits */}
                    {selectedActivity.laps && selectedActivity.laps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />
                          Vueltas ({selectedActivity.laps.length})
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
                                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                                    {lap.name || `Vuelta ${index + 1}`}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                    {(lap.distance / 1000).toFixed(2)} km
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                    {formatDuration(lap.moving_time)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">
                                    {calculatePace(lap.moving_time, lap.distance)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                                    {lap.average_heartrate ? `${Math.round(lap.average_heartrate)}` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                                    {lap.average_cadence ? `${Math.round(lap.average_cadence * 2)}` : '-'}
                                  </td>
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
                          <FiTrendingUp className="w-4 h-4 mr-2 text-green-500" />
                          Parciales por Kilómetro
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {selectedActivity.splits_metric.map((split, index) => {
                            const pace = calculatePace(split.moving_time, split.distance);
                            const isGoodPace = split.average_heartrate && split.average_heartrate < (selectedActivity.average_heartrate || 150);
                            return (
                              <div
                                key={index}
                                className={`p-2 rounded-lg text-center ${
                                  isGoodPace
                                    ? 'bg-green-50 dark:bg-green-900/20'
                                    : 'bg-gray-50 dark:bg-gray-700/50'
                                }`}
                              >
                                <p className="text-xs text-gray-500 mb-1">km {index + 1}</p>
                                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                                  {pace}
                                </p>
                                {split.average_heartrate && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {Math.round(split.average_heartrate)}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Segment Efforts */}
                    {selectedActivity.segment_efforts && selectedActivity.segment_efforts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiFlag className="w-4 h-4 mr-2 text-yellow-500" />
                          Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => (
                            <div
                              key={effort.id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {effort.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(effort.segment?.distance / 1000).toFixed(2)} km
                                  {effort.segment?.average_grade && ` • ${effort.segment.average_grade.toFixed(1)}%`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold text-gray-900 dark:text-white">
                                  {formatDuration(effort.moving_time)}
                                </p>
                                {effort.pr_rank && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    effort.pr_rank === 1
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : effort.pr_rank === 2
                                      ? 'bg-gray-100 text-gray-700'
                                      : effort.pr_rank === 3
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    PR #{effort.pr_rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {selectedActivity.segment_efforts.length > 10 && (
                            <p className="text-center text-sm text-gray-500">
                              +{selectedActivity.segment_efforts.length - 10} segmentos más
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {selectedActivity.description && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                        <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                          Descripción
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          {selectedActivity.description}
                        </p>
                      </div>
                    )}

                    {/* Device */}
                    {selectedActivity.device_name && (
                      <p className="text-xs text-gray-400 text-center">
                        Registrado con {selectedActivity.device_name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl transition-colors text-sm font-medium"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-pink-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <FiFlag className="w-5 h-5 mr-2" />
                    Nueva Competición
                  </h2>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {/* Event Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del evento *
                  </label>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    placeholder="Ej: Media Maratón Valencia"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Event Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Distance and Location in a row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Distancia (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newEvent.distance}
                      onChange={(e) => setNewEvent({ ...newEvent, distance: e.target.value })}
                      placeholder="21.1"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder="Valencia"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                    placeholder="Objetivo, tiempo esperado, etc."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={!newEvent.name || !newEvent.date || savingEvent}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingEvent ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RPE Detail Modal (Coach read-only) */}
      <AnimatePresence>
        {rpeDetailActivity && activitiesRPE[String(rpeDetailActivity.id)] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-4 text-white relative">
                <button
                  onClick={() => setRpeDetailActivity(null)}
                  className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
                <p className="font-bold">Percepción de Esfuerzo</p>
                <p className="text-white/80 text-sm mt-1">{rpeDetailActivity.name}</p>
              </div>
              <div className="p-5 text-center">
                <span className="text-5xl">
                  {getRPEEmoji(activitiesRPE[String(rpeDetailActivity.id)].score)}
                </span>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                  {getRPELabel(activitiesRPE[String(rpeDetailActivity.id)].score)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activitiesRPE[String(rpeDetailActivity.id)].score}/5
                </p>
                {activitiesRPE[String(rpeDetailActivity.id)].notes && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sensaciones del atleta:</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {activitiesRPE[String(rpeDetailActivity.id)].notes}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setRpeDetailActivity(null)}
                  className="mt-4 px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Conconi Test Modal */}
      <ConconiTestModal
        isOpen={showConconiModal}
        onClose={() => setShowConconiModal(false)}
        athlete={athlete}
        coachId={profile?.coach_id || profile?.id}
        onSuccess={async () => {
          const { data } = await getAthleteDetails(athleteId);
          if (data) setAthlete(data);
        }}
      />

      {/* VAM Test Modal */}
      <VAMTestModal
        isOpen={showVAMModal}
        onClose={() => setShowVAMModal(false)}
        athlete={athlete}
        coachId={profile?.coach_id || profile?.id}
        onSuccess={() => {}}
      />

      {/* Training Session Detail Modal */}
      <AnimatePresence>
        {selectedTraining && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setSelectedTraining(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className={`px-5 py-4 flex items-start justify-between gap-3 ${
                selectedTraining.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' :
                selectedTraining.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-700/40' :
                'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    selectedTraining.status === 'completed' ? 'bg-green-500' :
                    selectedTraining.status === 'skipped' ? 'bg-gray-400' :
                    getTypeColor(selectedTraining.type)
                  }`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {selectedTraining.dayLabel} · {selectedTraining.dayDate?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                      {selectedTraining.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTraining(null)}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <FiX className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Badges row */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {getTypeLabel(selectedTraining.type)}
                  </span>
                  {selectedTraining.status && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedTraining.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      selectedTraining.status === 'skipped' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {selectedTraining.status === 'completed' ? 'Completado' :
                       selectedTraining.status === 'skipped' ? 'Omitido' : 'Pendiente'}
                    </span>
                  )}
                  {selectedTraining.duration && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <FiClock className="w-3 h-3" />{selectedTraining.duration} min
                    </span>
                  )}
                  {selectedTraining.rpe_score && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 flex items-center gap-1">
                      {RPE_OPTIONS.find(r => r.score === selectedTraining.rpe_score)?.emoji} RPE {selectedTraining.rpe_score}
                    </span>
                  )}
                </div>

                {/* Description */}
                {selectedTraining.description && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Descripción</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedTraining.description}
                    </p>
                  </div>
                )}

                {/* Coach notes */}
                {selectedTraining.notes_coach && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Notas del entrenador</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
                      {selectedTraining.notes_coach}
                    </p>
                  </div>
                )}

                {/* Athlete notes */}
                {selectedTraining.notes_athlete && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Notas del atleta</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-blue-50 dark:bg-blue-900/10 rounded-xl px-3 py-2.5">
                      {selectedTraining.notes_athlete}
                    </p>
                  </div>
                )}

                {/* Exercises */}
                {selectedTraining.exercises?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Ejercicios ({selectedTraining.exercises.length})
                    </p>
                    <div className="space-y-1.5">
                      {selectedTraining.exercises.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 px-3 py-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="font-medium">{ex.exercise_name || ex.name}</p>
                            {(ex.sets || ex.reps || ex.duration_seconds) && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {ex.sets && `${ex.sets} series`}{ex.sets && ex.reps ? ' × ' : ''}{ex.reps && `${ex.reps} reps`}
                                {ex.duration_seconds && ` · ${Math.round(ex.duration_seconds / 60)} min`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={() => setSelectedTraining(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AthleteProfile;
