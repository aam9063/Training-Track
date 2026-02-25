import { useState, useEffect } from 'react';
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
} from 'react-icons/fi';
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
import RPEModal from '../../components/athlete/RPEModal';
import useMapbox from '../../hooks/useMapbox';
import useAthleteTestData from '../../hooks/useAthleteTestData';
import useStravaActivities from '../../hooks/useStravaActivities';

const Training = () => {
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

  const getTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Cross Training',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      gym: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      rest: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
      cross_training: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[type] || colors.running;
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mis Entrenamientos
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Plan semanal de entrenamiento
          </p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={!hasAnyTraining}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm sm:text-base"
        >
          <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Descargar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <button
          onClick={goToPreviousWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
          <span className="font-semibold text-xs sm:text-sm lg:text-base text-center">
            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            {' - '}
            {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <button
          onClick={goToNextWeek}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Conconi Paces + VAM Results */}
      {(athletePaces.length > 0 || latestVam) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 sm:mb-6">
          {/* Conconi Paces Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiZap className="w-4 h-4 mr-2 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Test de Conconi</h3>
            </div>
            {athletePaces.length > 0 ? (() => {
              const paceOrder = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];
              const sorted = paceOrder
                .map(code => athletePaces.find(p => p.pace_code === code))
                .filter(Boolean);
              // Background colors matching the screenshot gradient: red → orange → yellow → green
              const bgColors = {
                RM:  'bg-red-600',
                R10: 'bg-red-500',
                R9:  'bg-red-400',
                R8:  'bg-orange-500',
                R7:  'bg-orange-400',
                R6:  'bg-yellow-500',
                R5:  'bg-yellow-400',
                R4:  'bg-lime-400',
                R3:  'bg-lime-500',
                R2:  'bg-green-400',
                R1:  'bg-green-500',
                RR:  'bg-emerald-600',
              };
              // Percentage labels per zone (approximate from screenshot)
              const pctLabels = {
                RM:  '100%',
                R10: '92%',
                R9:  '90%',
                R8:  '88%',
                R7:  '86%',
                R6:  '84%',
                R5:  '82%',
                R4:  '78%',
                R3:  '72%',
                R2:  '62%',
                R1:  '50%',
                RR:  '42%',
              };
              // Map recovery times from conconi series to pace zones (best effort mapping)
              const seriesRecovery = {};
              if (latestConconiTest?.conconi_test_series) {
                const series = [...latestConconiTest.conconi_test_series].sort((a, b) => a.series_number - b.series_number);
                // Map series to paces: last series ≈ R10, first ≈ R1, distribute linearly
                const totalSeries = series.length;
                const totalPaces = sorted.length;
                sorted.forEach((pace, i) => {
                  if (pace.pace_code === 'RR') return; // RR has no series
                  const seriesIdx = Math.round((i / (totalPaces - 1)) * (totalSeries - 1));
                  const s = series[Math.min(seriesIdx, totalSeries - 1)];
                  if (s?.recovery_time_seconds) {
                    seriesRecovery[pace.pace_code] = s.recovery_time_seconds;
                  }
                });
              }
              const maxHr = latestConconiTest?.max_hr_reached;
              const formatPaceVal = (secs) => {
                const min = Math.floor(secs / 60);
                const sec = Math.round(secs % 60);
                return `${min}'${String(sec).padStart(2, '0')}"`;
              };
              const formatRecovery = (secs) => {
                if (!secs) return '';
                const min = Math.floor(secs / 60);
                const sec = secs % 60;
                return sec > 0 ? `${min}'${String(sec).padStart(2, '0')}"` : `${min}'`;
              };

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 w-24"></th>
                        {sorted.map(pace => (
                          <th key={pace.pace_code} className={`px-1 py-1.5 text-center text-white font-bold whitespace-nowrap ${bgColors[pace.pace_code] || 'bg-gray-500'}`}>
                            {pace.pace_code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Percentage row */}
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1 px-2 text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10"></td>
                        {sorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1 text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {pctLabels[pace.pace_code] || ''}
                          </td>
                        ))}
                      </tr>
                      {/* Ritmo row */}
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">Ritmo/1.000m</td>
                        {sorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {formatPaceVal(pace.pace_seconds_per_km)}
                          </td>
                        ))}
                      </tr>
                      {/* Pulso row */}
                      <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-700/30 z-10">Pulso</td>
                        {sorted.map(pace => (
                          <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {pace.heart_rate_min && pace.heart_rate_max
                              ? `${pace.heart_rate_max}`
                              : ''}
                          </td>
                        ))}
                      </tr>
                      {/* Recovery time row */}
                      {Object.keys(seriesRecovery).length > 0 && (
                        <tr className="border-t border-gray-200 dark:border-gray-700">
                          <td className="py-1.5 px-2 text-gray-600 dark:text-gray-300 font-semibold whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">Recu. a 120p</td>
                          {sorted.map(pace => (
                            <td key={pace.pace_code} className="px-1 py-1.5 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {seriesRecovery[pace.pace_code] ? formatRecovery(seriesRecovery[pace.pace_code]) : ''}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {maxHr && (
                    <div className="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                      FC máx: <span className="font-semibold text-gray-700 dark:text-gray-300">{maxHr} ppm</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="text-center py-6">
                <FiZap className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Sin test de Conconi</p>
              </div>
            )}
          </div>

          {/* VAM Results */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <FiActivity className="w-4 h-4 mr-2 text-purple-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Test VAM</h3>
            </div>
            {latestVam ? (() => {
              const vamKmh = parseFloat(latestVam.vam_kmh);
              const paceSecsKm = latestVam.pace_seconds_per_km;
              const vo2max = (vamKmh * 3.5).toFixed(1);
              // Derived thresholds
              const mlssKmh = (vamKmh * 0.88).toFixed(1);
              const mlssPace = Math.round(3600 / (vamKmh * 0.88));
              const vt2Kmh = (vamKmh * 0.875).toFixed(1);
              const vt2Pace = Math.round(3600 / (vamKmh * 0.875));
              const vt1Kmh = (vamKmh * 0.775).toFixed(1);
              const vt1Pace = Math.round(3600 / (vamKmh * 0.775));
              const maxHr = latestConconiTest?.max_hr_reached;
              const formatP = (secs) => {
                const m = Math.floor(secs / 60);
                const s = Math.round(secs % 60);
                return `${m}'${String(s).padStart(2, '0')}"`;
              };

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs min-w-[500px]">
                    <thead>
                      <tr>
                        {[
                          { label: 'FCmax', color: 'bg-red-500' },
                          { label: 'VAM', color: 'bg-purple-500' },
                          { label: 'VO2max', color: 'bg-blue-500' },
                          { label: 'MLSS', color: 'bg-orange-500' },
                          { label: 'VT2', color: 'bg-yellow-500' },
                          { label: 'VT1', color: 'bg-green-500' },
                        ].map(col => (
                          <th key={col.label} className={`px-2 py-1.5 text-center text-white font-bold whitespace-nowrap ${col.color}`}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* km/h row */}
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        {[
                          maxHr ? `${maxHr}` : '-',
                          `${vamKmh.toFixed(1)}`,
                          vo2max,
                          mlssKmh,
                          vt2Kmh,
                          vt1Kmh,
                        ].map((val, i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {val}
                          </td>
                        ))}
                      </tr>
                      {/* Units row */}
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        {[
                          maxHr ? 'ppm' : '',
                          'km/h',
                          'ml/kg/min',
                          'km/h',
                          'km/h',
                          'km/h',
                        ].map((unit, i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {unit}
                          </td>
                        ))}
                      </tr>
                      {/* Pace row */}
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        {[
                          '',
                          formatP(paceSecsKm),
                          '',
                          formatP(mlssPace),
                          formatP(vt2Pace),
                          formatP(vt1Pace),
                        ].map((val, i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {val}
                          </td>
                        ))}
                      </tr>
                      {/* min/km label row */}
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        {['', 'min/km', '', 'min/km', 'min/km', 'min/km'].map((unit, i) => (
                          <td key={i} className="px-2 py-1 text-center text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {unit}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  <div className="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    Test: {new Date(latestVam.test_date).toLocaleDateString('es-ES')} &middot; {latestVam.distance_meters}m &middot; {Math.floor(latestVam.duration_seconds / 60)}'{String(latestVam.duration_seconds % 60).padStart(2, '0')}"
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-6">
                <FiActivity className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-1.5" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Sin test de VAM</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !hasAnyTraining ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sm:p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="max-w-md mx-auto">
            <FiCalendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay entrenamientos esta semana
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tu entrenador aún no ha creado un plan para esta semana.
              Prueba a navegar a otras semanas o contacta con tu entrenador.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ===== MOBILE: Compact week list (< lg) ===== */}
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      hasTraining ? 'hover:bg-gray-50 dark:hover:bg-gray-750' : ''
                    } ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    {/* Day number + name */}
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : isToday
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <span className={`text-[10px] font-bold uppercase leading-none ${
                        isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : isToday
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {DAYS_OF_WEEK[index].slice(0, 3)}
                      </span>
                      <span className={`text-sm font-bold leading-tight ${
                        isCompleted
                          ? 'text-green-700 dark:text-green-300'
                          : isToday
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Status bar */}
                    <div className={`w-1 h-8 rounded-full flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500'
                        : isSkipped
                          ? 'bg-gray-300 dark:bg-gray-600'
                          : hasTraining
                            ? isRest
                              ? 'bg-gray-200 dark:bg-gray-600'
                              : 'bg-blue-500'
                            : 'bg-transparent'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {training ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {isRest ? 'Descanso' : training.title}
                            </span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                HOY
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!isRest && (
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${getTypeColor(training.type)}`}>
                                {getTypeLabel(training.type)}
                              </span>
                            )}
                            {training.totalDistance && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">{training.totalDistance}</span>
                            )}
                            {training.duration && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">{training.duration} min</span>
                            )}
                            {training.description && !training.totalDistance && !training.duration && !isRest && (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{training.description}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">Sin entrenamiento</span>
                      )}
                    </div>

                    {/* Right side: status icons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isCompleted && training.stravaActivityId && !training.rpeScore && (
                        <span className="relative flex h-2.5 w-2.5 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FC4C02] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FC4C02]" />
                        </span>
                      )}
                      {isCompleted && training.rpeScore && (
                        <span className="text-sm">{getRPEEmoji(training.rpeScore)}</span>
                      )}
                      {isCompleted && training.stravaActivityId && (
                        <SiStrava className="w-4 h-4 text-[#FC4C02]" />
                      )}
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
                        <span className={`inline-block text-xs px-2 py-1 rounded-full ${getTypeColor(training.type)}`}>
                          {getTypeLabel(training.type)}
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

      {/* Mis Últimos Entrenamientos (Strava) */}
      {stravaConnected && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <FiActivity className="w-5 h-5 text-[#FC4C02]" />
            <span>Mis Últimos Entrenamientos</span>
            <span className="text-sm font-normal text-gray-500">(últimos 30 días)</span>
          </h2>

          {loadingStrava ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[#FC4C02]" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando actividades de Strava...</span>
            </div>
          ) : stravaActivities.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <FiActivity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay actividades en los últimos 30 días
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stravaActivities.slice(0, visibleActivities).map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => loadActivityDetail(activity)}
                  className="p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md cursor-pointer transition-all border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {activity.name}
                        </h4>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                          {new Date(activity.date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })} · {getActivityTypeLabel(activity.type)}
                        </p>
                      </div>
                      {activitiesRPE[String(activity.id)]?.score ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                          className="text-2xl hover:scale-110 transition-transform"
                          title={`Esfuerzo: ${activitiesRPE[String(activity.id)].score}/5 - Click para editar`}
                        >
                          {getRPEEmoji(activitiesRPE[String(activity.id)].score)}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRpeActivity(activity); }}
                          className="px-2.5 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          Valorar
                        </button>
                      )}
                    </div>
                    {activity.has_heartrate && (
                      <span className="flex items-center text-[10px] sm:text-xs text-red-500 flex-shrink-0 whitespace-nowrap">
                        <FiHeart className="w-3 h-3 mr-1" />
                        {activity.average_heartrate} bpm
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1 sm:gap-3 text-center">
                    <div>
                      <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                        {activity.distanceKm}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">km</p>
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400">
                        {activity.formattedTime}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">tiempo</p>
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                        {activity.pace}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">ritmo</p>
                    </div>
                    <div>
                      <p className="text-sm sm:text-lg font-bold text-orange-600 dark:text-orange-400">
                        {activity.total_elevation_gain || 0}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">m+</p>
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    <span className="text-xs text-orange-500">Click para ver detalles</span>
                  </div>
                </motion.div>
              ))}

              {/* Load more / pagination */}
              {visibleActivities < stravaActivities.length && (
                <div className="text-center pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); showMoreActivities(); }}
                    className="px-6 py-2.5 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Cargar más ({stravaActivities.length - visibleActivities} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Strava Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FC4C02] to-[#E34402]">
                <div className="flex items-start justify-between">
                  <div className="text-white">
                    <h2 className="text-xl font-bold">{selectedActivity.name}</h2>
                    <p className="text-orange-100 text-sm mt-1">
                      {new Date(selectedActivity.date).toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })} · {getActivityTypeLabel(selectedActivity.type)}
                    </p>
                  </div>
                  <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <FiX className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-orange">
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
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                          <FiFlag className="w-4 h-4 mr-2 text-yellow-500" />Segmentos ({selectedActivity.segment_efforts.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {selectedActivity.segment_efforts.slice(0, 10).map((effort) => (
                            <div key={effort.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{effort.segment?.name || effort.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{(effort.segment?.distance || effort.distance) / 1000 || 0} km</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-semibold text-gray-900 dark:text-white">{formatDuration(effort.moving_time || effort.elapsed_time)}</p>
                                {effort.pr_rank && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${effort.pr_rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : effort.pr_rank === 2 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                    PR #{effort.pr_rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strava Link */}
                    <a
                      href={`https://www.strava.com/activities/${selectedActivity.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 w-full py-3 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-xl transition-colors"
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
                      <span className={`inline-block text-xs px-3 py-1 rounded-full ${getTypeColor(selectedDay.type)}`}>
                        {getTypeLabel(selectedDay.type)}
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
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">{getRPEEmoji(selectedDay.rpeScore)}</span>
                            <div>
                              <p className="font-semibold text-green-800 dark:text-green-300">
                                Esfuerzo percibido: {RPE_OPTIONS.find(o => o.score === selectedDay.rpeScore)?.label}
                              </p>
                              {selectedDay.rpeNotes && (
                                <p className="text-sm text-green-700 dark:text-green-400 mt-1">{selectedDay.rpeNotes}</p>
                              )}
                            </div>
                          </div>
                          {selectedDay.actualDuration && (
                            <div className="text-right">
                              <p className="text-sm text-green-600 dark:text-green-400">Duración real</p>
                              <p className="font-bold text-green-800 dark:text-green-300">{selectedDay.actualDuration} min</p>
                            </div>
                          )}
                        </div>
                        {selectedDay.notesAthlete && (
                          <p className="mt-3 text-sm text-green-700 dark:text-green-400 border-t border-green-200 dark:border-green-800 pt-3">
                            💬 {selectedDay.notesAthlete}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Strava Auto-completed Banner */}
                    {selectedDay.status === 'completed' && selectedDay.stravaActivityId && linkedActivities[selectedDayIndex] && (
                      <div className="bg-[#FC4C02]/10 dark:bg-[#FC4C02]/20 rounded-lg p-4 border border-[#FC4C02]/30">
                        <div className="flex items-center space-x-2 mb-3">
                          <SiStrava className="w-5 h-5 text-[#FC4C02]" />
                          <p className="font-semibold text-[#FC4C02]">Completado automáticamente vía Strava</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Distancia</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{linkedActivities[selectedDayIndex].distanceKm} km</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tiempo</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{linkedActivities[selectedDayIndex].formattedTime}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Ritmo</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{linkedActivities[selectedDayIndex].pace} min/km</p>
                          </div>
                        </div>
                        {linkedActivities[selectedDayIndex].average_heartrate && (
                          <div className="mt-2 flex items-center justify-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                            <FiHeart className="w-3.5 h-3.5 text-red-500" />
                            <span>FC media: <strong>{Math.round(linkedActivities[selectedDayIndex].average_heartrate)} bpm</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Skipped Session Info */}
                    {selectedDay.status === 'skipped' && (
                      <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                        <div className="flex items-center space-x-2">
                          <FiSkipForward className="w-5 h-5 text-gray-500" />
                          <p className="font-semibold text-gray-700 dark:text-gray-300">Sesión omitida</p>
                        </div>
                        {selectedDay.notesAthlete && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selectedDay.notesAthlete}</p>
                        )}
                      </div>
                    )}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      {selectedDay.totalDistance && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiTarget className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-600 dark:text-blue-400">Distancia Total</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {selectedDay.totalDistance}
                          </p>
                        </div>
                      )}
                      {selectedDay.duration && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiClock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm text-purple-600 dark:text-purple-400">Duración est.</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {selectedDay.duration} min
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedDay.description && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Descripción
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                          {selectedDay.description}
                        </p>
                      </div>
                    )}

                    {/* Exercises List */}
                    {selectedDay.exercises?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Ejercicios ({selectedDay.exercises.length})
                        </h4>
                        <div className="space-y-3">
                          {selectedDay.exercises.map((exercise, index) => (
                            <div
                              key={exercise.id || index}
                              className="rounded-lg p-4 border bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-start space-x-3">
                                  {selectedDay.status === 'completed' && (
                                    <FiCheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                  )}
                                  <h5 className="font-medium text-gray-900 dark:text-white">
                                    {index + 1}. {exercise.name}
                                  </h5>
                                </div>
                                {exercise.paceCode && (
                                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                    {exercise.paceCode}
                                  </span>
                                )}
                              </div>

                              {/* Planned values */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {exercise.sets && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Series:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{exercise.sets}</span>
                                  </div>
                                )}
                                {exercise.reps && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Reps:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{exercise.reps}</span>
                                  </div>
                                )}
                                {exercise.distance && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Distancia:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatDistance(exercise.distance)}</span>
                                  </div>
                                )}
                                {exercise.rest && (
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Descanso:</span>
                                    <span className="ml-1 font-medium text-gray-900 dark:text-white">{formatRest(exercise.rest)}</span>
                                  </div>
                                )}
                              </div>

                              {exercise.paceCode && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Ritmo: {getPaceLabel(exercise.paceCode)}
                                  </span>
                                </div>
                              )}

                              {exercise.notes && (
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                                  💡 {exercise.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coach Notes — only show if different from description */}
                    {selectedDay.notes && selectedDay.notes !== selectedDay.description && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center">
                          💬 Notas del Entrenador
                        </h4>
                        <p className="text-yellow-800 dark:text-yellow-300">
                          {selectedDay.notes}
                        </p>
                      </div>
                    )}

                    {/* Strava RPE Section (for auto-completed sessions missing RPE) */}
                    {showStravaRpeFlow && selectedDay.status === 'completed' && selectedDay.stravaActivityId && !selectedDay.rpeScore && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 border border-orange-200 dark:border-orange-800">
                        <h4 className="text-base font-bold text-orange-800 dark:text-orange-300 mb-1">
                          ¿Cómo te has sentido?
                        </h4>
                        <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
                          Indica tu percepción de esfuerzo
                        </p>

                        <div className="flex justify-center gap-2 sm:gap-3 mb-5">
                          {RPE_OPTIONS.map((option) => (
                            <button
                              key={option.score}
                              onClick={() => setRpeScore(option.score)}
                              className={`flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all duration-200 ${
                                rpeScore === option.score
                                  ? 'bg-orange-200 dark:bg-orange-800/50 ring-2 ring-orange-500 scale-110'
                                  : 'hover:bg-orange-100 dark:hover:bg-orange-800/30 hover:scale-105'
                              }`}
                            >
                              <span className="text-2xl sm:text-3xl mb-1">{option.emoji}</span>
                              <span className={`text-[10px] sm:text-xs font-medium ${
                                rpeScore === option.score
                                  ? 'text-orange-700 dark:text-orange-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="mb-3">
                          <label className="block text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                            Sensaciones / Comentarios (opcional)
                          </label>
                          <textarea
                            value={athleteNotes}
                            onChange={(e) => setAthleteNotes(e.target.value)}
                            placeholder="¿Cómo te has sentido? Describe tus sensaciones..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleStravaRpeSave}
                            disabled={saving}
                            className="flex-1 py-2.5 bg-[#FC4C02] hover:bg-[#E34402] disabled:bg-orange-300 text-white rounded-lg font-semibold transition-colors text-sm"
                          >
                            {saving ? 'Guardando...' : 'Guardar RPE'}
                          </button>
                          <button
                            onClick={() => setShowStravaRpeFlow(false)}
                            className="px-4 py-2.5 text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-800/30 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* RPE Section (inline, shown when completing) */}
                    {showCompletionFlow && selectedDay.status === 'planned' && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                        <h4 className="text-base font-bold text-green-800 dark:text-green-300 mb-1">
                          ¿Cómo te has sentido?
                        </h4>
                        <p className="text-sm text-green-600 dark:text-green-400 mb-4">
                          Indica tu percepción de esfuerzo
                        </p>

                        {/* Emoji RPE Scale */}
                        <div className="flex justify-center gap-2 sm:gap-3 mb-5">
                          {RPE_OPTIONS.map((option) => (
                            <button
                              key={option.score}
                              onClick={() => setRpeScore(option.score)}
                              className={`flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all duration-200 ${
                                rpeScore === option.score
                                  ? 'bg-green-200 dark:bg-green-800/50 ring-2 ring-green-500 scale-110'
                                  : 'hover:bg-green-100 dark:hover:bg-green-800/30 hover:scale-105'
                              }`}
                            >
                              <span className="text-2xl sm:text-3xl mb-1">{option.emoji}</span>
                              <span className={`text-[10px] sm:text-xs font-medium ${
                                rpeScore === option.score
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Athlete notes */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                            Sensaciones / Comentarios (opcional)
                          </label>
                          <textarea
                            value={athleteNotes}
                            onChange={(e) => setAthleteNotes(e.target.value)}
                            placeholder="¿Cómo te has sentido? Describe tus sensaciones..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                          />
                        </div>

                        {/* Actual duration */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                            Duración real (min, opcional)
                          </label>
                          <input
                            type="number"
                            value={actualDuration}
                            onChange={(e) => setActualDuration(e.target.value)}
                            placeholder={selectedDay.duration ? `Est: ${selectedDay.duration}` : 'Minutos'}
                            className="w-32 px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleCompleteSession}
                            disabled={saving}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-semibold transition-colors text-sm"
                          >
                            {saving ? 'Guardando...' : 'Guardar y Completar'}
                          </button>
                          <button
                            onClick={() => setShowCompletionFlow(false)}
                            className="px-4 py-2.5 text-sm text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/30 rounded-lg transition-colors"
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
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowCompletionFlow(true)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors text-sm"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        <span>Completar Sesión</span>
                      </button>
                      <button
                        onClick={handleSkipSession}
                        disabled={saving}
                        className="flex items-center space-x-1 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <FiSkipForward className="w-4 h-4" />
                        <span>Omitir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'completed' && selectedDay.stravaActivityId && !selectedDay.rpeScore ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowStravaRpeFlow(true)}
                        className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg font-semibold transition-colors text-sm"
                      >
                        <SiStrava className="w-4 h-4" />
                        <span>Indicar RPE</span>
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center space-x-1 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'completed' ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={closeDayDetail}
                        className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center space-x-1 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir</span>
                      </button>
                    </div>
                  ) : selectedDay.status === 'skipped' ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={closeDayDetail}
                        className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={handleRevertSession}
                        disabled={saving}
                        className="flex items-center space-x-1 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <FiRotateCcw className="w-4 h-4" />
                        <span>Revertir a planificado</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={closeDayDetail}
                      className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
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
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
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
  );
};

export default Training;
