import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { RPE_OPTIONS } from '../../services/rpeService';

const RPEModal = ({ activity, athleteName, onSubmit, onClose, initialScore = null, initialNotes = '', editMode = false }) => {
  const [selected, setSelected] = useState(initialScore);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    await onSubmit(selected, notes);
    setSaving(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-ath-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-5 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
            {editMode ? (
              <p className="text-lg font-bold">Editar percepción de esfuerzo</p>
            ) : (
              <p className="text-lg font-bold">
                Muy bien {athleteName}, has completado otro entrenamiento
              </p>
            )}
            {activity && (
              <p className="text-white/80 text-sm mt-1">
                {activity.name}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-center text-ath-text-secondary mb-6 font-medium">
              ¿Puedes indicar tu percepción relativa de esfuerzo?
            </p>

            {/* Emoji Scale */}
            <div className="flex justify-center gap-3">
              {RPE_OPTIONS.map((option) => (
                <button
                  key={option.score}
                  onClick={() => setSelected(option.score)}
                  className={`
                    flex flex-col items-center p-3 rounded-xl transition-all duration-200
                    ${
                      selected === option.score
                        ? 'bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-500 scale-110'
                        : 'hover:bg-ath-inset hover:scale-105'
                    }
                  `}
                >
                  <span className="text-3xl mb-1">{option.emoji}</span>
                  <span className={`text-xs font-medium ${
                    selected === option.score
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-ath-text-muted'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Notes textarea */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-ath-text-secondary mb-2">
                Sensaciones / Comentarios (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Cómo te has sentido? Describe tus sensaciones..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-ath-border bg-ath-surface text-ath-text-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
              />
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!selected || saving}
                className={`
                  w-full py-3 rounded-xl font-semibold transition-all text-white
                  ${
                    selected && !saving
                      ? 'bg-[#FC4C02] hover:bg-[#E34402] cursor-pointer'
                      : 'bg-ath-border cursor-not-allowed'
                  }
                `}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-ath-text-muted hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {editMode ? 'Cancelar' : 'Ahora no'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RPEModal;
