import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertCircle, FiZap } from 'react-icons/fi';
import { createVAMTest, formatPace } from '../../services/conconiService';
import { toLocalDateStr } from '../../lib/dateUtils';

const VAMTestModal = ({ isOpen, onClose, athlete, coachId, onSuccess }) => {
  const [step, setStep] = useState('form'); // 'form' | 'results'
  const [formData, setFormData] = useState({
    distance_meters: '',
    duration_minutes: '5',
    duration_seconds_extra: '0',
    test_date: toLocalDateStr(new Date()),
    location: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const athleteName = athlete?.firstName
    ? `${athlete.firstName} ${athlete.lastName || ''}`
    : `${athlete?.user?.first_name || ''} ${athlete?.user?.last_name || ''}`.trim() || 'Atleta';

  const athleteId = athlete?.id;

  const handleReset = () => {
    setStep('form');
    setFormData({
      distance_meters: '',
      duration_minutes: '5',
      duration_seconds_extra: '0',
      test_date: toLocalDateStr(new Date()),
      location: '',
      notes: '',
    });
    setSaving(false);
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSave = async () => {
    setError(null);

    const distanceMeters = parseInt(formData.distance_meters);
    if (!distanceMeters || distanceMeters <= 0) {
      setError('Introduce una distancia válida en metros');
      return;
    }

    const durationSeconds =
      parseInt(formData.duration_minutes || 0) * 60 +
      parseInt(formData.duration_seconds_extra || 0);
    if (durationSeconds <= 0) {
      setError('Introduce una duración válida');
      return;
    }

    setSaving(true);

    const { data, error: saveError } = await createVAMTest(athleteId, coachId, {
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      test_date: formData.test_date,
      location: formData.location,
      notes: formData.notes,
    });

    if (saveError) {
      setError(saveError.message || 'Error al guardar el test');
      setSaving(false);
      return;
    }

    setResult(data);
    setSaving(false);
    setStep('results');
  };

  // Preview calculations (live as user types)
  const previewVAM = () => {
    const dist = parseInt(formData.distance_meters);
    const dur =
      parseInt(formData.duration_minutes || 0) * 60 +
      parseInt(formData.duration_seconds_extra || 0);
    if (!dist || dist <= 0 || !dur || dur <= 0) return null;
    const vam = (dist / 1000) / (dur / 3600);
    const paceSecsPerKm = Math.round((dur * 1000) / dist);
    return { vam: vam.toFixed(2), pace: formatPace(paceSecsPerKm) };
  };

  const preview = previewVAM();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-ath-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ath-border bg-gradient-to-r from-ath-accent to-ath-accent-hover">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <FiZap className="w-5 h-5" />
                Test VAM
              </h2>
              <p className="text-white/80 text-sm">{athleteName}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Step: Form */}
            {step === 'form' && (
              <div className="space-y-4">
                <p className="text-sm text-ath-text-secondary">
                  Introduce la distancia recorrida y la duración del test (5-6 min a máxima velocidad constante en terreno llano).
                </p>

                {/* Distance */}
                <div>
                  <label className="block text-sm font-medium text-ath-text-secondary mb-1">
                    Distancia recorrida (metros) *
                  </label>
                  <input
                    type="number"
                    value={formData.distance_meters}
                    onChange={(e) => setFormData({ ...formData, distance_meters: e.target.value })}
                    placeholder="1200"
                    min="0"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary placeholder-gray-400 focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-ath-text-secondary mb-1">
                    Duración *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.duration_minutes}
                          onChange={(e) =>
                            setFormData({ ...formData, duration_minutes: e.target.value })
                          }
                          min="0"
                          max="30"
                          className="w-full px-3 py-2.5 pr-12 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          min
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-400 font-bold">:</span>
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.duration_seconds_extra}
                          onChange={(e) =>
                            setFormData({ ...formData, duration_seconds_extra: e.target.value })
                          }
                          min="0"
                          max="59"
                          className="w-full px-3 py-2.5 pr-12 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          seg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                {preview && (
                  <div className="p-4 bg-ath-accent-surface border border-ath-border-accent rounded-xl">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-ath-accent-text">
                          {preview.vam}
                        </p>
                        <p className="text-xs text-ath-text-muted mt-0.5">
                          VAM (km/h)
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-ath-accent-text">
                          {preview.pace}
                        </p>
                        <p className="text-xs text-ath-text-muted mt-0.5">
                          Ritmo medio
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-ath-border">
                  <div>
                    <label className="block text-xs font-medium text-ath-text-secondary mb-1">
                      Fecha del test
                    </label>
                    <input
                      type="date"
                      value={formData.test_date}
                      onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ath-text-secondary mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Pista de atletismo..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary placeholder-gray-400 focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-ath-text-secondary mb-1">
                      Notas
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Observaciones..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-ath-border bg-ath-elevated text-ath-text-primary placeholder-gray-400 focus:ring-2 focus:ring-ath-accent focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step: Results */}
            {step === 'results' && result && (
              <div>
                <div className="flex items-center gap-3 mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                    <FiCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Test VAM guardado correctamente
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Resultados de {athleteName}
                    </p>
                  </div>
                </div>

                {/* Results cards */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-ath-accent-surface rounded-xl text-center">
                    <p className="text-3xl font-bold text-ath-accent-text">
                      {parseFloat(result.vam_kmh).toFixed(2)}
                    </p>
                    <p className="text-xs text-ath-text-muted mt-1 font-medium">
                      VAM (km/h)
                    </p>
                  </div>
                  <div className="p-4 bg-ath-accent-surface rounded-xl text-center">
                    <p className="text-3xl font-bold text-ath-accent-text">
                      {formatPace(result.pace_seconds_per_km)}
                    </p>
                    <p className="text-xs text-ath-text-muted mt-1 font-medium">
                      Ritmo medio
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3 bg-ath-inset rounded-lg space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-ath-text-muted">Distancia</span>
                    <span className="text-ath-text-primary font-medium">
                      {result.distance_meters}m
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ath-text-muted">Duración</span>
                    <span className="text-ath-text-primary font-medium">
                      {Math.floor(result.duration_seconds / 60)}:{String(result.duration_seconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                  {result.test_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-ath-text-muted">Fecha</span>
                      <span className="text-ath-text-primary font-medium">
                        {new Date(result.test_date + 'T12:00:00').toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                  {result.location && (
                    <div className="flex justify-between text-sm">
                      <span className="text-ath-text-muted">Ubicación</span>
                      <span className="text-ath-text-primary font-medium">
                        {result.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-ath-border bg-ath-inset">
            {step === 'form' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-ath-text-secondary hover:text-ath-text-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.distance_meters}
                  className="flex items-center gap-2 px-5 py-2.5 bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4" />
                      Guardar Test
                    </>
                  )}
                </button>
              </>
            )}

            {step === 'results' && (
              <>
                <div />
                <button
                  onClick={() => {
                    if (onSuccess) onSuccess();
                    handleClose();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <FiCheck className="w-4 h-4" />
                  Cerrar
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VAMTestModal;
