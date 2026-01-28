import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiCalendar,
} from 'react-icons/fi';
import { getMonthSessions, createSession, updateSession, deleteSession } from '../../services/calendarService';
import { getAthletes } from '../../services/athleteService';

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const Calendar = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    athleteId: '',
    time: '',
    type: 'running',
    description: '',
    status: 'planned',
  });

  // Extract dependencies for useEffect
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const coachId = profile?.id;

  const loadData = useCallback(async () => {
    if (!coachId) {
      setSessions([]);
      setAthletes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const year = currentYear;
      const month = currentMonth + 1;

      const [sessionsRes, athletesRes] = await Promise.all([
        getMonthSessions(coachId, year, month),
        getAthletes(coachId),
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (athletesRes.data) setAthletes(athletesRes.data);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setSessions([]);
      setAthletes([]);
    } finally {
      setLoading(false);
    }
  }, [coachId, currentMonth, currentYear]);

  // Load data when profile or month changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getSessionsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter((session) => session.date === dateStr);
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

  // Click on a date cell (empty area) - opens create modal
  const handleDateClick = (date, e) => {
    if (!date) return;
    // Only open create modal if NOT clicking on an event pill
    if (e.target.closest('.event-pill')) return;

    setSelectedDate(date);
    setFormData({
      title: '',
      athleteId: '',
      time: '',
      type: 'running',
      description: '',
      status: 'planned',
    });
    setShowCreateModal(true);
  };

  // Click on an event pill - opens event details modal
  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setIsEditing(false);
    setShowEventModal(true);
  };

  // Start editing event
  const handleEditClick = () => {
    setFormData({
      title: selectedEvent.title || '',
      athleteId: selectedEvent.athleteId || '',
      time: selectedEvent.time || '',
      type: selectedEvent.type || 'running',
      description: selectedEvent.description || '',
      status: selectedEvent.status || 'planned',
    });
    setIsEditing(true);
  };

  // Save edited event
  const handleSaveEdit = async () => {
    if (!selectedEvent?.id || !formData.title || !formData.athleteId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const updates = {
        title: formData.title,
        athlete_id: formData.athleteId,
        scheduled_time: formData.time || null,
        training_type: formData.type,
        description: formData.description || null,
        status: formData.status,
      };

      const { error } = await updateSession(selectedEvent.id, updates);
      if (error) throw error;

      await loadData();
      setShowEventModal(false);
      setIsEditing(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Error al actualizar el evento');
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    if (!selectedEvent?.id) return;

    try {
      const { error } = await deleteSession(selectedEvent.id);
      if (error) throw error;

      await loadData();
      setShowEventModal(false);
      setShowDeleteConfirm(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error al eliminar el evento');
    }
  };

  // Create new event
  const handleCreateEvent = async () => {
    if (!selectedDate || !formData.title || !formData.athleteId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const sessionData = {
        coach_id: profile.id,
        athlete_id: formData.athleteId,
        scheduled_date: selectedDate.toISOString().split('T')[0],
        scheduled_time: formData.time || null,
        training_type: formData.type,
        status: 'planned',
        title: formData.title,
        description: formData.description || null,
      };

      const { error } = await createSession(sessionData);
      if (error) throw error;

      await loadData();
      setFormData({
        title: '',
        athleteId: '',
        time: '',
        type: 'running',
        description: '',
        status: 'planned',
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error al crear el evento');
    }
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
            <p className="text-gray-600 dark:text-gray-400">Gestiona los entrenamientos y eventos</p>
          </div>
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setFormData({ title: '', athleteId: '', time: '', type: 'running', description: '', status: 'planned' });
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            <span>Crear Evento</span>
          </button>
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
              const daySessions = date ? getSessionsForDate(date) : [];
              const today = isToday(date);

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={(e) => handleDateClick(date, e)}
                  className={`
                    min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer
                    ${date
                      ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md'
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
                        {daySessions.slice(0, 2).map((session) => (
                          <div
                            key={session.id}
                            onClick={(e) => handleEventClick(session, e)}
                            className={`event-pill text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${getTypeColor(session.type)} text-white`}
                            title={`${session.title} - ${session.athleteName}`}
                          >
                            {session.time && <span className="mr-1">{session.time.slice(0, 5)}</span>}
                            {session.title}
                          </div>
                        ))}
                        {daySessions.length > 2 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                            +{daySessions.length - 2} más
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Tipos de Entrenamiento</h3>
        <div className="flex flex-wrap gap-4">
          {['running', 'gym', 'rest', 'cross_training'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{getTypeLabel(type)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Crear Evento</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <EventForm
                  formData={formData}
                  setFormData={setFormData}
                  athletes={athletes}
                  selectedDate={selectedDate}
                  isEditing={false}
                />

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateEvent}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Crear Evento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View/Edit Event Modal */}
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
                    {isEditing ? 'Editar Evento' : 'Detalles del Evento'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEventModal(false);
                      setIsEditing(false);
                      setSelectedEvent(null);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {isEditing ? (
                  <>
                    <EventForm
                      formData={formData}
                      setFormData={setFormData}
                      athletes={athletes}
                      selectedDate={new Date(selectedEvent.date)}
                      isEditing={true}
                    />

                    <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <FiCheck className="w-4 h-4" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Event Details View */}
                    <div className="space-y-4">
                      {/* Date & Time */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center space-x-3">
                        <FiCalendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {new Date(selectedEvent.date).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          {selectedEvent.time && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              {selectedEvent.time.slice(0, 5)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedEvent.title}
                        </h4>
                      </div>

                      {/* Type & Status */}
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm text-white ${getTypeColor(selectedEvent.type)}`}>
                          {getTypeLabel(selectedEvent.type)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedEvent.status)}`}>
                          {getStatusLabel(selectedEvent.status)}
                        </span>
                      </div>

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

                      {/* Description */}
                      {selectedEvent.description && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                          <p className="text-gray-900 dark:text-white">{selectedEvent.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                      <button
                        onClick={handleEditClick}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <FiEdit2 className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                ¿Eliminar evento?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Esta acción no se puede deshacer. El evento "{selectedEvent?.title}" será eliminado permanentemente.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteEvent}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Reusable Event Form Component
const EventForm = ({ formData, setFormData, athletes, selectedDate, isEditing }) => {
  return (
    <div className="space-y-4">
      {/* Date Display */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {selectedDate?.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Título *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ej: Sesión de series 400m"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Athlete */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Atleta *
        </label>
        <select
          value={formData.athleteId}
          onChange={(e) => setFormData({ ...formData, athleteId: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecciona un atleta</option>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.firstName} {athlete.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tipo de Entrenamiento
        </label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="running">Carrera</option>
          <option value="gym">Gimnasio</option>
          <option value="rest">Descanso</option>
          <option value="cross_training">Entrenamiento Cruzado</option>
        </select>
      </div>

      {/* Status (only when editing) */}
      {isEditing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Estado
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="planned">Planificado</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completado</option>
            <option value="skipped">Omitido</option>
          </select>
        </div>
      )}

      {/* Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Hora (opcional)
        </label>
        <input
          type="time"
          value={formData.time}
          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Descripción (opcional)
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          placeholder="Añade notas o instrucciones..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
};

export default Calendar;
