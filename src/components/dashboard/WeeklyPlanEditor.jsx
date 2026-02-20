import { useState, useMemo, useCallback } from 'react';
import { FiSave, FiX, FiCheck, FiEdit3 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_SHORTS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Parses training description text and estimates total km.
 * Recognizes patterns like:
 *   - "8km", "8 km", "8k" → 8
 *   - "10x400m", "10x400" → 10 * 0.4 = 4
 *   - "8x1000m" → 8 * 1 = 8
 *   - "4km + 8x400m" → 4 + 3.2 = 7.2
 *   - "2km calentamiento + 6x1000m + 2km vuelta calma" → 2 + 6 + 2 = 10
 *   - "1500m", "800m" → 1.5, 0.8
 * Returns rounded to 1 decimal place, or 0 if nothing found.
 */
function parseKmFromText(text) {
  if (!text || !text.trim()) return 0;

  const normalized = text.toLowerCase().replace(/,/g, '.');
  let totalKm = 0;

  // Pattern 1: Repetitions — "10x400m", "8 x 1000", "6x200m"
  const repRegex = /(\d+)\s*x\s*(\d+)\s*m?\b/g;
  let match;
  const usedRanges = [];

  while ((match = repRegex.exec(normalized)) !== null) {
    const reps = parseInt(match[1]);
    const meters = parseInt(match[2]);
    if (reps > 0 && reps <= 100 && meters > 0 && meters <= 50000) {
      totalKm += (reps * meters) / 1000;
      usedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // Pattern 2: Direct km — "8km", "8 km", "8k", "12.5km"
  const kmRegex = /(\d+(?:\.\d+)?)\s*k(?:m)?\b/g;
  while ((match = kmRegex.exec(normalized)) !== null) {
    // Skip if this range overlaps with a repetition match (e.g., the "1k" in "10x1km")
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const km = parseFloat(match[1]);
      if (km > 0 && km <= 300) {
        totalKm += km;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  // Pattern 3: Standalone meters (not part of reps) — "1500m", "800m"
  const mRegex = /(?<!\dx?\s*)(\d+)\s*m\b/g;
  while ((match = mRegex.exec(normalized)) !== null) {
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const meters = parseInt(match[1]);
      // Only consider reasonable standalone distances (200m-42195m)
      if (meters >= 200 && meters <= 50000) {
        totalKm += meters / 1000;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  return Math.round(totalKm * 10) / 10;
}

const WeeklyPlanEditor = ({ microcycle, onSave, onClose, saving }) => {
  const initialDays = useMemo(() => {
    if (microcycle?.content?.days) {
      return DAYS.map((_, i) => {
        const existing = microcycle.content.days.find(d => d?.dayIndex === i);
        return {
          dayIndex: i,
          description: existing?.description || '',
          km: existing?.km || 0,
        };
      });
    }
    return DAYS.map((_, i) => ({ dayIndex: i, description: '', km: 0 }));
  }, [microcycle]);

  const [days, setDays] = useState(initialDays);
  const [editingDay, setEditingDay] = useState(null);

  const totalKm = useMemo(() =>
    days.reduce((sum, d) => sum + (parseFloat(d.km) || 0), 0),
    [days]
  );

  const updateDay = (dayIndex, field, value) => {
    setDays(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, [field]: value } : d
    ));
  };

  const updateDescription = useCallback((dayIndex, text) => {
    const autoKm = parseKmFromText(text);
    setDays(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, description: text, km: autoKm } : d
    ));
  }, []);

  const handleSave = () => {
    const content = {
      days: days.map(d => ({
        dayIndex: d.dayIndex,
        type: d.description.trim() ? 'running' : 'rest',
        title: '',
        description: d.description.trim(),
        km: parseFloat(d.km) || 0,
      })),
    };
    onSave(microcycle.id, content, totalKm);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
      {/* ===== MOBILE: Vertical list (< md) ===== */}
      <div className="md:hidden ml-4 border-l-2 border-blue-200 dark:border-blue-800">
        {days.map((day, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setEditingDay(i)}
            className="w-full flex items-center gap-2.5 pl-3 pr-4 py-2.5 text-left hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
          >
            <span className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
              {DAY_SHORTS[i]}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{DAYS[i]}</span>
              {day.description ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{day.description}</p>
              ) : (
                <p className="text-[11px] text-gray-300 dark:text-gray-600 italic">—</p>
              )}
            </div>
            {(day.km > 0) && (
              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">
                {day.km} km
              </span>
            )}
            <FiEdit3 className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* ===== DESKTOP: 7-column grid (md+) ===== */}
      <div className="hidden md:block px-4">
        {/* Grid header */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-0 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10" />
          {DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center border-l border-gray-200 dark:border-gray-700"
            >
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{day}</span>
            </div>
          ))}
        </div>

        {/* Text row */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-0">
          <div className="w-10 flex items-start justify-center pt-3">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 -rotate-90 whitespace-nowrap">Entreno</span>
          </div>
          {days.map((day, i) => (
            <div
              key={i}
              className="border-l border-gray-200 dark:border-gray-700 p-1 cursor-pointer"
              onClick={() => setEditingDay(i)}
            >
              <div className="w-full min-h-[100px] px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white leading-relaxed hover:border-blue-400 dark:hover:border-blue-500 transition-colors overflow-hidden">
                {day.description ? (
                  <span className="whitespace-pre-wrap break-words">{day.description}</span>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Km row */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-0 border-t border-gray-200 dark:border-gray-700">
          <div className="w-10 flex items-center justify-center">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">km</span>
          </div>
          {days.map((day, i) => (
            <div
              key={i}
              className="border-l border-gray-200 dark:border-gray-700 p-1 cursor-pointer"
              onClick={() => setEditingDay(i)}
            >
              <div className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-center text-gray-900 dark:text-white hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                {day.km || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {totalKm} km total
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {days.filter(d => d.description.trim()).length}/7 días con entreno
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-3.5 h-3.5" />
            Cerrar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            <FiSave className="w-3.5 h-3.5" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Day Edit Overlay (both mobile & desktop) */}
      <AnimatePresence>
        {editingDay !== null && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingDay(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {DAYS[editingDay]}
                </h3>
                <button
                  onClick={() => setEditingDay(null)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Descripción del entreno
                  </label>
                  <textarea
                    autoFocus
                    value={days[editingDay].description}
                    onChange={(e) => updateDescription(editingDay, e.target.value)}
                    placeholder="Ej: 8km rodaje suave + 4x100m progresivos"
                    rows={6}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Kilómetros
                    <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">(auto-calculado)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={days[editingDay].km || ''}
                      onChange={(e) => updateDay(editingDay, 'km', e.target.value)}
                      placeholder="0"
                      className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Puedes corregirlo manualmente
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                <button
                  onClick={() => setEditingDay(null)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  <FiCheck className="w-4 h-4" />
                  Listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WeeklyPlanEditor;
