import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiActivity,
  FiFlag,
  FiCheck,
  FiSkipForward,
} from 'react-icons/fi';
import { getAthleteMonthSessions, rescheduleSession } from '../../services/calendarService';
import { supabase } from '../../lib/supabase';
import { toLocalDateStr, inferTrainingType } from '../../lib/dateUtils';
import { RPE_OPTIONS } from '../../services/rpeService';
import { showSuccess, showError } from '../../lib/toast';

import WeeklyDesktopView from '../../components/calendar/WeeklyDesktopView';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Mobile dot indicators
const getDotsForDate = (events) => {
  if (!events.length) return [];
  const dots = [];
  if (events.some(e => e.isCompetition)) dots.push('bg-red-500');
  if (events.some(e => !e.isCompetition && e.status === 'completed')) dots.push('bg-green-500');
  if (events.some(e => !e.isCompetition && e.status === 'planned')) dots.push('bg-blue-500');
  if (events.some(e => !e.isCompetition && e.status === 'skipped')) dots.push('bg-gray-400');
  return dots.slice(0, 3);
};

const AthleteCalendar = () => {
  const { profile } = useAuth();
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [sessions, setSessions] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentDate = new Date(calYear, calMonth, 1);

  const goToPreviousMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const goToToday = () => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); };
  const setCurrentDate = (d) => {
    const date = typeof d === 'function' ? d(currentDate) : d;
    setCalMonth(date.getMonth());
    setCalYear(date.getFullYear());
  };

  const loadData = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const month = calMonth + 1;
      const padStart = new Date(calYear, calMonth, 1);
      padStart.setDate(padStart.getDate() - 7);
      const padEnd = new Date(calYear, calMonth + 1, 0);
      padEnd.setDate(padEnd.getDate() + 7);
      const startDate = toLocalDateStr(padStart);
      const endDate = toLocalDateStr(padEnd);

      const [sessionsRes, compsRes] = await Promise.all([
        getAthleteMonthSessions(profile.id, calYear, month, startDate, endDate),
        supabase
          .from('competitions')
          .select('*')
          .eq('athlete_id', profile.id)
          .gte('event_date', startDate)
          .lte('event_date', endDate)
          .order('event_date', { ascending: true }),
      ]);
      if (sessionsRes?.error || compsRes?.error) throw new Error('Error cargando calendario');
      setSessions(sessionsRes?.data || []);
      setCompetitions((compsRes?.data || []).map(c => ({ ...c, isCompetition: true })));
    } catch {
      setSessions([]);
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, calMonth, calYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Mobile selected day
  const [mobileSelectedDate, setMobileSelectedDate] = useState(() => new Date());

  // Mobile reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Desktop DnD handler (via WeeklyDesktopView)
  const handleDesktopReschedule = async (draggedEvent, targetDateStr) => {
    const { error } = await rescheduleSession(draggedEvent.id, targetDateStr);
    if (error) showError('Error al reprogramar la sesión');
    else showSuccess('Sesión reprogramada');
    loadData();
  };

  // When the weekly view navigates to a different month (desktop only)
  const handleWeekMonthChange = useCallback((weekStartDate) => {
    setCalMonth(weekStartDate.getMonth());
    setCalYear(weekStartDate.getFullYear());
  }, []);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day));
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toLocalDateStr(date);

    const daySessions = sessions
      .filter((s) => s.date === dateStr)
      .map(s => ({ ...s, isCompetition: false }));

    const dayComps = competitions
      .filter((c) => c.event_date === dateStr)
      .map(c => ({ ...c, isCompetition: true }));

    return [...daySessions, ...dayComps];
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
      skipped: 'bg-gray-100 text-gray-700 dark:bg-[#242424] dark:text-gray-400',
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ath-accent mx-auto"></div>
          <p className="mt-4 text-ath-text-secondary">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ath-text-primary mb-2">Mi Calendario</h1>
        <p className="text-ath-text-secondary">Tus entrenamientos y competiciones</p>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE VIEW (hidden on md+)
      ═══════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        {/* Mini calendar */}
        <div className="bg-ath-surface rounded-xl shadow-sm border border-ath-border overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ath-border">
            <button onClick={goToPreviousMonth} className="p-2 hover:bg-ath-inset rounded-lg transition-colors">
              <FiChevronLeft className="w-5 h-5 text-ath-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-ath-text-primary">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={() => { goToToday(); setMobileSelectedDate(new Date()); }}
                className="px-2.5 py-1 text-xs bg-ath-accent-surface text-ath-accent-text rounded-lg hover:bg-ath-accent/20 transition-colors"
              >
                Hoy
              </button>
            </div>
            <button onClick={goToNextMonth} className="p-2 hover:bg-ath-inset rounded-lg transition-colors">
              <FiChevronRight className="w-5 h-5 text-ath-text-secondary" />
            </button>
          </div>

          {/* Compact grid */}
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-ath-text-muted py-1">
                  {d[0]}
                </div>
              ))}
            </div>
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
                        ? 'bg-ath-accent text-ath-on-accent'
                        : today
                          ? 'bg-ath-accent-surface text-ath-accent-text font-bold'
                          : 'text-ath-text-secondary hover:bg-ath-inset'
                    }`}>
                      {date.getDate()}
                    </span>
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
        <div className="bg-ath-surface rounded-xl shadow-sm border border-ath-border overflow-hidden">
          <div className="px-4 py-3 border-b border-ath-border">
            <p className="text-sm font-semibold text-ath-text-primary capitalize">
              {mobileSelectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-xs text-ath-text-muted mt-0.5">
              {mobileEvents.length === 0
                ? 'Sin eventos'
                : `${mobileEvents.length} evento${mobileEvents.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {mobileEvents.length === 0 ? (
            <div className="py-10 text-center">
              <FiCalendar className="w-8 h-8 text-ath-text-muted mx-auto mb-2" />
              <p className="text-sm text-ath-text-muted">No hay eventos este día</p>
            </div>
          ) : (
            <div className="divide-y divide-ath-border">
              {mobileEvents.map((event, i) => {
                const isComp = event.isCompetition;
                const borderColor = isComp ? 'border-red-500' : getTypeBorder(event);

                return (
                  <button
                    key={event.id || i}
                    type="button"
                    onClick={() => handleMobileEventClick(event)}
                    className={`w-full text-left px-4 py-3.5 border-l-4 ${borderColor} hover:bg-ath-inset transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isComp && <FiFlag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          {!isComp && event.status === 'completed' && <FiCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          {!isComp && event.status === 'skipped' && <FiSkipForward className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                          <p className="text-sm font-semibold text-ath-text-primary truncate">
                            {isComp ? event.name : event.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ath-text-muted">
                          {event.time && !isComp && (
                            <span className="flex items-center gap-1">
                              <FiClock className="w-3 h-3" />{event.time.slice(0, 5)}
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
        <div className="bg-ath-surface rounded-xl shadow-sm border border-ath-border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-ath-text-secondary">Carrera</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs text-ath-text-secondary">Fuerza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-xs text-ath-text-secondary">Bici / Rodillo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-xs text-ath-text-secondary">Descanso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-ath-text-secondary">Competición</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-ath-text-secondary">Completado</span>
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
          isCoach={false}
          accentColor="green"
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
              className="bg-ath-surface rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-ath-text-primary">
                      {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <p className="text-sm text-ath-text-muted mt-1">
                      {getEventsForDate(selectedDate).length} evento{getEventsForDate(selectedDate).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button onClick={() => setShowDayModal(false)} className="p-2 hover:bg-ath-inset rounded-lg transition-colors">
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event, i) => (
                    <button
                      key={event.id || i}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left p-4 rounded-lg border border-ath-border hover:border-green-500 dark:hover:border-green-500 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${event.isCompetition ? 'bg-red-500' : getTypeColor(event)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-ath-text-primary truncate">
                              {event.isCompetition ? event.name : event.title}
                            </p>
                            {!event.isCompetition && event.time && (
                              <span className="text-xs text-ath-text-muted ml-2 flex-shrink-0">{event.time.slice(0, 5)}</span>
                            )}
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
                              {event.distance_km && <span className="text-xs text-ath-text-muted">{event.distance_km} km</span>}
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

            {/* Mobile bottom sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-ath-surface rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-ath-border rounded-full" />
              </div>
              <AthleteEventDetailContent
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
                className="bg-ath-surface rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <AthleteEventDetailContent
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
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Athlete event detail content
const AthleteEventDetailContent = ({
  event, showReschedule, setShowReschedule, rescheduleDate, setRescheduleDate,
  rescheduling, onRescheduleConfirm, onClose, getTypeColor, getTypeLabel,
  getStatusColor, getStatusLabel,
}) => {
  const canReschedule = !event.isCompetition && event.status === 'planned';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-ath-text-primary">
          {event.isCompetition ? 'Detalles de Competición' : 'Detalles del Entrenamiento'}
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-ath-inset rounded-lg transition-colors">
          <FiX className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Date & Time */}
        <div className="p-3 bg-ath-accent-surface rounded-lg flex items-center space-x-3">
          <FiCalendar className="w-5 h-5 text-ath-accent-text flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-ath-accent-text">
              {new Date(event.isCompetition ? event.event_date : event.date).toLocaleDateString('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
            {!event.isCompetition && event.time && (
              <p className="text-sm text-ath-accent-text flex items-center mt-1">
                <FiClock className="w-3 h-3 mr-1" />{event.time.slice(0, 5)}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-lg font-semibold text-ath-text-primary">
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
            <span className="px-3 py-1 rounded-full text-sm bg-red-500 text-white flex items-center gap-1">
              <FiFlag className="w-3 h-3" />Competición
            </span>
            {event.priority && (
              <span className={`px-3 py-1 rounded-full text-sm text-white ${
                event.priority === 'A' ? 'bg-red-500' : event.priority === 'B' ? 'bg-orange-500' : 'bg-gray-500'
              }`}>
                Prioridad {event.priority}
              </span>
            )}
          </div>
        )}

        {/* Competition fields */}
        {event.isCompetition && (
          <>
            {event.distance_km && (
              <div className="flex items-center space-x-3 p-3 bg-ath-inset rounded-lg">
                <FiActivity className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-ath-text-muted">Distancia</p>
                  <p className="font-medium text-ath-text-primary">
                    {event.distance_name ? `${event.distance_name} (${event.distance_km} km)` : `${event.distance_km} km`}
                  </p>
                </div>
              </div>
            )}
            {event.location && (
              <div className="flex items-center space-x-3 p-3 bg-ath-inset rounded-lg">
                <FiMapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-ath-text-muted">Ubicación</p>
                  <p className="font-medium text-ath-text-primary">{event.location}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Duration */}
        {!event.isCompetition && event.estimated_duration_minutes && (
          <div className="flex items-center space-x-3 p-3 bg-ath-inset rounded-lg">
            <FiClock className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-ath-text-muted">Duración estimada</p>
              <p className="font-medium text-ath-text-primary">{event.estimated_duration_minutes} min</p>
            </div>
          </div>
        )}

        {/* Description */}
        {(event.description || event.notes) && (
          <div>
            <p className="text-sm text-ath-text-muted mb-1">{event.isCompetition ? 'Notas' : 'Descripción'}</p>
            <p className="text-ath-text-primary whitespace-pre-wrap">{event.description || event.notes}</p>
          </div>
        )}

        {!event.isCompetition && event.notes_coach && (
          <div>
            <p className="text-sm text-ath-text-muted mb-1">Notas del entrenador</p>
            <p className="text-ath-text-primary whitespace-pre-wrap">{event.notes_coach}</p>
          </div>
        )}

        {!event.isCompetition && event.notes_athlete && (
          <div>
            <p className="text-sm text-ath-text-muted mb-1">Mis notas</p>
            <p className="text-ath-text-primary whitespace-pre-wrap">{event.notes_athlete}</p>
          </div>
        )}

        {/* RPE (completed) */}
        {!event.isCompetition && event.status === 'completed' && (
          <div className="p-3 bg-ath-accent-surface rounded-lg space-y-2">
            {event.rpe_score && (() => {
              const rpe = RPE_OPTIONS.find(r => r.score === event.rpe_score);
              return (
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{rpe?.emoji || ''}</span>
                  <span className="text-sm font-medium text-ath-accent-text">RPE: {rpe?.label || event.rpe_score}/5</span>
                </div>
              );
            })()}
            {event.rpe_notes && <p className="text-sm text-ath-accent-text whitespace-pre-wrap">{event.rpe_notes}</p>}
            {event.actual_duration_minutes && (
              <div className="flex items-center space-x-2 text-sm text-ath-accent-text">
                <FiClock className="w-3 h-3" />
                <span>Duración real: {event.actual_duration_minutes} min</span>
                {event.estimated_duration_minutes && (
                  <span className="text-green-600/60 dark:text-green-400/60">(estimado: {event.estimated_duration_minutes} min)</span>
                )}
              </div>
            )}
          </div>
        )}

        {!event.isCompetition && event.status === 'skipped' && (
          <div className="p-3 bg-ath-inset rounded-lg">
            <p className="text-sm font-medium text-ath-text-secondary">Sesión omitida</p>
            {event.notes_athlete && (
              <p className="text-sm text-ath-text-muted mt-1 whitespace-pre-wrap">{event.notes_athlete}</p>
            )}
          </div>
        )}

        {/* Reschedule (athlete can reschedule planned sessions) */}
        {canReschedule && (
          <div className="pt-2">
            {!showReschedule ? (
              <button
                type="button"
                onClick={() => setShowReschedule(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ath-inset hover:bg-ath-border text-ath-text-secondary rounded-xl transition-colors text-sm font-medium"
              >
                <FiCalendar className="w-4 h-4" />
                Reprogramar sesión
              </button>
            ) : (
              <div className="bg-ath-inset rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-ath-text-secondary">Nueva fecha</p>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={toLocalDateStr(new Date())}
                  className="w-full px-3 py-2.5 bg-ath-surface border border-ath-border rounded-xl text-sm text-ath-text-primary focus:ring-2 focus:ring-ath-accent focus:border-transparent outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReschedule(false); setRescheduleDate(''); }}
                    className="flex-1 px-3 py-2 text-sm text-ath-text-secondary hover:bg-ath-inset rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={onRescheduleConfirm}
                    disabled={!rescheduleDate || rescheduling}
                    className="flex-1 px-3 py-2 text-sm bg-ath-accent text-ath-on-accent rounded-xl hover:bg-ath-accent-hover transition-colors disabled:opacity-50 font-medium"
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

export default AthleteCalendar;
