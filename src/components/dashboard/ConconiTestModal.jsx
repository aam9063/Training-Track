import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiUpload,
  FiCheck,
  FiAlertCircle,
  FiArrowLeft,
  FiFileText,
  FiChevronRight,
} from 'react-icons/fi';
import { parseConconiFile, createConconiTest, formatPace } from '../../services/conconiService';
import { toLocalDateStr } from '../../lib/dateUtils';

const ConconiTestModal = ({ isOpen, onClose, athlete, coachId, onSuccess }) => {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'results'
  const [parsedSeries, setParsedSeries] = useState([]);
  const [seriesDistance, setSeriesDistance] = useState(800);
  const [testMeta, setTestMeta] = useState({
    test_date: toLocalDateStr(new Date()),
    location: '',
    weather_conditions: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [calculatedPaces, setCalculatedPaces] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Normalize athlete name (Athletes.jsx uses firstName/lastName, AthleteProfile uses user.first_name)
  const athleteName = athlete?.firstName
    ? `${athlete.firstName} ${athlete.lastName || ''}`
    : `${athlete?.user?.first_name || ''} ${athlete?.user?.last_name || ''}`.trim() || 'Atleta';

  const athleteId = athlete?.id;

  const handleReset = () => {
    setStep('upload');
    setParsedSeries([]);
    setTestMeta({
      test_date: toLocalDateStr(new Date()),
      location: '',
      weather_conditions: '',
      notes: '',
    });
    setSeriesDistance(800);
    setSaving(false);
    setError(null);
    setCalculatedPaces([]);
    setDragOver(false);
    setFileName('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);

    const { data, error: parseError } = await parseConconiFile(file, seriesDistance);
    if (parseError) {
      setError(parseError.message);
      return;
    }

    setParsedSeries(data);
    setStep('preview');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.match(/\.(csv|xlsx?)$/i) || file.type === 'text/csv')) {
      handleFile(file);
    } else {
      setError('Solo se aceptan archivos CSV o Excel (.xlsx)');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Set correct distance on all series
    const seriesWithDistance = parsedSeries.map((s) => ({
      ...s,
      distance_meters: seriesDistance,
    }));

    const { data, error: saveError } = await createConconiTest(athleteId, coachId, testMeta, seriesWithDistance);

    if (saveError) {
      setError(saveError.message || 'Error al guardar el test');
      setSaving(false);
      return;
    }

    setCalculatedPaces(data.paces || []);
    setSaving(false);
    setStep('results');
  };

  // Helper: format time_seconds to mm:ss
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  // Helper: estimate pace per km from series data (for preview)
  const estimatePace = (timeSeconds) => {
    const pacePerKm = (timeSeconds * 1000) / seriesDistance;
    return formatPace(pacePerKm);
  };

  // Pace code badge color
  const getPaceColor = (code) => {
    if (code === 'RR') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    const num = parseInt(code.replace('R', ''));
    if (num <= 3) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (num <= 6) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (num <= 8) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-500">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Test de Conconi</h2>
              <p className="text-amber-100 text-sm">{athleteName}</p>
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
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Step: Upload */}
            {step === 'upload' && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Sube el archivo CSV o Excel (.xlsx) con los resultados del Test de Conconi. El archivo debe contener
                  columnas de serie, tiempo, frecuencia cardíaca y opcionalmente tiempo de recuperación.
                </p>

                {/* Series distance selector */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Distancia por serie
                  </label>
                  <div className="flex gap-2">
                    {[200, 400, 800, 1000].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSeriesDistance(d)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          seriesDistance === d
                            ? 'bg-amber-500 border-amber-500 text-white font-medium'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-amber-400'
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drag & Drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                      : 'border-gray-300 dark:border-gray-600 hover:border-amber-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <FiUpload
                    className={`w-10 h-10 mx-auto mb-3 ${
                      dragOver ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Arrastra tu archivo CSV o Excel aquí
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    o haz clic para seleccionar
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* CSV format hint */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Formato esperado del CSV:
                  </p>
                  <code className="text-xs text-gray-500 dark:text-gray-400 block">
                    serie,tiempo,fc,recuperacion
                    <br />
                    1,3:30,140,90
                    <br />
                    2,3:20,152,95
                    <br />
                    3,3:10,162,100
                    <br />
                    ...
                  </code>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {step === 'preview' && (
              <div>
                {/* File name badge */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <FiFileText className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    {fileName}
                  </span>
                  <span className="text-xs text-amber-600/70 dark:text-amber-400/60">
                    ({parsedSeries.length} series)
                  </span>
                </div>

                {/* Optional metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Fecha del test
                    </label>
                    <input
                      type="date"
                      value={testMeta.test_date}
                      onChange={(e) => setTestMeta({ ...testMeta, test_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={testMeta.location}
                      onChange={(e) => setTestMeta({ ...testMeta, location: e.target.value })}
                      placeholder="Pista de atletismo..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Condiciones
                    </label>
                    <input
                      type="text"
                      value={testMeta.weather_conditions}
                      onChange={(e) =>
                        setTestMeta({ ...testMeta, weather_conditions: e.target.value })
                      }
                      placeholder="18°C, sin viento..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Notas
                    </label>
                    <input
                      type="text"
                      value={testMeta.notes}
                      onChange={(e) => setTestMeta({ ...testMeta, notes: e.target.value })}
                      placeholder="Observaciones..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Series table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Tiempo
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          FC
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Ritmo est.
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Recup.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {parsedSeries.map((s) => (
                        <tr
                          key={s.series_number}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                            {s.series_number}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">
                            {formatTime(s.time_seconds)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-mono ${
                                s.max_heart_rate_reached
                                  ? 'text-red-600 dark:text-red-400 font-bold'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {s.heart_rate}
                            </span>
                            {s.max_heart_rate_reached && (
                              <span className="text-xs text-red-500 ml-1">MAX</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                            {estimatePace(s.time_seconds)}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono">
                            {s.recovery_time_seconds ? `${s.recovery_time_seconds}s` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step: Results */}
            {step === 'results' && (
              <div>
                {/* Success banner */}
                <div className="flex items-center gap-3 mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                    <FiCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Ritmos calculados correctamente
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Se han generado 11 zonas de ritmo para {athleteName}
                    </p>
                  </div>
                </div>

                {/* Paces table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Ritmo
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Pace
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          FC
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Descripción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {calculatedPaces.map((pace) => (
                        <tr
                          key={pace.pace_code}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getPaceColor(
                                pace.pace_code
                              )}`}
                            >
                              {pace.pace_code}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-gray-900 dark:text-white">
                            {formatPace(pace.pace_seconds_per_km)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
                            {pace.heart_rate_min}-{pace.heart_rate_max} bpm
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">
                            {pace.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {step === 'upload' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={() => {
                    setStep('upload');
                    setError(null);
                  }}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  Volver
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? (
                    <>
                      <svg
                        className="animate-spin w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
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
                      Calculando...
                    </>
                  ) : (
                    <>
                      Calcular Ritmos
                      <FiChevronRight className="w-4 h-4" />
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

export default ConconiTestModal;
