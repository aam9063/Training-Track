import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
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
import { toLocalDateStr, inferTrainingType } from '../../lib/dateUtils';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Color helpers ──────────────────────────────────────────────────────────
const COLOR_MAP = {
  running:        { bg: 'bg-blue-500',   border: 'border-blue-500',   text: 'text-blue-600 dark:text-blue-400',     light: 'bg-blue-50 dark:bg-blue-900/20' },
  gym:            { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-600 dark:text-orange-400', light: 'bg-orange-50 dark:bg-orange-900/20' },
  cross_training: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-600 dark:text-orange-400', light: 'bg-orange-50 dark:bg-orange-900/20' },
  bike:           { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', light: 'bg-yellow-50 dark:bg-yellow-900/20' },
  rest:           { bg: 'bg-teal-500',   border: 'border-teal-500',   text: 'text-teal-600 dark:text-teal-400',     light: 'bg-teal-50 dark:bg-teal-900/20' },
};
const COLOR_FALLBACK = { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-600 dark:text-gray-400', light: 'bg-gray-50 dark:bg-gray-800' };

export const getEventColor = (event) => {
  if (event.isCompetition) return { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-600 dark:text-red-400', light: 'bg-red-50 dark:bg-red-900/20' };
  if (event.status === 'completed') return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600 dark:text-green-400', light: 'bg-green-50 dark:bg-green-900/20' };
  if (event.status === 'skipped') return { bg: 'bg-gray-400', border: 'border-gray-400', text: 'text-gray-500 dark:text-gray-400', light: 'bg-gray-50 dark:bg-gray-800' };

  const inferred = inferTrainingType(event);
  return COLOR_MAP[inferred] || COLOR_FALLBACK;
};

export const getTypeLabel = (type) => {
  const labels = { running: 'Carrera', gym: 'Fuerza', rest: 'Descanso', cross_training: 'Cross-training' };
  return labels[type] || type;
};

// ── Draggable Event Card ───────────────────────────────────────────────────
const DraggableEventCard = ({ event, onClick, isCoach }) => {
  const isGrouped = event.athletes?.length > 1;
  const canDrag = isCoach
    ? !event.isCompetition && !isGrouped && event.status === 'planned'
    : !event.isCompetition && event.status === 'planned';

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { event },
    disabled: !canDrag,
  });

  const color = getEventColor(event);
  const title = event.isCompetition ? event.name : event.title;
  const athletes = event.athletes || [{ id: event.athleteId, name: event.athleteName, image: event.athleteImage }];

  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      onClick={(e) => { e.stopPropagation(); onClick(event, e); }}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className={`event-pill group relative rounded-lg border-l-[3px] ${color.border} bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} p-2.5`}
    >
      {/* Status icon top-right */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight flex-1">
          {event.isCompetition && <FiFlag className="inline w-3 h-3 mr-1 text-red-500 flex-shrink-0" />}
          {event.status === 'completed' && <FiCheck className="inline w-3 h-3 mr-1 text-green-500 flex-shrink-0" />}
          {event.status === 'skipped' && <FiSkipForward className="inline w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />}
          {title}
        </p>
        {canDrag && <FiMove className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />}
      </div>

      {/* Athlete avatars */}
      {isCoach && athletes.length > 0 && (
        <div className="flex items-center mt-1.5 -space-x-1.5">
          {athletes.slice(0, 4).map((a, i) => (
            <img
              key={a.id || i}
              src={a.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name || 'A')}&background=random&size=24`}
              alt={a.name}
              title={a.name}
              className="w-5 h-5 rounded-full border-[1.5px] border-white dark:border-gray-800"
            />
          ))}
          {athletes.length > 4 && (
            <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 border-[1.5px] border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300">
              +{athletes.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Droppable Column ───────────────────────────────────────────────────────
const DroppableDayColumn = ({ dateStr, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr || 'empty'}`,
    data: { dateStr },
    disabled: !dateStr,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 transition-all rounded-lg ${isOver ? 'ring-2 ring-green-400 bg-green-50/50 dark:bg-green-900/10' : ''}`}
    >
      {children}
    </div>
  );
};

// ── Mini Month Calendar ────────────────────────────────────────────────────
const MiniMonthCalendar = ({ currentDate, onDateChange, selectedWeekStart, getEventsForDate }) => {
  const [viewDate, setViewDate] = useState(currentDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday=0
    const result = [];
    for (let i = 0; i < startPad; i++) result.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) result.push(new Date(year, month, d));
    return result;
  }, [year, month]);

  const isToday = (d) => {
    if (!d) return false;
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const isInSelectedWeek = (d) => {
    if (!d || !selectedWeekStart) return false;
    const weekEnd = new Date(selectedWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return d >= selectedWeekStart && d <= weekEnd;
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <FiChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <FiChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1">{d[0]}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="w-8 h-10" />;
            const today = isToday(d);
            const inWeek = isInSelectedWeek(d);
            const events = getEventsForDate ? getEventsForDate(d) : [];
            const hasEvents = events.length > 0;

            return (
              <button
                key={i}
                onClick={() => onDateChange(d)}
                className="flex flex-col items-center"
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors
                  ${inWeek
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                    : today
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                `}>
                  {d.getDate()}
                </span>
                <span className={`w-1 h-1 rounded-full mt-0.5 ${hasEvents && !inWeek && !today ? 'bg-blue-500' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main Weekly Desktop View ───────────────────────────────────────────────
export default function WeeklyDesktopView({
  sessions,
  competitions,
  getEventsForDate,
  onEventClick,
  onReschedule,
  onMonthChange,
  loadData,
  isCoach = true,
  accentColor = 'blue',
}) {
  // Current week anchored to "selected" date
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Compute the Monday of the week containing selectedDate
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  // Array of 7 Date objects for the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Week label
  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()} - ${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }, [weekDays]);

  // Notify parent when week crosses into a different month
  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(weekStart);
    }
  }, [weekStart, onMonthChange]);

  // Navigation
  const goToPrevWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToToday = () => setSelectedDate(new Date());

  const handleMiniCalClick = useCallback((date) => {
    setSelectedDate(new Date(date));
  }, []);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [activeDragEvent, setActiveDragEvent] = useState(null);

  const handleDragStart = (event) => setActiveDragEvent(event.active.data.current.event);
  const handleDragEnd = async (event) => {
    setActiveDragEvent(null);
    const { active, over } = event;
    if (!over || !active) return;
    const draggedEvent = active.data.current.event;
    // Target can be a droppable day column (dateStr) or a draggable event on that column
    let targetDateStr = over.data.current?.dateStr;
    if (!targetDateStr) {
      // Dropped on an event card — extract date from the over element's droppable container
      // The over.id format for day columns is "day-YYYY-MM-DD"
      const overId = String(over.id);
      if (overId.startsWith('day-')) {
        targetDateStr = overId.replace('day-', '');
      } else if (over.data.current?.event?.date) {
        targetDateStr = over.data.current.event.date;
      }
    }
    if (!targetDateStr || draggedEvent.date === targetDateStr) return;
    if (onReschedule) {
      await onReschedule(draggedEvent, targetDateStr);
    }
  };
  const handleDragCancel = () => setActiveDragEvent(null);

  const isToday = (d) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  return (
    <div className="flex gap-6">
      {/* Left: Mini calendar */}
      <MiniMonthCalendar
        currentDate={selectedDate}
        onDateChange={handleMiniCalClick}
        selectedWeekStart={weekStart}
        getEventsForDate={getEventsForDate}
      />

      {/* Right: Weekly grid */}
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Week header with navigation */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button onClick={goToToday} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${accentColor === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200'}`}>
                Hoy
              </button>
              <button onClick={goToPrevWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <FiChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button onClick={goToNextWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <FiChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{weekLabel}</h2>
            <div className="w-20" /> {/* spacer for alignment */}
          </div>

          {/* Day columns */}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
              {weekDays.map((day, i) => {
                const dateStr = toLocalDateStr(day);
                const dayEvents = getEventsForDate ? getEventsForDate(day) : [];
                const today = isToday(day);

                return (
                  <DroppableDayColumn key={i} dateStr={dateStr}>
                    <div className="min-h-[420px] flex flex-col">
                      {/* Day header */}
                      <div className={`px-2 py-2.5 text-center border-b border-gray-100 dark:border-gray-700 ${today ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {DAYS_FULL[i]}
                        </p>
                        <p className={`text-lg font-bold mt-0.5 ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {day.getDate()}
                        </p>
                      </div>

                      {/* Events */}
                      <div className="flex-1 p-1.5 space-y-1.5">
                        {dayEvents.map((event, j) => (
                          <DraggableEventCard
                            key={event.id || `${dateStr}-${j}`}
                            event={event}
                            onClick={onEventClick}
                            isCoach={isCoach}
                          />
                        ))}
                        {dayEvents.length === 0 && (
                          <div className="h-full flex items-center justify-center min-h-[60px]">
                            <FiCalendar className="w-4 h-4 text-gray-200 dark:text-gray-700" />
                          </div>
                        )}
                      </div>
                    </div>
                  </DroppableDayColumn>
                );
              })}
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeDragEvent && (() => {
                const color = getEventColor(activeDragEvent);
                return (
                  <div className={`text-xs px-3 py-2 rounded-lg shadow-xl border-l-[3px] ${color.border} bg-white dark:bg-gray-800 flex items-center gap-1.5 opacity-95`}>
                    <FiMove className="w-3 h-3 text-gray-400" />
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{activeDragEvent.title}</span>
                  </div>
                );
              })()}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-blue-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Carrera</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-orange-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Fuerza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-yellow-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Bici / Rodillo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-teal-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Descanso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-red-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Competición</span>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 h-3 mx-0.5" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-green-500 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Completado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-gray-400 rounded" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Omitido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiMove className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Arrastra para mover</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
