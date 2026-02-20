import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiTrendingUp,
  FiArrowRight,
  FiClock,
  FiX,
  FiCalendar,
  FiUser,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import StatCard from '../../components/dashboard/StatCard';
import { toLocalDateStr } from '../../lib/dateUtils';
import useCoachDashboard from '../../hooks/useCoachDashboard';
import { getWeekStartDate } from '../../services/weeklyTrainingService';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const {
    stats, recentAthletes, loading, error,
    currentWeekStart, weekSessions, weekLoading,
    goToPreviousWeek, goToNextWeek, goToCurrentWeek,
  } = useCoachDashboard(profile?.id);
  const [selectedSession, setSelectedSession] = useState(null);

  const displayName = profile?.first_name || user?.user_metadata?.first_name || 'Usuario';

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

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-500',
      gym: 'bg-purple-500',
      rest: 'bg-green-500',
      cross_training: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeBorderColor = (type) => {
    const colors = {
      running: 'border-l-blue-500',
      gym: 'border-l-purple-500',
      rest: 'border-l-green-500',
      cross_training: 'border-l-orange-500',
    };
    return colors[type] || 'border-l-gray-500';
  };

  const getTypeBgColor = (type) => {
    const colors = {
      running: 'bg-blue-50 dark:bg-blue-900/20',
      gym: 'bg-purple-50 dark:bg-purple-900/20',
      rest: 'bg-green-50 dark:bg-green-900/20',
      cross_training: 'bg-orange-50 dark:bg-orange-900/20',
    };
    return colors[type] || 'bg-gray-50 dark:bg-gray-900/20';
  };

  const getWeekDays = () => {
    const days = [];
    const todayStr = toLocalDateStr(new Date());
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = toLocalDateStr(d);
      days.push({
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: dateStr === todayStr,
      });
    }
    return days;
  };

  const getSessionsForDate = (dateStr) => {
    return weekSessions.filter(s => s.scheduled_date === dateStr);
  };

  const getWeekRangeLabel = () => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const startDay = currentWeekStart.getDate();
    const startMonth = months[currentWeekStart.getMonth()];
    const endDay = end.getDate();
    const endMonth = months[end.getMonth()];
    const year = end.getFullYear();
    if (currentWeekStart.getMonth() === end.getMonth()) {
      return `${startDay} - ${endDay} ${endMonth} ${year}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
  };

  const isCurrentWeek = () => {
    const now = getWeekStartDate(new Date());
    return toLocalDateStr(now) === toLocalDateStr(currentWeekStart);
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
        {/* Weekly Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <FiCalendar className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Agenda Semanal</span>
              </h2>
              <Link
                to="/dashboard/calendar"
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center whitespace-nowrap ml-2"
              >
                <span className="hidden sm:inline">Ver calendario</span>
                <span className="sm:hidden">Ver</span>
                <FiArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={goToPreviousWeek}
                  className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center whitespace-nowrap">
                  {getWeekRangeLabel()}
                </span>
                <button
                  onClick={goToNextWeek}
                  className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              {!isCurrentWeek() && (
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Hoy
                </button>
              )}
            </div>

            {weekLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : weekSessions.length === 0 ? (
              <div className="text-center py-12">
                <FiCalendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay sesiones programadas esta semana
                </p>
              </div>
            ) : (
              <>
                {/* Desktop: 7-column grid */}
                <div className="hidden sm:grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {getWeekDays().map((day) => (
                    <div key={day.dateStr} className="text-center pb-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {day.dayName}
                      </p>
                      <div
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                          day.isToday
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {day.dayNumber}
                      </div>
                    </div>
                  ))}
                  {/* Day columns with sessions */}
                  {getWeekDays().map((day) => {
                    const daySessions = getSessionsForDate(day.dateStr);
                    return (
                      <div
                        key={`col-${day.dateStr}`}
                        className={`min-h-[100px] border-t border-gray-200 dark:border-gray-700 pt-1 px-0.5 ${
                          day.isToday ? 'bg-blue-50/50 dark:bg-blue-900/10 rounded-b-lg' : ''
                        }`}
                      >
                        {daySessions.map((session) => (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedSession(session)}
                            className={`mb-1 p-1.5 rounded-md border-l-3 cursor-pointer transition-all hover:shadow-md ${getTypeBorderColor(session.training_type)} ${getTypeBgColor(session.training_type)}`}
                          >
                            <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate leading-tight">
                              {session.title}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {session.scheduled_time ? session.scheduled_time.slice(0, 5) : ''} {session.athleteName?.split(' ')[0]}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Mobile: Stacked list by day */}
                <div className="sm:hidden space-y-3">
                  {getWeekDays()
                    .filter((day) => {
                      const daySessions = getSessionsForDate(day.dateStr);
                      return daySessions.length > 0 || day.isToday;
                    })
                    .map((day) => {
                      const daySessions = getSessionsForDate(day.dateStr);
                      return (
                        <div key={day.dateStr}>
                          <div className="flex items-center space-x-2 mb-2">
                            <div
                              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                                day.isToday
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {day.dayNumber}
                            </div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              {day.dayName}
                            </span>
                            {day.isToday && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Hoy
                              </span>
                            )}
                          </div>
                          {daySessions.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 ml-9">
                              Sin sesiones
                            </p>
                          ) : (
                            <div className="space-y-1.5 ml-9">
                              {daySessions.map((session) => (
                                <motion.div
                                  key={session.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  onClick={() => setSelectedSession(session)}
                                  className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md ${getTypeBorderColor(session.training_type)} ${getTypeBgColor(session.training_type)}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                                      {session.title}
                                    </p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 ${getStatusColor(session.status)}`}>
                                      {getStatusLabel(session.status)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {session.athleteName} {session.scheduled_time ? `• ${session.scheduled_time.slice(0, 5)}` : ''}
                                  </p>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Access to Athletes */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Mis Atletas
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

      {/* Session Detail Modal */}
      <AnimatePresence>
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Detalles del Entrenamiento
                  </h3>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Date & Time */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center space-x-3">
                    <FiCalendar className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {new Date(selectedSession.scheduled_date).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      {selectedSession.scheduled_time && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center mt-1">
                          <FiClock className="w-3 h-3 mr-1" />
                          {selectedSession.scheduled_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedSession.title}
                  </h4>

                  {/* Type & Status */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm text-white ${getTypeColor(selectedSession.training_type)}`}>
                      {getTrainingTypeLabel(selectedSession.training_type)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedSession.status)}`}>
                      {getStatusLabel(selectedSession.status)}
                    </span>
                  </div>

                  {/* Athlete */}
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <img
                      src={selectedSession.athleteImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSession.athleteName || 'A')}&background=random`}
                      alt={selectedSession.athleteName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Atleta</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedSession.athleteName}</p>
                    </div>
                  </div>

                  {/* Duration */}
                  {selectedSession.estimated_duration_minutes && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <FiClock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Duración estimada</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedSession.estimated_duration_minutes} min</p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedSession.description && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.description}</p>
                    </div>
                  )}

                  {/* Coach notes */}
                  {selectedSession.notes_coach && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del entrenador</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.notes_coach}</p>
                    </div>
                  )}

                  {/* Athlete notes */}
                  {selectedSession.notes_athlete && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del atleta</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.notes_athlete}</p>
                    </div>
                  )}

                  {/* Link to athlete profile */}
                  <Link
                    to={`/dashboard/athletes/${selectedSession.athlete_id}`}
                    onClick={() => setSelectedSession(null)}
                    className="flex items-center justify-center space-x-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    <FiUser className="w-4 h-4" />
                    <span>Ver perfil del atleta</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
