import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiUsers, FiCheck } from 'react-icons/fi';
import { showSuccess, showError } from '../../lib/toast';
import { getCoachAthletesList } from '../../services/planningService';
import { toLocalDateStr } from '../../lib/dateUtils';

const PlanAssignmentModal = ({ coachId, plan, onAssign, onClose, saving }) => {
  const [athletes, setAthletes] = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState(toLocalDateStr(getNextMonday()));

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

  const totalWeeks = (plan?.mesocycles || []).reduce((sum, m) => sum + (m.weeks || 0), 0);

  const handleAssign = async () => {
    if (selectedIds.length === 0) {
      showError('Selecciona al menos un atleta');
      return;
    }
    if (!startDate) {
      showError('Selecciona una fecha de inicio');
      return;
    }

    const result = await onAssign(selectedIds, startDate);
    if (result.error) {
      showError('Error al asignar el plan');
    } else {
      showSuccess(`Plan asignado: ${result.sessionsCreated} sesiones creadas para ${selectedIds.length} atleta${selectedIds.length > 1 ? 's' : ''}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-coach-surface rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-coach-border">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Asignar Plan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{plan?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de inicio del plan
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-coach-inset border border-gray-200 dark:border-coach-border rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Se recomienda que sea un lunes
            </p>
          </div>

          {/* Athletes List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar atletas
            </label>
            {loadingAthletes ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : athletes.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                No tienes atletas activos
              </p>
            ) : (
              <div className="space-y-1">
                {athletes.map(athlete => {
                  const isSelected = selectedIds.includes(athlete.id);
                  return (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => toggleAthlete(athlete.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-750 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'border-2 border-gray-300 dark:border-coach-border'
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
                        <div className="w-8 h-8 bg-gray-200 dark:bg-coach-inset rounded-full flex items-center justify-center">
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
        <div className="px-6 py-4 border-t border-gray-200 dark:border-coach-border bg-gray-50 dark:bg-coach-surface/50">
          {selectedIds.length > 0 && totalWeeks > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Asignarás <strong>{totalWeeks} semanas</strong> de entrenamiento a{' '}
              <strong>{selectedIds.length} atleta{selectedIds.length > 1 ? 's' : ''}</strong> desde el{' '}
              <strong>{new Date(startDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
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
              onClick={handleAssign}
              disabled={saving || selectedIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              <FiUsers className="w-4 h-4" />
              {saving ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : (8 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default PlanAssignmentModal;
