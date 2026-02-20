import { useState, useCallback } from 'react';
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
  FiMove,
} from 'react-icons/fi';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { getMonthSessions, rescheduleSession } from '../../services/calendarService';
import { getAthletes } from '../../services/athleteService';
import { supabase } from '../../lib/supabase';
import { toLocalDateStr } from '../../lib/dateUtils';
import { RPE_OPTIONS } from '../../services/rpeService';
import { showSuccess, showError } from '../../lib/toast';
import useCalendarData from '../../hooks/useCalendarData';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Draggable event pill sub-component
const DraggableEventPill = ({ event, onClick, getTypeColor }) => {
  const canDrag = !event.isCompetition && event.status === 'planned';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { event },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event, e);
      }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`event-pill text-xs px-2 py-1 rounded truncate hover:opacity-80 transition-opacity flex items-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${event.isCompetition
          ? 'bg-red-500 text-white'
          : event.status === 'completed'
            ? 'bg-green-500 text-white'
            : event.status === 'skipped'
              ? 'bg-gray-400 text-white'
              : `${getTypeColor(event.type)} text-white`
        }`}
      title={event.isCompetition
        ? `${event.name} - ${event.athleteName}`
        : `${event.title} - ${event.athleteName}${event.status === 'completed' ? ' ✓' : event.status === 'skipped' ? ' (Omitido)' : ''}`
      }
    >
      {event.isCompetition ? (
        <>
          <FiFlag className="inline w-3 h-3 mr-1 flex-shrink-0" />
          <span className="truncate">{event.name}</span>
        </>
      ) : (
        <>
          {event.status === 'completed' && <FiCheck className="inline w-3 h-3 mr-1 flex-shrink-0" />}
          {event.status === 'skipped' && <FiSkipForward className="inline w-3 h-3 mr-1 flex-shrink-0" />}
          {canDrag && <FiMove className="inline w-3 h-3 mr-1 flex-shrink-0 opacity-60" />}
          {event.time && event.status !== 'completed' && event.status !== 'skipped' && !canDrag && (
            <span className="mr-1">{event.time.slice(0, 5)}</span>
          )}
          <span className="truncate">{event.title}</span>
        </>
      )}
    </div>
  );
};

// Droppable day cell sub-component
const DroppableDayCell = ({ dateStr, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr || 'empty'}`,
    data: { dateStr },
    disabled: !dateStr,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all rounded-lg ${isOver ? 'ring-2 ring-green-400 bg-green-50/50 dark:bg-green-900/20' : ''
        }`}
    >
      {children}
    </div>
  );
};

const Calendar = () => {
  const { profile } = useAuth();

  const fetchCoachCalendar = useCallback(async (coachId, year, month, startDate, endDate) => {
    const [sessionsRes, athletesRes] = await Promise.all([
      getMonthSessions(coachId, year, month),
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
    currentDate, sessions, competitions, loading, loadData,
    goToPreviousMonth, goToNextMonth, goToToday,
  } = useCalendarData(profile?.id, fetchCoachCalendar);

  const [activeDragEvent, setActiveDragEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // DnD sensors with activation constraint to distinguish click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // DnD handlers
  const handleDragStart = (event) => {
    const draggedEvent = event.active.data.current.event;
    setActiveDragEvent(draggedEvent);
  };

  const handleDragEnd = async (event) => {
    setActiveDragEvent(null);
    const { active, over } = event;
    if (!over || !active) return;

    const draggedEvent = active.data.current.event;
    const targetDateStr = over.data.current.dateStr;

    if (!targetDateStr || draggedEvent.date === targetDateStr) return;

    const { error } = await rescheduleSession(draggedEvent.id, targetDateStr);
    if (error) {
      showError('Error al reprogramar la sesión');
    } else {
      showSuccess('Sesión reprogramada');
    }
    loadData();
  };

  const handleDragCancel = () => {
    setActiveDragEvent(null);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toLocalDateStr(date);

    const daySessions = sessions
      .filter((session) => session.date === dateStr)
      .map(s => ({ ...s, isCompetition: false }));

    const dayComps = competitions
      .filter((comp) => comp.event_date === dateStr)
      .map(c => ({ ...c, isCompetition: true }));

    return [...daySessions, ...dayComps];
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Click on a date cell - show day events list
  const handleDateClick = (date, e) => {
    if (!date) return;
    if (e.target.closest('.event-pill')) return;

    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setShowDayModal(true);
    }
  };

  // Click on an event pill - opens event details modal
  const handleEventClick = (event, e) => {
    if (e) e.stopPropagation();
    setSelectedEvent(event);
    setShowDayModal(false);
    setShowEventModal(true);
  };

  const getTypeColor = (type) => {
    const colors = {
      running: 'bg-blue-500',
      gym: 'bg-purple-500',
      rest: 'bg-teal-500',
      cross_training: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeLabel = (type) => {
    const labels = {
      running: 'Carrera',
      gym: 'Gimnasio',
      rest: 'Descanso',
      cross_training: 'Cross',
    };
    return labels[type] || type;
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
    const labels = {
      planned: 'Planificado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      skipped: 'Omitido',
    };
    return labels[status] || status;
  };

  const days = getDaysInMonth(currentDate);

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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Calendario</h1>
            <p className="text-gray-600 dark:text-gray-400">Entrenamientos y competiciones de tus atletas</p>
          </div>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
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

        {/* Calendar Grid */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((date, index) => {
                const dayEvents = date ? getEventsForDate(date) : [];
                const today = isToday(date);
                const hasEvents = dayEvents.length > 0;
                const dateStr = date ? toLocalDateStr(date) : null;

                return (
                  <DroppableDayCell key={index} dateStr={dateStr}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.01 }}
                      onClick={(e) => handleDateClick(date, e)}
                      className={`
                        min-h-[100px] p-2 rounded-lg border transition-all
                        ${date
                          ? `bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 ${hasEvents ? 'hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md cursor-pointer' : 'cursor-default'}`
                          : 'bg-gray-50 dark:bg-gray-800/50 border-transparent cursor-default'}
                        ${today ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''}
                      `}
                    >
                      {date && (
                        <>
                          <div className={`text-sm font-semibold mb-1 ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                            {date.getDate()}
                          </div>

                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event, i) => (
                              <DraggableEventPill
                                key={event.id || i}
                                event={event}
                                onClick={handleEventClick}
                                getTypeColor={getTypeColor}
                              />
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                                +{dayEvents.length - 2} más
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  </DroppableDayCell>
                );
              })}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeDragEvent && (
              <div className={`text-xs px-2 py-1 rounded shadow-lg flex items-center ${getTypeColor(activeDragEvent.type)} text-white opacity-90`}>
                <FiMove className="inline w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{activeDragEvent.title}</span>
                {activeDragEvent.athleteName && (
                  <span className="ml-1 opacity-75 truncate">- {activeDragEvent.athleteName}</span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Leyenda</h3>
        <div className="flex flex-wrap gap-4">
          {['running', 'gym', 'rest', 'cross_training'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{getTypeLabel(type)}</span>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Competición</span>
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-1" />
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Completado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Omitido</span>
          </div>
          <div className="flex items-center space-x-2">
            <FiMove className="w-3 h-3 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Arrastra para mover</span>
          </div>
        </div>
      </div>

      {/* Day Events List Modal */}
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
                      {selectedDate.toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {getEventsForDate(selectedDate).length} evento{getEventsForDate(selectedDate).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
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
                        {/* Type indicator */}
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${event.isCompetition ? 'bg-red-500' : getTypeColor(event.type)
                          }`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {event.isCompetition ? event.name : event.title}
                            </p>
                            {!event.isCompetition && event.time && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                                {event.time.slice(0, 5)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                            <FiUser className="w-3 h-3" />
                            <span className="truncate">{event.athleteName}</span>
                          </div>

                          {!event.isCompetition && (
                            <div className="flex items-center space-x-2 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getTypeColor(event.type)}`}>
                                {getTypeLabel(event.type)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(event.status)}`}>
                                {getStatusLabel(event.status)}
                              </span>
                              {event.status === 'completed' && event.rpe_score && (
                                <span className="text-sm" title={`RPE: ${event.rpe_score}/5`}>
                                  {RPE_OPTIONS.find(r => r.score === event.rpe_score)?.emoji}
                                </span>
                              )}
                            </div>
                          )}

                          {event.isCompetition && (
                            <div className="flex items-center space-x-2 mt-2">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Competición
                              </span>
                              {event.distance_km && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {event.distance_km} km
                                </span>
                              )}
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

      {/* Event Detail Modal (Read-Only) */}
      <AnimatePresence>
        {showEventModal && selectedEvent && (
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
                    {selectedEvent.isCompetition ? 'Detalles de Competición' : 'Detalles del Entrenamiento'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEventModal(false);
                      setSelectedEvent(null);
                    }}
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
                        {new Date(selectedEvent.isCompetition ? selectedEvent.event_date : selectedEvent.date).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      {!selectedEvent.isCompetition && selectedEvent.time && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center mt-1">
                          <FiClock className="w-3 h-3 mr-1" />
                          {selectedEvent.time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedEvent.isCompetition ? selectedEvent.name : selectedEvent.title}
                    </h4>
                  </div>

                  {/* Type & Status (training only) */}
                  {!selectedEvent.isCompetition && (
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm text-white ${getTypeColor(selectedEvent.type)}`}>
                        {getTypeLabel(selectedEvent.type)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedEvent.status)}`}>
                        {getStatusLabel(selectedEvent.status)}
                      </span>
                    </div>
                  )}

                  {/* Competition badge */}
                  {selectedEvent.isCompetition && (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full text-sm bg-red-500 text-white flex items-center space-x-1">
                        <FiFlag className="w-3 h-3" />
                        <span>Competición</span>
                      </span>
                    </div>
                  )}

                  {/* Athlete */}
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <img
                      src={selectedEvent.athleteImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEvent.athleteName || 'A')}&background=random`}
                      alt={selectedEvent.athleteName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Atleta</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.athleteName}</p>
                    </div>
                  </div>

                  {/* Competition-specific fields */}
                  {selectedEvent.isCompetition && (
                    <>
                      {selectedEvent.distance_km && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FiActivity className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Distancia</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.distance_km} km</p>
                          </div>
                        </div>
                      )}
                      {selectedEvent.location && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <FiMapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Ubicación</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.location}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Duration (training only) */}
                  {!selectedEvent.isCompetition && selectedEvent.estimated_duration_minutes && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <FiClock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Duración estimada</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedEvent.estimated_duration_minutes} min</p>
                      </div>
                    </div>
                  )}

                  {/* Description / Notes */}
                  {(selectedEvent.description || selectedEvent.notes) && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {selectedEvent.isCompetition ? 'Notas' : 'Descripción'}
                      </p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {selectedEvent.description || selectedEvent.notes}
                      </p>
                    </div>
                  )}

                  {/* Coach notes (training only) */}
                  {!selectedEvent.isCompetition && selectedEvent.notes_coach && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del entrenador</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEvent.notes_coach}</p>
                    </div>
                  )}

                  {/* Athlete notes (training only) */}
                  {!selectedEvent.isCompetition && selectedEvent.notes_athlete && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notas del atleta</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEvent.notes_athlete}</p>
                    </div>
                  )}

                  {/* RPE & completion info (completed sessions) */}
                  {!selectedEvent.isCompetition && selectedEvent.status === 'completed' && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
                      {selectedEvent.rpe_score && (() => {
                        const rpe = RPE_OPTIONS.find(r => r.score === selectedEvent.rpe_score);
                        return (
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{rpe?.emoji || ''}</span>
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                              RPE: {rpe?.label || selectedEvent.rpe_score}/5
                            </span>
                          </div>
                        );
                      })()}
                      {selectedEvent.rpe_notes && (
                        <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
                          {selectedEvent.rpe_notes}
                        </p>
                      )}
                      {selectedEvent.actual_duration_minutes && (
                        <div className="flex items-center space-x-2 text-sm text-green-700 dark:text-green-300">
                          <FiClock className="w-3 h-3" />
                          <span>Duración real: {selectedEvent.actual_duration_minutes} min</span>
                          {selectedEvent.estimated_duration_minutes && (
                            <span className="text-green-600/60 dark:text-green-400/60">
                              (estimado: {selectedEvent.estimated_duration_minutes} min)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Skipped session info */}
                  {!selectedEvent.isCompetition && selectedEvent.status === 'skipped' && (
                    <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sesión omitida por el atleta</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Calendar;
