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
} from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { getWeekStartDate } from '../../services/weeklyTrainingService';

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekStats, setWeekStats] = useState({
    totalKm: 0,
    totalTime: '0h 0m',
    sessions: 0,
    avgPace: '-',
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);

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
        .gte('scheduled_date', weekStart.toISOString().split('T')[0])
        .lte('scheduled_date', weekEnd.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true });

      if (weekError) throw weekError;

      // Fetch upcoming sessions (from start of current week onwards)
      // Show all sessions from this week, not just from today
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('athlete_id', profile.id)
        .gte('scheduled_date', weekStart.toISOString().split('T')[0])
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700"
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
    </div>
  );
};

export default AthleteDashboard;
