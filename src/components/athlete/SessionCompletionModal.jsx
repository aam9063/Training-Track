import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiMapPin, FiClock } from 'react-icons/fi';
import { completeSessionManual, SENSATIONS } from '../../services/sessionCompletionService';
import { showSuccess, showError } from '../../lib/toast';

/**
 * Modal for manually completing a training session.
 * Fields: distancia (required), tiempo (optional), sensación / RPE (required), notas (optional).
 *
 * Props:
 *   session    – the training session object (must have id, title)
 *   onClose    – called when the modal should be dismissed
 *   onComplete – called after a successful save so the parent can refresh data
 */
export default function SessionCompletionModal({ session, onClose, onComplete }) {
  const [distance, setDistance] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [selectedSensation, setSelectedSensation] = useState(null);
  const [rpe, setRpe] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [useNumericRpe, setUseNumericRpe] = useState(false);

  const handleSensationSelect = (sensation) => {
    setSelectedSensation(sensation.key);
    setRpe(sensation.rpe);
  };

  const handleNumericRpe = (value) => {
    setRpe(value);
    setSelectedSensation(null);
  };

  const computedTimeMinutes = () => {
    const mins = parseInt(timeMinutes || '0', 10);
    const secs = parseInt(timeSeconds || '0', 10);
    const total = mins + Math.round(secs / 60 * 10) / 10;
    return total > 0 ? total : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!distance || parseFloat(distance) <= 0) {
      showError('La distancia es obligatoria');
      return;
    }
    if (!rpe) {
      showError('Selecciona cómo te sentiste');
      return;
    }

    setSaving(true);
    const { error } = await completeSessionManual(session.id, {
      distance: parseFloat(distance),
      time: computedTimeMinutes(),
      rpe,
      notes: notes || null,
    });
    setSaving(false);

    if (error) {
      showError('Error al guardar la sesión');
      return;
    }

    showSuccess('Sesión completada correctamente');
    onComplete?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-gray-900 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 id="completion-modal-title" className="text-base font-bold text-gray-900 dark:text-white">
              Completar sesión
            </h2>
            {session?.title && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[220px]">
                {session.title}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Distancia */}
          <div>
            <label htmlFor="distance" className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <FiMapPin className="w-4 h-4 text-blue-500" />
              Distancia real (km)
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              id="distance"
              type="number"
              step="0.1"
              min="0"
              max="300"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="Ej: 10.5"
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          {/* Tiempo */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <FiClock className="w-4 h-4 text-purple-500" />
              Tiempo real
              <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  id="time-minutes"
                  type="number"
                  min="0"
                  max="999"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  placeholder="00"
                  aria-label="Minutos"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-center"
                />
                <p className="text-center text-[10px] text-gray-400 mt-0.5">min</p>
              </div>
              <span className="text-gray-400 font-bold text-lg pb-4">:</span>
              <div className="flex-1">
                <input
                  id="time-seconds"
                  type="number"
                  min="0"
                  max="59"
                  value={timeSeconds}
                  onChange={(e) => setTimeSeconds(e.target.value)}
                  placeholder="00"
                  aria-label="Segundos"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-center"
                />
                <p className="text-center text-[10px] text-gray-400 mt-0.5">seg</p>
              </div>
            </div>
          </div>

          {/* Sensación / RPE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                ¿Cómo te sentiste?
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <button
                type="button"
                onClick={() => setUseNumericRpe(v => !v)}
                className="text-xs text-blue-500 dark:text-blue-400 hover:underline"
              >
                {useNumericRpe ? 'Usar etiquetas' : 'RPE numérico (1-10)'}
              </button>
            </div>

            {!useNumericRpe ? (
              /* Sensation buttons */
              <div className="grid grid-cols-2 gap-2">
                {SENSATIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleSensationSelect(s)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      selectedSensation === s.key
                        ? s.colorClass + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              /* Numeric RPE buttons */
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => {
                  const isSelected = rpe === val;
                  const color = val <= 3
                    ? isSelected ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : val <= 5
                    ? isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    : val <= 7
                    ? isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                    : isSelected ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30';
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleNumericRpe(val)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${color}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            )}

            {rpe && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center">
                RPE seleccionado: <span className="font-semibold text-gray-600 dark:text-gray-300">{rpe}/10</span>
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="completion-notes" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Notas
              <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span>
            </label>
            <textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="¿Algo que quieras recordar de esta sesión?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <FiCheck className="w-4 h-4" />
                Guardar sesión
              </>
            )}
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
