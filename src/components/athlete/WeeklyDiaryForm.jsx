import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiEdit3, FiChevronDown, FiChevronUp, FiCheck } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentWeekDiary, upsertWeeklyDiary } from '../../services/weeklyDiaryService';
import { toLocalDateStr } from '../../lib/dateUtils';
import { getWeekStartDate } from '../../services/weeklyTrainingService';
import { showSuccess, showError } from '../../lib/toast';

const OVERALL_EMOJI = ['😩', '😕', '😐', '🙂', '💪'];
const NEXT_EMOJI    = ['😰', '😟', '😐', '😊', '🔥'];

function RatingRow({ emojis, value, onChange }) {
  return (
    <div className="flex gap-1.5 mt-2">
      {emojis.map((emoji, idx) => {
        const val = idx + 1;
        const selected = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`flex-1 py-2 rounded-xl text-lg transition-all ${
              selected
                ? 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-500 scale-105'
                : 'bg-ath-inset hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
            title={`${val}/5`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

export default function WeeklyDiaryForm({ compact = true, onSaved, defaultExpanded = false }) {
  const { user, profile } = useAuth();
  const [loading, setLoading]               = useState(true);
  const [expanded, setExpanded]             = useState(defaultExpanded);
  const [saved, setSaved]                   = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [weekStart, setWeekStart]           = useState('');
  const [overallRating, setOverallRating]   = useState(null);
  const [overallNotes, setOverallNotes]     = useState('');
  const [painNotes, setPainNotes]           = useState('');
  const [nextWeekRating, setNextWeekRating] = useState(null);
  const [nextWeekNotes, setNextWeekNotes]   = useState('');

  useEffect(() => {
    const load = async () => {
      const athleteId = profile?.id || user?.id;
      if (!athleteId) { setLoading(false); return; }
      const ws = toLocalDateStr(getWeekStartDate());
      setWeekStart(ws);
      const { data } = await getCurrentWeekDiary(athleteId);
      if (data) {
        setOverallRating(data.overall_rating);
        setOverallNotes(data.overall_notes || '');
        setPainNotes(data.pain_notes || '');
        setNextWeekRating(data.next_week_rating);
        setNextWeekNotes(data.next_week_notes || '');
        setSaved(true);
      }
      setLoading(false);
    };
    load();
  }, [user, profile]);

  // Allow parent to force-expand (e.g. Sunday banner click)
  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  const handleSave = async () => {
    if (!overallRating || !nextWeekRating) {
      showError('Selecciona una valoración en ambas preguntas');
      return;
    }
    const athleteId = profile?.id || user?.id;
    setSaving(true);
    const { error } = await upsertWeeklyDiary(athleteId, weekStart, {
      overall_rating: overallRating,
      overall_notes: overallNotes || null,
      pain_notes: painNotes || null,
      next_week_rating: nextWeekRating,
      next_week_notes: nextWeekNotes || null,
    });
    setSaving(false);
    if (error) { showError('Error al guardar el diario'); return; }
    setSaved(true);
    showSuccess('Diario guardado ✓');
    setExpanded(false);
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="bg-ath-surface rounded-xl p-4 animate-pulse">
        <div className="h-5 bg-ath-inset rounded w-1/3" />
      </div>
    );
  }

  // Compact collapsed state
  if (compact && !expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ath-surface rounded-xl border border-ath-border p-3 cursor-pointer hover:border-green-300 dark:hover:border-green-700 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiEdit3 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-ath-text-primary">
              Diario semanal
            </span>
            {saved && (
              <span className="text-xs text-ath-text-muted">
                ({OVERALL_EMOJI[overallRating - 1]} · {NEXT_EMOJI[nextWeekRating - 1]})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saved
              ? <span className="flex items-center gap-1 text-xs text-ath-accent-text"><FiCheck className="w-3 h-3" />Rellenado</span>
              : <span className="text-xs text-ath-text-muted">¿Cómo fue la semana?</span>
            }
            <FiChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Expanded form
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ath-surface rounded-xl border border-ath-border p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiEdit3 className="w-5 h-5 text-green-500" />
          <h3 className="text-base font-semibold text-ath-text-primary">Diario semanal</h3>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-ath-accent-text">
              <FiCheck className="w-3 h-3" /> Guardado
            </span>
          )}
        </div>
        {compact && (
          <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Q1 */}
        <div>
          <p className="text-sm font-medium text-ath-text-secondary">
            ¿Cómo fue la semana en general?
          </p>
          <RatingRow emojis={OVERALL_EMOJI} value={overallRating} onChange={setOverallRating} />
          <textarea
            value={overallNotes}
            onChange={e => setOverallNotes(e.target.value)}
            placeholder="Añade notas si quieres... (opcional)"
            rows={2}
            className="mt-2 w-full px-3 py-2 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent resize-none"
          />
        </div>

        {/* Q2 */}
        <div>
          <p className="text-sm font-medium text-ath-text-secondary">
            ¿Qué dolió o molestó?
          </p>
          <textarea
            value={painNotes}
            onChange={e => setPainNotes(e.target.value)}
            placeholder="Molestias, dolores, zonas que notar... (opcional)"
            rows={2}
            className="mt-2 w-full px-3 py-2 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent resize-none"
          />
        </div>

        {/* Q3 */}
        <div>
          <p className="text-sm font-medium text-ath-text-secondary">
            ¿Cómo te sientes de cara a la próxima semana?
          </p>
          <RatingRow emojis={NEXT_EMOJI} value={nextWeekRating} onChange={setNextWeekRating} />
          <textarea
            value={nextWeekNotes}
            onChange={e => setNextWeekNotes(e.target.value)}
            placeholder="Añade notas si quieres... (opcional)"
            rows={2}
            className="mt-2 w-full px-3 py-2 text-sm border border-ath-border rounded-lg bg-ath-surface text-ath-text-primary focus:ring-2 focus:ring-ath-accent resize-none"
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
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </>
          ) : saved ? (
            <><FiCheck className="w-4 h-4" /> Actualizar diario</>
          ) : (
            'Guardar diario'
          )}
        </button>
        </div>
      </div>
    </motion.div>
  );
}
