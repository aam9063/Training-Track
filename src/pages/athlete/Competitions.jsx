import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFlag,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiMapPin,
  FiLoader,
  FiCalendar,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import useCompetitionsData from '../../hooks/useCompetitionsData';
import { showError } from '../../lib/toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format goal_time_minutes as "Xh Ym".
 */
const formatTime = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

// ---------------------------------------------------------------------------
// CompetitionFormModal
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: '',
  event_date: '',
  distance_km: '',
  location: '',
  notes: '',
  goal_time_minutes: '',
};

const CompetitionFormModal = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name ?? '',
          event_date: initial.event_date ?? '',
          distance_km: initial.distance_km != null ? String(initial.distance_km) : '',
          location: initial.location ?? '',
          notes: initial.notes ?? '',
          goal_time_minutes: initial.goal_time_minutes != null ? String(initial.goal_time_minutes) : '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      showError('El nombre es obligatorio');
      return;
    }
    if (!form.event_date) {
      showError('La fecha es obligatoria');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      event_date: form.event_date,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      goal_time_minutes: form.goal_time_minutes ? parseInt(form.goal_time_minutes, 10) : null,
    };

    const { error } = await onSave(payload);
    setSaving(false);

    if (!error) {
      onClose();
    }
  };

  const isEditing = !!initial;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-ath-surface rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ath-border bg-ath-accent-surface">
          <div className="flex items-center gap-2">
            <FiFlag className="w-5 h-5 text-ath-accent-text" />
            <h2 className="text-lg font-bold text-ath-text-primary">
              {isEditing ? 'Editar Competición' : 'Nueva Competición'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl transition-colors"
            type="button"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Media Maratón Valencia"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
              required
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => update('event_date', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
              required
            />
          </div>

          {/* Distancia */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Distancia (km)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.distance_km}
              onChange={(e) => update('distance_km', e.target.value)}
              placeholder="21.1"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
            />
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Ubicación
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Valencia, España"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
            />
          </div>

          {/* Tiempo objetivo */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Tiempo objetivo (minutos)
            </label>
            <input
              type="number"
              min="1"
              value={form.goal_time_minutes}
              onChange={(e) => update('goal_time_minutes', e.target.value)}
              placeholder="95"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
            />
            {form.goal_time_minutes && parseInt(form.goal_time_minutes, 10) > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                = {formatTime(parseInt(form.goal_time_minutes, 10))}
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              placeholder="Estrategia de carrera, objetivos secundarios..."
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-ath-border text-sm font-semibold text-ath-text-secondary hover:bg-ath-inset transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <FiLoader className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Añadir'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ResultModal — record actual_time and position after the race
// ---------------------------------------------------------------------------

const ResultModal = ({ competition, onSave, onClose }) => {
  const [actualTime, setActualTime] = useState(
    competition.actual_time_minutes != null ? String(competition.actual_time_minutes) : ''
  );
  const [position, setPosition] = useState(
    competition.position != null ? String(competition.position) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const updates = {
      actual_time_minutes: actualTime ? parseInt(actualTime, 10) : null,
      position: position ? parseInt(position, 10) : null,
    };

    const { error } = await onSave(competition.id, updates);
    setSaving(false);
    if (!error) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-ath-surface rounded-2xl shadow-xl max-w-sm w-full"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ath-border">
          <h2 className="text-base font-bold text-ath-text-primary">
            Registrar resultado
          </h2>
          <button onClick={onClose} type="button" className="p-2 hover:bg-ath-inset rounded-xl transition-colors">
            <FiX className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-ath-text-secondary font-medium">{competition.name}</p>

          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Tiempo real (minutos)
            </label>
            <input
              type="number"
              min="1"
              value={actualTime}
              onChange={(e) => setActualTime(e.target.value)}
              placeholder="92"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
            />
            {actualTime && parseInt(actualTime, 10) > 0 && (
              <p className="text-xs text-slate-400 mt-1">= {formatTime(parseInt(actualTime, 10))}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ath-text-secondary mb-1">
              Posición
            </label>
            <input
              type="number"
              min="1"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="145"
              className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-base text-ath-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-ath-accent"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-ath-border text-sm font-semibold text-ath-text-secondary hover:bg-ath-inset transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <FiLoader className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// CompetitionCard
// ---------------------------------------------------------------------------

const CompetitionCard = ({ competition, onEdit, onDelete, onResult, isPast }) => {
  const { name, event_date, distance_km, location, goal_time_minutes, actual_time_minutes, position, daysUntil } = competition;
  const goalTimeStr = formatTime(goal_time_minutes);
  const actualTimeStr = formatTime(actual_time_minutes);

  const eventDate = new Date(event_date + 'T00:00:00');
  const dateLabel = eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-ath-surface rounded-2xl border border-ath-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-ath-text-primary leading-tight">
            {name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="flex items-center gap-1 text-xs text-ath-text-muted">
              <FiCalendar className="w-3.5 h-3.5 flex-shrink-0" />
              {dateLabel}
            </span>
            {distance_km && (
              <span className="text-xs text-ath-text-muted">
                {distance_km} km
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 text-xs text-ath-text-muted">
                <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {location}
              </span>
            )}
          </div>

          {/* Goal / result time */}
          <div className="flex flex-wrap gap-2 mt-2">
            {goalTimeStr && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                Objetivo: {goalTimeStr}
              </span>
            )}
            {actualTimeStr && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                Resultado: {actualTimeStr}
              </span>
            )}
            {position && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
                Posición: {position}
              </span>
            )}
          </div>
        </div>

        {/* Countdown badge (upcoming only) */}
        {!isPast && daysUntil != null && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <span className="text-2xl font-bold text-ath-accent-text leading-none">
              {daysUntil === 0 ? 'Hoy' : daysUntil}
            </span>
            {daysUntil !== 0 && (
              <span className="text-[10px] text-ath-text-muted font-medium">días</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-ath-border">
        {isPast && (
          <button
            onClick={() => onResult(competition)}
            className="flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-ath-accent-text transition-colors"
          >
            Registrar resultado
          </button>
        )}
        <button
          onClick={() => onEdit(competition)}
          className="p-2 rounded-lg hover:bg-ath-inset text-ath-text-muted transition-colors"
          aria-label="Editar"
        >
          <FiEdit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(competition.id)}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
          aria-label="Eliminar"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Competitions() {
  const { user } = useAuth();
  const { loading, upcoming, past, create, update, remove } = useCompetitionsData(user?.id);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState(null);
  const [resultCompetition, setResultCompetition] = useState(null);
  const [showPast, setShowPast] = useState(false);

  const handleSave = async (data) => {
    if (editingCompetition) {
      return update(editingCompetition.id, data);
    }
    return create(data);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingCompetition(null);
  };

  const openEdit = (competition) => {
    setEditingCompetition(competition);
    setShowFormModal(true);
  };

  const openAdd = () => {
    setEditingCompetition(null);
    setShowFormModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta competición?')) return;
    await remove(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-ath-accent" />
      </div>
    );
  }

  return (
    <div className="bg-ath-base min-h-screen">
      <div className="px-4 lg:px-8 py-5 lg:py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ath-text-primary tracking-tight">
              Mis Competiciones
            </h1>
            <p className="text-sm text-ath-text-muted mt-0.5">
              Gestiona tus objetivos y registra tus resultados
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ath-accent hover:bg-ath-accent-hover text-white text-sm font-semibold transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Añadir
          </button>
        </div>

        {/* Upcoming */}
        <section>
          <h2 className="text-sm font-bold text-ath-text-secondary uppercase tracking-wide mb-3">
            Próximas
          </h2>

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-ath-surface rounded-2xl border border-dashed border-ath-border gap-3">
              <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FiFlag className="w-7 h-7 text-ath-accent-text" />
              </div>
              <p className="text-sm font-semibold text-ath-text-secondary">
                No tienes competiciones próximas
              </p>
              <p className="text-xs text-ath-text-muted text-center max-w-xs">
                ¡Añade tu próximo reto!
              </p>
              <button
                onClick={openAdd}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ath-accent hover:bg-ath-accent-hover text-white text-sm font-semibold transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Añadir competición
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onResult={setResultCompetition}
                  isPast={false}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past — collapsible */}
        {past.length > 0 && (
          <section>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
              type="button"
            >
              <h2 className="text-sm font-bold text-ath-text-secondary uppercase tracking-wide flex-1">
                Anteriores ({past.length})
              </h2>
              {showPast
                ? <FiChevronUp className="w-4 h-4 text-slate-400" />
                : <FiChevronDown className="w-4 h-4 text-slate-400" />
              }
            </button>

            <AnimatePresence>
              {showPast && (
                <motion.div
                  key="past"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3 space-y-3"
                >
                  {past.map((competition) => (
                    <CompetitionCard
                      key={competition.id}
                      competition={competition}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onResult={setResultCompetition}
                      isPast
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showFormModal && (
          <CompetitionFormModal
            key="form"
            initial={editingCompetition}
            onSave={handleSave}
            onClose={closeFormModal}
          />
        )}
        {resultCompetition && (
          <ResultModal
            key="result"
            competition={resultCompetition}
            onSave={update}
            onClose={() => setResultCompetition(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
