import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon, FiHeart, FiActivity, FiSmile, FiAlertCircle, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { saveWellnessEntry, getTodayWellness } from '../../services/trainingLoadService';
import { toLocalDateStr } from '../../lib/dateUtils';
import { showSuccess, showError } from '../../lib/toast';

const WELLNESS_FIELDS = [
  { key: 'sleep_quality', label: 'Calidad del sueño', icon: FiMoon, color: 'indigo', emoji: ['😫', '😴', '😐', '😌', '🌙', '😊', '😎', '💤', '🌟', '✨'] },
  { key: 'fatigue', label: 'Fatiga', icon: FiActivity, color: 'orange', emoji: ['💪', '😃', '🙂', '😐', '😑', '😩', '😰', '😵', '🥵', '💀'], inverted: true },
  { key: 'soreness', label: 'Dolor muscular', icon: FiAlertCircle, color: 'red', emoji: ['😊', '🙂', '😐', '😣', '😖', '😩', '😫', '🤕', '😭', '💀'], inverted: true },
  { key: 'stress', label: 'Estrés', icon: FiSun, color: 'yellow', emoji: ['🧘', '😌', '🙂', '😐', '😑', '😤', '😰', '😩', '🤯', '💥'], inverted: true },
  { key: 'mood', label: 'Estado de ánimo', icon: FiSmile, color: 'green', emoji: ['😢', '😞', '😕', '😐', '🙂', '😊', '😃', '😄', '🥳', '🔥'] },
];

export default function WellnessForm({ compact = false, onSaved }) {
  const { user, profile } = useAuth();
  const [values, setValues] = useState({});
  const [sleepHours, setSleepHours] = useState('');
  const [bodyWeight, setBodyWeight] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadToday = async () => {
      try {
        const athleteId = profile?.id || user?.id;
        if (!athleteId) return;
        const data = await getTodayWellness(athleteId);
        if (data) {
          const vals = {};
          WELLNESS_FIELDS.forEach(f => {
            if (data[f.key]) vals[f.key] = data[f.key];
          });
          setValues(vals);
          if (data.sleep_hours) setSleepHours(String(data.sleep_hours));
          if (data.body_weight) setBodyWeight(String(data.body_weight));
          if (data.resting_hr) setRestingHr(String(data.resting_hr));
          if (data.notes) setNotes(data.notes);
          setSaved(true);
        }
      } catch (err) {
        console.error('Error loading wellness:', err);
      } finally {
        setLoading(false);
      }
    };
    loadToday();
  }, [user, profile]);

  const handleSave = async () => {
    const athleteId = profile?.id || user?.id;
    if (!athleteId) return;

    const hasValues = Object.keys(values).length > 0 || sleepHours || bodyWeight || restingHr;
    if (!hasValues) {
      showError('Rellena al menos un campo');
      return;
    }

    setSaving(true);
    try {
      const entry = {
        ...values,
        sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
        body_weight: bodyWeight ? parseFloat(bodyWeight) : null,
        resting_hr: restingHr ? parseInt(restingHr) : null,
        notes: notes || null,
      };
      await saveWellnessEntry(athleteId, toLocalDateStr(new Date()), entry);
      setSaved(true);
      showSuccess('Wellness guardado');
      onSaved?.();
    } catch (err) {
      console.error('Error saving wellness:', err);
      showError('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-ath-surface rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-ath-inset rounded w-1/3 mb-4" />
        <div className="h-20 bg-ath-inset rounded" />
      </div>
    );
  }

  // Compact mode: collapsed bar
  if (compact && !expanded) {
    // Already saved: show summary
    if (saved) {
      const avg = WELLNESS_FIELDS.reduce((sum, f) => {
        const v = values[f.key] || 0;
        return sum + (f.inverted ? (11 - v) : v);
      }, 0) / WELLNESS_FIELDS.length;
      const avgRound = Math.round(avg * 10) / 10;

      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-ath-surface rounded-xl border border-ath-border p-3 cursor-pointer hover:border-green-300 dark:hover:border-green-700 transition-colors"
          onClick={() => setExpanded(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiHeart className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-ath-text-primary">Wellness hoy</span>
              <span className="text-xs text-ath-text-muted">({avgRound}/10)</span>
            </div>
            <div className="flex items-center gap-2">
              {WELLNESS_FIELDS.map(f => (
                <span key={f.key} className="text-lg" title={f.label}>
                  {f.emoji[(values[f.key] || 5) - 1]}
                </span>
              ))}
              <FiChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </motion.div>
      );
    }

    // Not saved: show prompt
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ath-surface rounded-xl border border-ath-border p-3 cursor-pointer hover:border-green-300 dark:hover:border-green-700 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiHeart className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-ath-text-primary">¿Cómo te encuentras hoy?</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ath-text-muted">Rellenar wellness</span>
            <FiChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ath-surface rounded-xl border border-ath-border p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiHeart className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-ath-text-primary">
            {saved ? 'Wellness de hoy' : '¿Cómo te encuentras hoy?'}
          </h3>
        </div>
        {compact && (
          <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiChevronUp className="w-5 h-5" />
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-ath-accent-text">
            <FiCheck className="w-3 h-3" /> Guardado
          </span>
        )}
      </div>

      <div className="space-y-4">
        {WELLNESS_FIELDS.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-ath-text-secondary flex items-center gap-1.5">
                <field.icon className="w-3.5 h-3.5" />
                {field.label}
              </label>
              <span className="text-lg">{values[field.key] ? field.emoji[values[field.key] - 1] : '➖'}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => {
                const isSelected = values[field.key] === val;
                const colorMap = {
                  indigo: isSelected ? 'bg-indigo-500 text-white' : 'bg-ath-inset text-ath-text-secondary hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
                  orange: isSelected ? 'bg-orange-500 text-white' : 'bg-ath-inset text-ath-text-secondary hover:bg-orange-100 dark:hover:bg-orange-900/30',
                  red: isSelected ? 'bg-red-500 text-white' : 'bg-ath-inset text-ath-text-secondary hover:bg-red-100 dark:hover:bg-red-900/30',
                  yellow: isSelected ? 'bg-yellow-500 text-white' : 'bg-ath-inset text-ath-text-secondary hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                  green: isSelected ? 'bg-green-500 text-white' : 'bg-ath-inset text-ath-text-secondary hover:bg-green-100 dark:hover:bg-green-900/30',
                };
                return (
                  <button
                    key={val}
                    onClick={() => setValues(prev => ({ ...prev, [field.key]: val }))}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${colorMap[field.color]}`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Extra fields */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div>
            <label className="text-xs font-medium text-ath-text-secondary mb-1 block">Horas sueño</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="7.5"
              className="w-full px-2 py-1.5 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ath-text-secondary mb-1 block">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="200"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              placeholder="70.0"
              className="w-full px-2 py-1.5 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ath-text-secondary mb-1 block">FC reposo</label>
            <input
              type="number"
              min="30"
              max="120"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              placeholder="52"
              className="w-full px-2 py-1.5 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-ath-text-secondary mb-1 block">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Algo que destacar hoy?"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-ath-accent hover:bg-ath-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Guardando...
              </>
            ) : saved ? (
              <><FiCheck className="w-4 h-4" /> Guardar</>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
