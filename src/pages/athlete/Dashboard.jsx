import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiTrendingUp,
  FiCalendar,
  FiArrowRight,
  FiClock,
  FiLoader,
  FiFlag,
  FiBarChart2,
  FiMapPin,
  FiSmartphone,
  FiMessageSquare,
} from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { toLocalDateStr } from '../../lib/dateUtils';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { getAthleteCompetitions } from '../../services/athleteService';
import WellnessForm from '../../components/athlete/WellnessForm';
import ReadinessScore from '../../components/athlete/ReadinessScore';

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  const [wellnessRefreshKey, setWellnessRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weekStats, setWeekStats] = useState({
    totalKm: 0,
    totalTime: '0h 0m',
    sessions: 0,
    avgPace: '-',
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [upcomingCompetitions, setUpcomingCompetitions] = useState([]);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';

  const loadDashboardData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get current week dates
      const weekStart = getWeekStartDate();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Fetch sessions for current week (for stats)
      const { data: weekSessions, error: weekError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profile.id)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .lte('scheduled_date', toLocalDateStr(weekEnd))
        .order('scheduled_date', { ascending: true });

      if (weekError) throw weekError;

      // Fetch upcoming sessions (from start of current week onwards)
      // Show all sessions from this week, not just from today
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profile.id)
        .gte('scheduled_date', toLocalDateStr(weekStart))
        .neq('training_type', 'rest')
        .order('scheduled_date', { ascending: true })
        .limit(10);

      if (upcomingError) throw upcomingError;

      // Get exercises for week sessions
      let weekSessionsWithExercises = weekSessions || [];
      if (weekSessions?.length > 0) {
        const sessionIds = weekSessions.map(s => s.id);
        const { data: exercises } = await supabase
          .from('training_session_exercises')
          .select('*')
          .in('session_id', sessionIds);

        weekSessionsWithExercises = weekSessions.map(session => ({
          ...session,
          exercises: exercises?.filter(e => e.session_id === session.id) || [],
        }));
      }

      // Calculate week stats
      let totalDistanceMeters = 0;
      let totalDurationMinutes = 0;

      weekSessionsWithExercises.forEach((session) => {
        if (session.training_type !== 'rest') {
          if (session.estimated_duration_minutes) {
            totalDurationMinutes += session.estimated_duration_minutes;
          }

          session.exercises?.forEach((ex) => {
            if (ex.planned_distance_meters) {
              const sets = ex.planned_sets || 1;
              const reps = ex.planned_reps || 1;
              totalDistanceMeters += ex.planned_distance_meters * sets * reps;
            }
          });
        }
      });

      // Format stats
      const totalKm = (totalDistanceMeters / 1000).toFixed(1);
      const hours = Math.floor(totalDurationMinutes / 60);
      const minutes = totalDurationMinutes % 60;
      const totalTime = `${hours}h ${minutes}m`;

      // Calculate avg pace
      let avgPace = '-';
      if (totalDistanceMeters > 0 && totalDurationMinutes > 0) {
        const paceMinPerKm = totalDurationMinutes / (totalDistanceMeters / 1000);
        const paceMin = Math.floor(paceMinPerKm);
        const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
        avgPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
      }

      setWeekStats({
        totalKm: parseFloat(totalKm),
        totalTime,
        sessions: weekSessionsWithExercises.filter(s => s.training_type !== 'rest').length,
        avgPace,
      });

      // Format upcoming sessions
      const upcoming = (upcomingData || []).map(session => ({
        id: session.id,
        title: session.title || 'Entrenamiento',
        date: session.scheduled_date,
        time: session.scheduled_time || '',
        type: session.training_type,
      }));

      setUpcomingSessions(upcoming.slice(0, 3));

      // Fetch upcoming competitions
      const { data: competitions } = await getAthleteCompetitions(profile.id);
      setUpcomingCompetitions((competitions || []).slice(0, 3));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Hola, {displayName}!
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Aquí está tu resumen de entrenamiento
        </p>
      </div>

      {/* Wellness + Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <WellnessForm compact onSaved={() => setWellnessRefreshKey(k => k + 1)} />
        <ReadinessScore onRefresh={wellnessRefreshKey} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              Esta Semana
            </h3>
            <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FiActivity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {weekStats.totalKm} km
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {weekStats.sessions} entrenamientos
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              Tiempo Total
            </h3>
            <div className="p-1.5 sm:p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <FiClock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {weekStats.totalTime}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Esta semana
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              Ritmo Promedio
            </h3>
            <div className="p-1.5 sm:p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {weekStats.avgPace}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            min/km
          </p>
        </motion.div>

        <Link to="/athlete/training">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                Sesiones
              </h3>
              <div className="p-1.5 sm:p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {weekStats.sessions}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Planificadas
            </p>
          </motion.div>
        </Link>
      </div>

      {/* Upcoming Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Entrenamientos de la Semana
          </h2>
          <Link
            to="/athlete/training"
            className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
          >
            <span>Ver todos</span>
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {upcomingSessions.map((session) => (
            <Link
              key={session.id}
              to="/athlete/training"
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors gap-3"
            >
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                  session.type === 'running'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : session.type === 'gym'
                    ? 'bg-purple-100 dark:bg-purple-900/30'
                    : 'bg-orange-100 dark:bg-orange-900/30'
                }`}>
                  <FiActivity className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    session.type === 'running'
                      ? 'text-blue-600 dark:text-blue-400'
                      : session.type === 'gym'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                    {session.title}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                    {new Date(session.date).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:block sm:text-right">
                {session.time && (
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    {session.time.slice(0, 5)}
                  </p>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${
                  session.type === 'running'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : session.type === 'gym'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                  {session.type === 'running' ? 'Carrera' : session.type === 'gym' ? 'Gimnasio' : 'Cross'}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {upcomingSessions.length === 0 && (
          <div className="text-center py-12">
            <FiCalendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No hay entrenamientos esta semana
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Tu entrenador aún no ha creado un plan para esta semana
            </p>
          </div>
        )}
      </motion.div>

      {/* Two Column Layout: Competitions & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
        {/* Upcoming Competitions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiFlag className="w-5 h-5 mr-2 text-red-500" />
              Próximas Competiciones
            </h2>
          </div>

          {upcomingCompetitions.length > 0 ? (
            <div className="space-y-3">
              {upcomingCompetitions.map((competition) => {
                const eventDate = new Date(competition.event_date);
                const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={competition.id}
                    className="p-3 sm:p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-100 dark:border-red-800/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            competition.priority === 'A'
                              ? 'bg-red-500 text-white'
                              : competition.priority === 'B'
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-500 text-white'
                          }`}>
                            {competition.priority}
                          </span>
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {competition.name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center">
                            <FiCalendar className="w-3.5 h-3.5 mr-1" />
                            {eventDate.toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {competition.location && (
                            <span className="flex items-center truncate">
                              <FiMapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                              <span className="truncate">{competition.location}</span>
                            </span>
                          )}
                        </div>
                        {competition.distance_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {competition.distance_name}
                            {competition.distance_km && ` (${competition.distance_km} km)`}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{daysUntil}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">días</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiFlag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No hay competiciones programadas
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Tu entrenador añadirá tus próximos objetivos
              </p>
            </div>
          )}
        </motion.div>

        {/* Quick Access to Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <FiBarChart2 className="w-5 h-5 mr-2 text-blue-500" />
              Acceso Rápido
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/athlete/metrics"
              className="p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiBarChart2 className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Mis Métricas</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">VO2max, ritmos, progreso</p>
            </Link>

            <Link
              to="/athlete/devices"
              className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-100 dark:border-green-800/30 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiSmartphone className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Dispositivos</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Conecta tus dispositivos</p>
            </Link>

            <Link
              to="/athlete/messages"
              className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800/30 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiMessageSquare className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Mensajes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Chat con tu entrenador</p>
            </Link>

            <Link
              to="/athlete/calendar"
              className="p-4 bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 rounded-xl border border-orange-100 dark:border-orange-800/30 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiCalendar className="w-5 h-5 text-white" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Calendario</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vista mensual completa</p>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AthleteDashboard;
