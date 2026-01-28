import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiTrendingUp,
  FiCalendar,
  FiArrowRight,
  FiClock,
} from 'react-icons/fi';

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  
  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Atleta';

  // Datos de ejemplo - después se conectarán a Supabase
  const weekStats = {
    totalKm: 42.5,
    totalTime: '5h 30m',
    sessions: 5,
    avgPace: '4:30',
  };

  const upcomingSessions = [
    { id: 1, title: 'Series 10x400m', date: '2026-01-29', time: '07:00', type: 'running' },
    { id: 2, title: 'Rodaje Largo 20km', date: '2026-01-30', time: '08:00', type: 'running' },
    { id: 3, title: 'Fuerza General', date: '2026-01-31', time: '18:00', type: 'gym' },
  ];

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
              Total Histórico
            </h3>
            <div className="p-1.5 sm:p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            1,234 km
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Total acumulado
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
            Próximos Entrenamientos
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
            <div
              key={session.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors gap-3"
            >
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                  session.type === 'running' 
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : 'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  <FiActivity className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    session.type === 'running'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-purple-600 dark:text-purple-400'
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
                      month: 'long' 
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:block sm:text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                  {session.time}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  session.type === 'running'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                }`}>
                  {session.type === 'running' ? 'Carrera' : 'Gimnasio'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {upcomingSessions.length === 0 && (
          <div className="text-center py-12">
            <FiCalendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No hay entrenamientos programados
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AthleteDashboard;
