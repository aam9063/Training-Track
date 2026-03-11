import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiCalendar,
  FiClock,
  FiUser,
  FiMapPin,
  FiActivity,
  FiFlag,
  FiCheck,
  FiSkipForward,
} from 'react-icons/fi';
import { getMonthSessions, rescheduleSession } from '../../services/calendarService';
import { getAthletes } from '../../services/athleteService';
import { supabase } from '../../lib/supabase';
import { toLocalDateStr, inferTrainingType } from '../../lib/dateUtils';
import { RPE_OPTIONS } from '../../services/rpeService';
import { showSuccess, showError } from '../../lib/toast';
import useCalendarData from '../../hooks/useCalendarData';
import WeeklyDesktopView from '../../components/calendar/WeeklyDesktopView';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Mobile mini-calendar date dot indicators
const getDotsForDate = (events) => {
  if (!events.length) return [];
  const dots = [];
  const hasComp = events.some(e => e.isCompetition);
  const hasCompleted = events.some(e => !e.isCompetition && e.status === 'completed');
  const hasPlanned = events.some(e => !e.isCompetition && e.status === 'planned');
  const hasSkipped = events.some(e => !e.isCompetition && e.status === 'skipped');

  if (hasComp) dots.push('bg-red-500');
  if (hasCompleted) dots.push('bg-green-500');
  if (hasPlanned) dots.push('bg-blue-500');
  if (hasSkipped) dots.push('bg-gray-400');
  return dots.slice(0, 3);
};

const Calendar = () => {
  const { profile } = useAuth();

  const fetchCoachCalendar = useCallback(async (coachId, year, month, startDate, endDate) => {
    const [sessionsRes, athletesRes] = await Promise.all([
      getMonthSessions(coachId, year, month, startDate, endDate),
      getAthletes(coachId),
    ]);

    let comps = [];
    if (athletesRes.data?.length > 0) {
      const athleteIds = athletesRes.data.map(a => a.id);
      const { data: compsData, error: compsError } = await supabase
        .from('competitions')
        .select('*')
        .in('athlete_id', athleteIds)
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true });

      if (!compsError && compsData) {
        comps = compsData.map(comp => {
          const athlete = athletesRes.data.find(a => a.id === comp.athlete_id);
          return {
            ...comp,
            athleteName: athlete
              ? `${athlete.firstName || athlete.first_name || ''} ${athlete.lastName || athlete.last_name || ''}`.trim()
              : 'Atleta',
            athleteImage: athlete?.profile_image || athlete?.profileImage || null,
            isCompetition: true,
          };
        });
      }
    }

    return { sessions: sessionsRes.data || [], competitions: comps };
  }, []);

  const {
    currentDate, setCurrentDate, sessions, competitions, loading, loadData,
    goToPreviousMonth, goToNextMonth, goToToday,
  } = useCalendarData(profile?.id, fetchCoachCalendar);

  // When the weekly view navigates to a different month, reload data
  const handleWeekMonthChange = useCallback((weekStartDate) => {
    const weekMonth = weekStartDate.getMonth();
    const weekYear = weekStartDate.getFullYear();
    // If visible week is in a different month, update currentDate to trigger data reload
    if (weekMonth !== currentDate.getMonth() || weekYear !== currentDate.getFullYear()) {
      setCurrentDate(new Date(weekStartDate));
    }
  }, [currentDate, setCurrentDate]);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Mobile: selected day for the list view (defaults to today)
  const [mobileSelectedDate, setMobileSelectedDate] = useState(() => new Date());

  // Mobile reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Desktop DnD handler (via WeeklyDesktopView)
  const handleDesktopReschedule = async (draggedEvent, targetDateStr) => {
    const { error } = await rescheduleSession(draggedEvent.id, targetDateStr);
    if (error) {
      showError('Error al reprogramar la sesión');
    } else {
      showSuccess('Sesión reprogramada');
    }
    loadData();
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toLocalDateStr(date);

    const daySessions = sessions.filter((s) => s.date === dateStr);
    const groups = {};
    daySessions.forEach(s => {
      const key = `${s.title}||${s.training_type}||${s.description || ''}`;
      if (!groups[key]) groups[key] = { ...s, isCompetition: false, athletes: [] };
      groups[key].athletes.push({
        id: s.athleteId, name: s.athleteName, image: s.athleteImage, status: s.status, sessionId: s.id,
      });
    });
    const groupedSessions = Object.values(groups);

    const dayComps = competitions.filter((c) => c.event_date === dateStr);
    const compGroups = {};
    dayComps.forEach(c => {
      const key = `${c.name}||${c.event_date}||${c.distance_km || ''}||${c.location || ''}`;
      if (!compGroups[key]) compGroups[key] = { ...c, isCompetition: true, athletes: [] };
      compGroups[key].athletes.push({ id: c.athlete_id, name: c.athleteName, image: c.athleteImage });
    });
    const groupedComps = Object.values(compGroups);

    return [...groupedSessions, ...groupedComps];
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (a, b) => {
    if (!a || !b) return false;
    return a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();
  };

  const handleDateClick = (date, e) => {
    if (!date) return;
    if (e.target.closest('.event-pill')) return;
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setShowDayModal(true);
    }
  };

  const handleEventClick = (event, e) => {
    if (e) e.stopPropagation();
    setSelectedEvent(event);
    setShowDayModal(false);
    setShowReschedule(false);
    setRescheduleDate('');
    setShowEventModal(true);
  };

  const handleMobileEventClick = (event) => {
    setSelectedEvent(event);
    setShowReschedule(false);
    setRescheduleDate('');
    setShowEventModal(true);
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleDate || !selectedEvent) return;
    setRescheduling(true);
    const { error } = await rescheduleSession(selectedEvent.id, rescheduleDate);
    if (error) {
      showError('Error al reprogramar la sesión');
    } else {
      showSuccess('Sesión reprogramada');
      setShowEventModal(false);
      setSelectedEvent(null);
      setShowReschedule(false);
      setRescheduleDate('');
      loadData();
    }
    setRescheduling(false);
  };

  const getTypeColor = (event) => {
    const t = typeof event === 'string' ? event : inferTrainingType(event);
    const colors = { running: 'bg-blue-500', gym: 'bg-orange-500', rest: 'bg-teal-500', cross_training: 'bg-orange-500', bike: 'bg-yellow-500' };
    return colors[t] || 'bg-gray-500';
  };

  const getTypeBorder = (event) => {
    const t = typeof event === 'string' ? event : inferTrainingType(event);
    const colors = { running: 'border-blue-500', gym: 'border-orange-500', rest: 'border-teal-500', cross_training: 'border-orange-500', bike: 'border-yellow-500' };
    return colors[t] || 'border-gray-500';
  };

  const getTypeLabel = (event) => {
    const t = typeof event === 'string' ? event : inferTrainingType(event);
    const labels = { running: 'Carrera', gym: 'Fuerza', rest: 'Descanso', cross_training: 'Cross-training', bike: 'Bici / Rodillo' };
    return labels[t] || t;
  };

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
    const labels = { planned: 'Planificado', in_progress: 'En Progreso', completed: 'Completado', skipped: 'Omitido' };
    return labels[status] || status;
  };

  const days = getDaysInMonth(currentDate);
  const mobileEvents = getEventsForDate(mobileSelectedDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Calendario</h1>
        <p className="text-gray-600 dark:text-gray-400">Entrenamientos y competiciones de tus atletas</p>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE VIEW (hidden on md+)
      ═══════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        {/* Month nav + compact mini-calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={() => { goToToday(); setMobileSelectedDate(new Date()); }}
                className="px-2.5 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Hoy
              </button>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Compact grid */}
          <div className="p-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">
                  {d[0]}
                </div>
              ))}
            </div>

            {/* Day cells — compact, dot indicators */}
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                if (!date) return <div key={index} />;
                const dayEvents = getEventsForDate(date);
                const dots = getDotsForDate(dayEvents);
                const today = isToday(date);
                const isSelected = isSameDay(date, mobileSelectedDate);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setMobileSelectedDate(new Date(date))}
                    className="flex flex-col items-center py-1.5 rounded-lg transition-colors"
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : today
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}>
                      {date.getDate()}
                    </span>
                    {/* Event dots */}
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dots.map((color, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${color}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected day event list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Day header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
              {mobileSelectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {mobileEvents.length === 0
                ? 'Sin eventos'
                : `${mobileEvents.length} evento${mobileEvents.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {mobileEvents.length === 0 ? (
            <div className="py-10 text-center">
              <FiCalendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No hay eventos este día</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {mobileEvents.map((event, i) => {
                const isComp = event.isCompetition;
                const borderColor = isComp ? 'border-red-500' : getTypeBorder(event);
                const athleteLabel = event.athletes?.length > 1
                  ? `${event.athletes.length} atletas`
                  : event.athletes?.[0]?.name || event.athleteName || '';

                return (
                  <button
                    key={event.id || i}
                    type="button"
                    onClick={() => handleMobileEventClick(event)}
                    className={`w-full text-left px-4 py-3.5 border-l-4 ${borderColor} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isComp && <FiFlag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          {!isComp && event.status === 'completed' && <FiCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          {!isComp && event.status === 'skipped' && <FiSkipForward className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {isComp ? event.name : event.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {event.time && !isComp && (
                            <span className="flex items-center gap-1">
                              <FiClock className="w-3 h-3" />
                              {event.time.slice(0, 5)}
                            </span>
                          )}
                          {athleteLabel && (
                            <span className="flex items-center gap-1 truncate">
                              <FiUser className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{athleteLabel}</span>
                            </span>
                          )}
                          {event.estimated_duration_minutes && (
                            <span>{event.estimated_duration_minutes}min</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isComp ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Competición
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(event.status)}`}>
                            {getStatusLabel(event.status)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isComp && event.distance_km && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <FiActivity className="w-3 h-3" />
                        {event.distance_km} km{event.location ? ` · ${event.location}` : ''}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile legend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Carrera</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Fuerza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Bici / Rodillo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Descanso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Competición</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Completado</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP VIEW (hidden on mobile)
      ═══════════════════════════════════════════ */}
      <div className="hidden md:block">
        <WeeklyDesktopView
          sessions={sessions}
          competitions={competitions}
          getEventsForDate={getEventsForDate}
          onEventClick={handleEventClick}
          onReschedule={handleDesktopReschedule}
          onMonthChange={handleWeekMonthChange}
          loadData={loadData}
          isCoach={true}
          accentColor="blue"
        />
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP: Day Events List Modal
      ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {showDayModal && selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {getEventsForDate(selectedDate).length} evento{getEventsForDate(selectedDate).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button onClick={() => setShowDayModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event, i) => (
                    <button
                      key={event.id || i}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${event.isCompetition ? 'bg-red-500' : getTypeColor(event)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {event.isCompetition ? event.name : event.title}
                            </p>
                            {!event.isCompetition && event.time && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">{event.time.slice(0, 5)}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                            <FiUser className="w-3 h-3" />
                            <span className="truncate">
                              {event.athletes?.length > 1 ? `${event.athletes.length} atletas` : event.athletes?.[0]?.name || event.athleteName}
                            </span>
                          </div>
                          {!event.isCompetition && (
                            <div className="flex items-center space-x-2 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getTypeColor(event)}`}>{getTypeLabel(event)}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(event.status)}`}>{getStatusLabel(event.status)}</span>
                              {event.status === 'completed' && event.rpe_score && (
                                <span className="text-sm">{RPE_OPTIONS.find(r => r.score === event.rpe_score)?.emoji}</span>
                              )}
                            </div>
                          )}
                          {event.isCompetition && (
                            <div className="flex items-center space-x-2 mt-2">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Competición</span>
                              {event.distance_km && <span className="text-xs text-gray-500 dark:text-gray-400">{event.distance_km} km</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════
          EVENT DETAIL — Bottom sheet on mobile, modal on desktop
      ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {showEventModal && selectedEvent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => { setShowEventModal(false); setSelectedEvent(null); setShowReschedule(false); }}
            />

            {/* Sheet: slides up on mobile, centered on desktop */}
            <motion.div
              initial={{ y: '100%', opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 1 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
              <EventDetailContent
                event={selectedEvent}
                showReschedule={showReschedule}
                setShowReschedule={setShowReschedule}
                rescheduleDate={rescheduleDate}
                setRescheduleDate={setRescheduleDate}
                rescheduling={rescheduling}
                onRescheduleConfirm={handleRescheduleConfirm}
                onClose={() => { setShowEventModal(false); setSelectedEvent(null); setShowReschedule(false); }}
                getTypeColor={getTypeColor}
                getTypeLabel={getTypeLabel}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
                isCoach
              />
            </motion.div>

            {/* Desktop centered modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <EventDetailContent
                  event={selectedEvent}
                  showReschedule={false}
                  setShowReschedule={() => {}}
                  rescheduleDate=""
                  setRescheduleDate={() => {}}
                  rescheduling={false}
                  onRescheduleConfirm={() => {}}
                  onClose={() => { setShowEventModal(false); setSelectedEvent(null); }}
                  getTypeColor={getTypeColor}
                  getTypeLabel={getTypeLabel}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                  isCoach
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Shared event detail content component
const EventDetailContent = ({
  event, showReschedule, setShowReschedule, rescheduleDate, setRescheduleDate,
  rescheduling, onRescheduleConfirm, onClose, getTypeColor, getTypeLabel,
  getStatusColor, getStatusLabel, isCoach,
}) => {
  const canReschedule = isCoach && !event.isCompetition && event.athletes?.length <= 1 && event.status === 'planned';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {event.isCompetition ? 'Detalles de Competición' : 'Detalles del Entrenamiento'}
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <FiX className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Date & Time */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center space-x-3">
          <FiCalendar className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {new Date(event.isCompetition ? event.event_date : event.date).toLocaleDateString('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
            {!event.isCompetition && event.time && (
              <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center mt-1">
                <FiClock className="w-3 h-3 mr-1" />{event.time.slice(0, 5)}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          {event.isCompetition ? event.name : event.title}
        </h4>

        {/* Type & Status */}
        {!event.isCompetition && (
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm text-white ${getTypeColor(event)}`}>{getTypeLabel(event)}</span>
            <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(event.status)}`}>{getStatusLabel(event.status)}</span>
          </div>
        )}

        {event.isCompetition && (
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-sm bg-red-500 text-white flex items-center space-x-1">
              <FiFlag className="w-3 h-3" /><span>Competición</span>
            </span>
          </div>
        )}

        {/* Athletes */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {event.athletes?.length > 1 ? `Asignado a ${event.athletes.length} atletas` : 'Atleta'}
          </p>
          <div className="space-y-2">
            {(event.athletes || [{ id: event.athleteId, name: event.athleteName, image: event.athleteImage, status: event.status }]).map((athlete) => (
              <Link
                key={athlete.id}
                to={`/dashboard/athletes/${athlete.id}`}
                onClick={onClose}
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(athlete.status)}`}>
                  {getStatusLabel(athlete.status)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Competition fields */}
        {event.isCompetition && (
          <>
            {event.distance_km && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <FiActivity className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Distancia</p>
                  <p className="font-medium text-gray-900 dark:text-white">{event.distance_km} km</p>
                </div>
              </div>
            )}
            {event.location && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <FiMapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ubicación</p>
                  <p className="font-medium text-gray-900 dark:text-white">{event.location}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Duration */}
        {!event.isCompetition && event.estimated_duration_minutes && (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <FiClock className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Duración estimada</p>
              <p className="font-medium text-gray-900 dark:text-white">{event.estimated_duration_minutes} min</p>
            </div>
          </div>
        )}

        {/* Description / Notes */}
        {(event.description || event.notes) && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{event.isCompetition ? 'Notas' : 'Descripción'}</p>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{event.description || event.notes}</p>
          </div>
        )}

        {!event.isCompetition && event.notes_coach && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del entrenador</p>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{event.notes_coach}</p>
          </div>
        )}

        {!event.isCompetition && event.notes_athlete && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del atleta</p>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{event.notes_athlete}</p>
          </div>
        )}

        {/* RPE (completed) */}
        {!event.isCompetition && event.status === 'completed' && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
            {event.rpe_score && (() => {
              const rpe = RPE_OPTIONS.find(r => r.score === event.rpe_score);
              return (
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{rpe?.emoji || ''}</span>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">RPE: {rpe?.label || event.rpe_score}/5</span>
                </div>
              );
            })()}
            {event.rpe_notes && <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">{event.rpe_notes}</p>}
            {event.actual_duration_minutes && (
              <div className="flex items-center space-x-2 text-sm text-green-700 dark:text-green-300">
                <FiClock className="w-3 h-3" />
                <span>Duración real: {event.actual_duration_minutes} min</span>
              </div>
            )}
          </div>
        )}

        {!event.isCompetition && event.status === 'skipped' && (
          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sesión omitida por el atleta</p>
          </div>
        )}

        {/* Reschedule section (mobile coach only) */}
        {canReschedule && (
          <div className="pt-2">
            {!showReschedule ? (
              <button
                type="button"
                onClick={() => setShowReschedule(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-sm font-medium"
              >
                <FiCalendar className="w-4 h-4" />
                Reprogramar sesión
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nueva fecha</p>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={toLocalDateStr(new Date())}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReschedule(false); setRescheduleDate(''); }}
                    className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onRescheduleConfirm}
                    disabled={!rescheduleDate || rescheduling}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {rescheduling ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
