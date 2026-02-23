import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers,
  FiActivity,
  FiCheck,
  FiCheckCircle,
  FiTrendingUp,
  FiArrowRight,
  FiClock,
  FiX,
  FiCalendar,
  FiUser,
  FiChevronLeft,
  FiChevronRight,
  FiFlag,
  FiMapPin,
  FiPlus,
} from 'react-icons/fi';
import StatCard from '../../components/dashboard/StatCard';
import CreateCompetitionModal from '../../components/dashboard/CreateCompetitionModal';
import { toLocalDateStr } from '../../lib/dateUtils';
import useCoachDashboard from '../../hooks/useCoachDashboard';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { addAthletesToCompetition } from '../../services/athleteService';
import { getCoachAthletesList } from '../../services/planningService';
import { showSuccess, showError } from '../../lib/toast';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const {
    stats, recentAthletes, loading, error,
    currentWeekStart, weekSessions, weekCompetitions, upcomingCompetitions, weekLoading,
    goToPreviousWeek, goToNextWeek, goToCurrentWeek, refreshCompetitions,
  } = useCoachDashboard(profile?.id);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateCompetition, setShowCreateCompetition] = useState(false);
  const [showAddAthletes, setShowAddAthletes] = useState(false);
  const [allAthletes, setAllAthletes] = useState([]);
  const [addingAthleteIds, setAddingAthleteIds] = useState([]);
  const [savingAdd, setSavingAdd] = useState(false);

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

  // Group sessions with same title+date+type into one entry with multiple athletes
  const getGroupedSessionsForDate = (dateStr) => {
    const daySessions = weekSessions.filter(s => s.scheduled_date === dateStr);
    const groups = {};
    daySessions.forEach(s => {
      const key = `${s.title}||${s.training_type}||${s.description || ''}`;
      if (!groups[key]) {
        groups[key] = { ...s, athletes: [] };
      }
      groups[key].athletes.push({
        id: s.athlete_id,
        name: s.athleteName,
        image: s.athleteImage,
        status: s.status,
        sessionId: s.id,
      });
    });
    return Object.values(groups);
  };

  // Group week competitions by name+date+distance+location
  const getGroupedCompetitionsForDate = (dateStr) => {
    const dayComps = weekCompetitions.filter(c => c.event_date === dateStr);
    const groups = {};
    dayComps.forEach(c => {
      const key = `${c.name}||${c.event_date}||${c.distance_km || ''}||${c.location || ''}`;
      if (!groups[key]) {
        groups[key] = { ...c, isCompetition: true, athletes: [] };
      }
      groups[key].athletes.push({
        id: c.athlete_id,
        name: c.athleteName,
        image: c.athleteImage,
      });
    });
    return Object.values(groups);
  };

  // Group upcoming competitions by name+date+distance+location
  const getGroupedUpcomingCompetitions = () => {
    const groups = {};
    upcomingCompetitions.forEach(c => {
      const key = `${c.name}||${c.event_date}||${c.distance_km || ''}||${c.location || ''}`;
      if (!groups[key]) {
        groups[key] = { ...c, athletes: [] };
      }
      groups[key].athletes.push({
        id: c.athlete_id,
        name: c.athleteName,
        image: c.athleteImage,
      });
    });
    return Object.values(groups);
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

  const handleOpenAddAthletes = async (comp) => {
    setShowAddAthletes(true);
    setAddingAthleteIds([]);
    const { data } = await getCoachAthletesList(profile?.id);
    const assignedIds = new Set((comp.athletes || []).map(a => a.id));
    setAllAthletes((data || []).filter(a => !assignedIds.has(a.id)));
  };

  const handleConfirmAddAthletes = async () => {
    if (!addingAthleteIds.length || !selectedSession) return;
    setSavingAdd(true);
    const { error } = await addAthletesToCompetition(profile?.id, addingAthleteIds, {
      name: selectedSession.name,
      event_date: selectedSession.event_date,
      location: selectedSession.location,
      distance_km: selectedSession.distance_km,
      distance_name: selectedSession.distance_name,
      event_type: selectedSession.event_type,
      surface: selectedSession.surface,
      target_time_seconds: selectedSession.target_time_seconds,
      target_pace_seconds: selectedSession.target_pace_seconds,
      priority: selectedSession.priority,
      notes: selectedSession.notes,
    });
    setSavingAdd(false);
    if (error) {
      showError('Error al añadir atletas');
    } else {
      showSuccess(`${addingAthleteIds.length} atleta${addingAthleteIds.length > 1 ? 's' : ''} añadido${addingAthleteIds.length > 1 ? 's' : ''}`);
      setShowAddAthletes(false);
      setSelectedSession(null);
      refreshCompetitions();
    }
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
    <div className="p-4 sm:p-6 lg:p-8">
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
            ) : weekSessions.length === 0 && weekCompetitions.length === 0 ? (
              <div className="text-center py-12">
                <FiCalendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay eventos programados esta semana
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
                  {/* Day columns with sessions + competitions */}
                  {getWeekDays().map((day) => {
                    const grouped = getGroupedSessionsForDate(day.dateStr);
                    const comps = getGroupedCompetitionsForDate(day.dateStr);
                    return (
                      <div
                        key={`col-${day.dateStr}`}
                        className={`min-h-[100px] border-t border-gray-200 dark:border-gray-700 pt-1 px-0.5 ${
                          day.isToday ? 'bg-blue-50/50 dark:bg-blue-900/10 rounded-b-lg' : ''
                        }`}
                      >
                        {grouped.map((group, gi) => (
                          <motion.div
                            key={`s-${group.id}-${gi}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedSession(group)}
                            className={`mb-1 p-1.5 rounded-md border-l-3 cursor-pointer transition-all hover:shadow-md ${getTypeBorderColor(group.training_type)} ${getTypeBgColor(group.training_type)}`}
                          >
                            <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate leading-tight">
                              {group.title}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {group.athletes.length > 1
                                ? `${group.athletes.length} atletas`
                                : group.athletes[0]?.name?.split(' ')[0] || ''}
                            </p>
                          </motion.div>
                        ))}
                        {comps.map((comp, ci) => (
                          <motion.div
                            key={`c-${comp.id}-${ci}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedSession(comp)}
                            className="mb-1 p-1.5 rounded-md border-l-3 border-l-red-500 bg-red-50 dark:bg-red-900/20 cursor-pointer transition-all hover:shadow-md"
                          >
                            <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate leading-tight flex items-center">
                              <FiFlag className="w-3 h-3 mr-0.5 text-red-500 flex-shrink-0" />
                              {comp.name}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {comp.athletes.length > 1
                                ? `${comp.athletes.length} atletas`
                                : comp.athletes[0]?.name?.split(' ')[0] || ''}
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
                      const grouped = getGroupedSessionsForDate(day.dateStr);
                      const comps = getGroupedCompetitionsForDate(day.dateStr);
                      return grouped.length > 0 || comps.length > 0 || day.isToday;
                    })
                    .map((day) => {
                      const grouped = getGroupedSessionsForDate(day.dateStr);
                      const comps = getGroupedCompetitionsForDate(day.dateStr);
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
                          {grouped.length === 0 && comps.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 ml-9">
                              Sin eventos
                            </p>
                          ) : (
                            <div className="space-y-1.5 ml-9">
                              {grouped.map((group, gi) => (
                                <motion.div
                                  key={`s-${group.id}-${gi}`}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  onClick={() => setSelectedSession(group)}
                                  className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md ${getTypeBorderColor(group.training_type)} ${getTypeBgColor(group.training_type)}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                                      {group.title}
                                    </p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                      {group.athletes.length > 1
                                        ? `${group.athletes.length} atletas`
                                        : getStatusLabel(group.athletes[0]?.status || group.status)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {group.athletes.length > 1
                                      ? group.athletes.map(a => a.name?.split(' ')[0]).join(', ')
                                      : group.athletes[0]?.name || ''}
                                  </p>
                                </motion.div>
                              ))}
                              {comps.map((comp, ci) => (
                                <motion.div
                                  key={`c-${comp.id}-${ci}`}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  onClick={() => setSelectedSession(comp)}
                                  className="p-3 rounded-lg border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20 cursor-pointer transition-all hover:shadow-md"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 flex items-center">
                                      <FiFlag className="w-3.5 h-3.5 mr-1 text-red-500 flex-shrink-0" />
                                      {comp.name}
                                    </p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      {comp.athletes.length > 1
                                        ? `${comp.athletes.length} atletas`
                                        : 'Competición'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {comp.athletes.length > 1
                                      ? comp.athletes.map(a => a.name?.split(' ')[0]).join(', ')
                                      : comp.athletes[0]?.name || ''}
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

          {/* Próximos Eventos (Competitions) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <FiFlag className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" />
                <span className="truncate">Próximos Eventos</span>
              </h2>
              <button
                onClick={() => setShowCreateCompetition(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <FiPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nueva competición</span>
                <span className="sm:hidden">Nueva</span>
              </button>
            </div>

            {(() => {
              const grouped = getGroupedUpcomingCompetitions();
              if (grouped.length === 0) {
                return (
                  <div className="text-center py-8">
                    <FiFlag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No hay competiciones próximas
                    </p>
                    <button
                      onClick={() => setShowCreateCompetition(true)}
                      className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Crear una competición
                    </button>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grouped.slice(0, 6).map((comp, i) => {
                    const eventDate = new Date(comp.event_date + 'T00:00:00');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                    return (
                      <motion.div
                        key={`${comp.id}-${i}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setSelectedSession({ ...comp, isCompetition: true })}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate flex-1 mr-2">
                            {comp.name}
                          </h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium ${
                            diffDays <= 7
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : diffDays <= 30
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `${diffDays}d`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {comp.location && (
                            <span className="inline-flex items-center ml-2">
                              <FiMapPin className="w-3 h-3 mr-0.5" />
                              {comp.location}
                            </span>
                          )}
                        </p>
                        {comp.distance_km && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{comp.distance_km} km</p>
                        )}
                        <div className="flex items-center -space-x-2">
                          {comp.athletes.slice(0, 5).map((a) => (
                            <img
                              key={a.id}
                              src={a.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name || 'A')}&background=random&size=32`}
                              alt={a.name}
                              title={a.name}
                              className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800"
                            />
                          ))}
                          {comp.athletes.length > 5 && (
                            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">
                              +{comp.athletes.length - 5}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
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

      {/* Create Competition Modal */}
      <AnimatePresence>
        {showCreateCompetition && (
          <CreateCompetitionModal
            coachId={profile?.id}
            onCreated={refreshCompetitions}
            onClose={() => setShowCreateCompetition(false)}
          />
        )}
      </AnimatePresence>

      {/* Session/Competition Detail Modal */}
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
                    {selectedSession.isCompetition ? 'Detalles de Competición' : 'Detalles del Entrenamiento'}
                  </h3>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Date */}
                  <div className={`p-3 rounded-lg flex items-center space-x-3 ${
                    selectedSession.isCompetition
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}>
                    <FiCalendar className={`w-5 h-5 flex-shrink-0 ${
                      selectedSession.isCompetition
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        selectedSession.isCompetition
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}>
                        {new Date(
                          (selectedSession.isCompetition ? selectedSession.event_date : selectedSession.scheduled_date) + 'T00:00:00'
                        ).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      {!selectedSession.isCompetition && selectedSession.scheduled_time && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center mt-1">
                          <FiClock className="w-3 h-3 mr-1" />
                          {selectedSession.scheduled_time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedSession.isCompetition ? selectedSession.name : selectedSession.title}
                  </h4>

                  {/* Type & Status / Competition badge */}
                  {selectedSession.isCompetition ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full text-sm bg-red-500 text-white flex items-center space-x-1">
                        <FiFlag className="w-3 h-3" />
                        <span>Competición</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm text-white ${getTypeColor(selectedSession.training_type)}`}>
                        {getTrainingTypeLabel(selectedSession.training_type)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedSession.status)}`}>
                        {getStatusLabel(selectedSession.status)}
                      </span>
                    </div>
                  )}

                  {/* Athletes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedSession.athletes?.length > 1
                          ? `Asignado a ${selectedSession.athletes.length} atletas`
                          : 'Atleta'}
                      </p>
                      {selectedSession.isCompetition && (
                        <button
                          onClick={() => handleOpenAddAthletes(selectedSession)}
                          className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          <FiPlus className="w-3 h-3" />
                          Añadir atletas
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(selectedSession.athletes || [{ id: selectedSession.athlete_id, name: selectedSession.athleteName, image: selectedSession.athleteImage, status: selectedSession.status }]).map((athlete) => (
                        <Link
                          key={athlete.id}
                          to={`/dashboard/athletes/${athlete.id}`}
                          onClick={() => setSelectedSession(null)}
                          className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <img
                            src={athlete.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(athlete.name || 'A')}&background=random`}
                            alt={athlete.name}
                            className="w-9 h-9 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{athlete.name}</p>
                          </div>
                          {!selectedSession.isCompetition && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(athlete.status)}`}>
                              {getStatusLabel(athlete.status)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>

                    {/* Add athletes panel */}
                    {selectedSession.isCompetition && showAddAthletes && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Selecciona atletas a añadir:
                        </p>
                        {allAthletes.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                            Todos los atletas ya están asignados
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                            {allAthletes.map(a => {
                              const selected = addingAthleteIds.includes(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => setAddingAthleteIds(prev =>
                                    prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                                  )}
                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                    selected
                                      ? 'bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-600'
                                      : 'hover:bg-red-100/50 dark:hover:bg-red-900/30 border border-transparent'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                    selected ? 'bg-red-600 text-white' : 'border-2 border-gray-300 dark:border-gray-600'
                                  }`}>
                                    {selected && <FiCheck className="w-2.5 h-2.5" />}
                                  </div>
                                  <img
                                    src={a.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${a.first_name} ${a.last_name}`)}&background=random&size=32`}
                                    alt=""
                                    className="w-7 h-7 rounded-full"
                                  />
                                  <span className="text-gray-900 dark:text-white font-medium">{a.first_name} {a.last_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowAddAthletes(false)}
                            className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                          {allAthletes.length > 0 && (
                            <button
                              onClick={handleConfirmAddAthletes}
                              disabled={savingAdd || addingAthleteIds.length === 0}
                              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                            >
                              {savingAdd ? 'Guardando...' : `Añadir${addingAthleteIds.length > 0 ? ` (${addingAthleteIds.length})` : ''}`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Competition-specific fields */}
                  {selectedSession.isCompetition && (
                    <>
                      {selectedSession.distance_km && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FiActivity className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Distancia</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedSession.distance_km} km</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.location && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FiMapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Ubicación</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedSession.location}</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.notes && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas</p>
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.notes}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Training-specific fields */}
                  {!selectedSession.isCompetition && (
                    <>
                      {selectedSession.estimated_duration_minutes && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FiClock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Duración estimada</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedSession.estimated_duration_minutes} min</p>
                          </div>
                        </div>
                      )}
                      {selectedSession.description && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.description}</p>
                        </div>
                      )}
                      {selectedSession.notes_coach && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del entrenador</p>
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.notes_coach}</p>
                        </div>
                      )}
                      {selectedSession.notes_athlete && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del atleta</p>
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedSession.notes_athlete}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Cerrar
                  </button>
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
