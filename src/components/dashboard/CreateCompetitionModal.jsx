import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiFlag, FiCheck, FiUsers } from 'react-icons/fi';
import { showSuccess, showError } from '../../lib/toast';
import { getCoachAthletesList } from '../../services/planningService';
import { createCompetitionForAthletes } from '../../services/athleteService';
import { toLocalDateStr } from '../../lib/dateUtils';

const CreateCompetitionModal = ({ coachId, onCreated, onClose }) => {
  const [athletes, setAthletes] = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadingAthletes(true);
      const { data } = await getCoachAthletesList(coachId);
      setAthletes(data || []);
      setLoadingAthletes(false);
    };
    load();
  }, [coachId]);

  const toggleAthlete = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const selectAll = () => {
    if (selectedIds.length === athletes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(athletes.map(a => a.id));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError('Introduce un nombre para la competición');
      return;
    }
    if (!eventDate) {
      showError('Selecciona una fecha');
      return;
    }
    if (selectedIds.length === 0) {
      showError('Selecciona al menos un atleta');
      return;
    }

    setSaving(true);
    const { error } = await createCompetitionForAthletes(coachId, selectedIds, {
      name: name.trim(),
      event_date: eventDate,
      distance_km: distanceKm ? parseFloat(distanceKm) : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) {
      showError('Error al crear la competición');
    } else {
      showSuccess(`Competición creada para ${selectedIds.length} atleta${selectedIds.length > 1 ? 's' : ''}`);
      onCreated();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <FiFlag className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Competición</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Media Maratón Valencia"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Distance & Location row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Distancia (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="21.1"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ubicación
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Valencia"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Athletes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Asignar a atletas *
              </label>
              {athletes.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  {selectedIds.length === athletes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>
            {loadingAthletes ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : athletes.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No tienes atletas activos
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {athletes.map(athlete => {
                  const isSelected = selectedIds.includes(athlete.id);
                  return (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => toggleAthlete(athlete.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-red-600 text-white'
                          : 'border-2 border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && <FiCheck className="w-3 h-3" />}
                      </div>
                      {athlete.profile_image ? (
                        <img
                          src={athlete.profile_image}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {athlete.first_name?.[0]}{athlete.last_name?.[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {athlete.first_name} {athlete.last_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {selectedIds.length > 0 && name.trim() && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Se creará <strong>{name.trim()}</strong> para{' '}
              <strong>{selectedIds.length} atleta{selectedIds.length > 1 ? 's' : ''}</strong>
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim() || !eventDate || selectedIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
            >
              <FiFlag className="w-4 h-4" />
              {saving ? 'Creando...' : 'Crear Competición'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateCompetitionModal;
