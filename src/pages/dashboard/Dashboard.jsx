import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiTrendingUp,
  FiArrowRight,
  FiClock,
} from 'react-icons/fi';
import StatCard from '../../components/dashboard/StatCard';
import {
  getCoachStats,
  getTodaySessions,
  getRecentAthletes,
} from '../../services/dashboardService';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [recentAthletes, setRecentAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref to prevent double fetching
  const hasFetched = useRef(false);
  const currentProfileId = useRef(null);

  // Get display name
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Usuario';

  // Memoized load function
  const loadDashboardData = useCallback(async (profileId) => {
    if (!profileId) {
      console.log('Dashboard: No profileId, showing empty state');
      setStats({ totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 });
      setTodaySessions([]);
      setRecentAthletes([]);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches for same profile
    if (hasFetched.current && currentProfileId.current === profileId) {
      console.log('Dashboard: Already fetched for this profile, skipping');
      return;
    }

    console.log('Dashboard: Loading data for profile:', profileId);
    setLoading(true);
    setError(null);
    hasFetched.current = true;
    currentProfileId.current = profileId;

    try {
      // Fetch all data in parallel
      const [statsRes, sessionsRes, athletesRes] = await Promise.all([
        getCoachStats(profileId),
        getTodaySessions(profileId),
        getRecentAthletes(profileId, 5),
      ]);

      console.log('Dashboard: Data loaded successfully');

      setStats(statsRes.data || { totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 });
      setTodaySessions(sessionsRes.data || []);
      setRecentAthletes(athletesRes.data || []);
    } catch (err) {
      console.error('Dashboard: Error loading data:', err);
      setError(err.message);
      // Set empty state on error
      setStats({ totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 });
      setTodaySessions([]);
      setRecentAthletes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to load data when profile.id changes
  useEffect(() => {
    const profileId = profile?.id;

    // Only fetch if we have a profile ID and it's different from last fetch
    if (profileId && profileId !== currentProfileId.current) {
      hasFetched.current = false;
      loadDashboardData(profileId);
    } else if (!profileId && !hasFetched.current) {
      // No profile yet, show loading briefly then empty state
      const timer = setTimeout(() => {
        if (!profile?.id) {
          setLoading(false);
          setStats({ totalAthletes: 0, weekSessions: 0, completedSessions: 0, completionRate: 0 });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profile?.id, loadDashboardData]);

  const getStatusColor = (status) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      skipped: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
    };
    return colors[status] || colors.planned;
  };

  const getStatusLabel = (status) => {
    const labels = {
      planned: 'Planificado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      skipped: 'Omitido',
    };
    return labels[status] || status;
  };

  const getTrainingTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Entrenamiento Cruzado',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Bienvenido, {displayName}!
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Aquí tienes un resumen de tu actividad de entrenamiento
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">
            Error al cargar algunos datos. Por favor, recarga la página.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        <StatCard
          icon={FiUsers}
          title="Total Atletas"
          value={stats?.totalAthletes || 0}
          subtitle="Atletas activos"
          color="blue"
        />
        <StatCard
          icon={FiActivity}
          title="Sesiones Esta Semana"
          value={stats?.weekSessions || 0}
          subtitle="Programadas"
          color="purple"
        />
        <StatCard
          icon={FiCheckCircle}
          title="Completadas"
          value={stats?.completedSessions || 0}
          subtitle={`${stats?.completionRate || 0}% de cumplimiento`}
          color="green"
        />
        <StatCard
          icon={FiTrendingUp}
          title="Tasa de Finalización"
          value={`${stats?.completionRate || 0}%`}
          subtitle="Esta semana"
          color="orange"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Agenda */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <FiClock className="w-5 h-5 mr-2" />
                Agenda de Hoy
              </h2>
              <Link
                to="/dashboard/calendar"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center"
              >
                Ver calendario
                <FiArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {todaySessions.length === 0 ? (
              <div className="text-center py-12">
                <FiClock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay sesiones programadas para hoy
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <img
                        src={session.athleteImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.athleteName || 'A')}&background=random`}
                        alt={session.athleteName}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {session.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {session.athleteName} • {session.scheduled_time || 'Sin hora'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {getTrainingTypeLabel(session.training_type)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.status)}`}>
                        {getStatusLabel(session.status)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Access to Athletes */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Acceso Rápido
              </h2>
              <Link
                to="/dashboard/athletes"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center"
              >
                Ver todos
                <FiArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {recentAthletes.length === 0 ? (
              <div className="text-center py-8">
                <FiUsers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No hay atletas registrados
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAthletes.map((athlete) => (
                  <Link
                    key={athlete.id}
                    to={`/dashboard/athletes/${athlete.id}`}
                    className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <img
                      src={athlete.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent((athlete.firstName || 'A') + ' ' + (athlete.lastName || ''))}&background=random`}
                      alt={`${athlete.firstName} ${athlete.lastName}`}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {athlete.firstName} {athlete.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {athlete.specialties?.[0] || 'Sin especialidad'}
                      </p>
                    </div>
                    <FiArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
