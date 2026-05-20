import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSave, FiTrash2 } from 'react-icons/fi';
import {
  createCustomExercise,
  updateExercise,
  deleteExercise,
  slugify,
} from '../../services/exerciseLibraryService';
import { showSuccess, showError } from '../../lib/toast';

const RUNNING_CATEGORIES = [
  'series_short','series_medium','series_long',
  'warmup_run','easy_run','long_run','tempo_run',
  'fartlek_time','fartlek_distance','hill_repeats',
  'recovery_run','race','test','technical_drill','progressive_run','pace_blocks',
];

const GYM_CATEGORIES = [
  'max_strength','general_strength','explosive_strength',
  'core','mobility','plyometrics','injury_prevention',
];

const CATEGORY_LABELS = {
  series_short: 'Series cortas', series_medium: 'Series medias', series_long: 'Series largas',
  warmup_run: 'Calentamiento', easy_run: 'Rodaje suave', long_run: 'Tirada larga',
  tempo_run: 'Tempo', fartlek_time: 'Fartlek (tiempo)', fartlek_distance: 'Fartlek (distancia)',
  hill_repeats: 'Cuestas', recovery_run: 'Rodaje recuperación', race: 'Competición',
  test: 'Test', technical_drill: 'Drill técnico', progressive_run: 'Progresivo',
  pace_blocks: 'Ritmos',
  max_strength: 'Fuerza máxima', general_strength: 'Fuerza general',
  explosive_strength: 'Fuerza explosiva', core: 'Core', mobility: 'Movilidad',
  plyometrics: 'Pliometría', injury_prevention: 'Prevención',
};

const LEVELS = ['principiante', 'intermedio', 'avanzado', 'todos'];

const parseList = (s) =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const parseLines = (s) =>
  (s || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

const emptyDraft = (kind) => ({
  name: '',
  category: kind === 'running' ? 'easy_run' : 'general_strength',
  level: 'todos',
  description: '',
  tagsRaw: '',
  bodyRegionRaw: '',
  commonErrorsRaw: '',
  default_sets: '',
  default_reps: '',
  default_rest_seconds: '',
  // running
  distance_meters: '',
  duration_seconds: '',
  pace_description: '',
  // gym
  muscle_groupsRaw: '',
  equipmentRaw: '',
  video_url: '',
  image_url: '',
  instructionsRaw: '',
});

const fromExercise = (ex, kind) => {
  if (!ex) return emptyDraft(kind);
  return {
    name: ex.name || '',
    category: ex.category || (kind === 'running' ? 'easy_run' : 'general_strength'),
    level: ex.level || 'todos',
    description: ex.description || '',
    tagsRaw: (ex.tags || []).join(', '),
    bodyRegionRaw: (ex.body_region || []).join(', '),
    commonErrorsRaw: (ex.common_errors || []).join('\n'),
    default_sets: ex.default_sets ?? '',
    default_reps: ex.default_reps ?? '',
    default_rest_seconds: ex.default_rest_seconds ?? '',
    distance_meters: ex.distance_meters ?? '',
    duration_seconds: ex.duration_seconds ?? '',
    pace_description: ex.pace_description || '',
    muscle_groupsRaw: (ex.muscle_groups || []).join(', '),
    equipmentRaw: (ex.equipment || []).join(', '),
    video_url: ex.video_url || '',
    image_url: ex.image_url || '',
    instructionsRaw: (ex.instructions || []).join('\n'),
  };
};

const toPayload = (draft, kind) => {
  const intOrNull = (v) => (v === '' || v == null ? null : parseInt(v, 10));
  const base = {
    name: draft.name.trim(),
    category: draft.category,
    level: draft.level,
    description: draft.description.trim() || null,
    tags: parseList(draft.tagsRaw),
    body_region: parseList(draft.bodyRegionRaw),
    common_errors: parseLines(draft.commonErrorsRaw),
    default_sets: intOrNull(draft.default_sets),
    default_reps: intOrNull(draft.default_reps),
    default_rest_seconds: intOrNull(draft.default_rest_seconds),
  };
  if (kind === 'running') {
    return {
      ...base,
      distance_meters: intOrNull(draft.distance_meters),
      duration_seconds: intOrNull(draft.duration_seconds),
      pace_description: draft.pace_description.trim() || null,
    };
  }
  return {
    ...base,
    muscle_groups: parseList(draft.muscle_groupsRaw),
    equipment: parseList(draft.equipmentRaw),
    video_url: draft.video_url.trim() || null,
    image_url: draft.image_url.trim() || null,
    instructions: parseLines(draft.instructionsRaw),
  };
};

/**
 * Modal para crear o editar un ejercicio custom de un coach.
 * Props:
 *  - open
 *  - mode: 'create' | 'edit'
 *  - kind: 'running' | 'gym'
 *  - coachId
 *  - exercise (en edit)
 *  - onClose
 *  - onSaved(exercise)
 *  - onDeleted(id)
 */
const ExerciseFormModal = ({
  open,
  mode = 'create',
  kind: kindProp = 'running',
  coachId,
  exercise = null,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const isEdit = mode === 'edit';
  const [kind, setKind] = useState(kindProp);
  const [draft, setDraft] = useState(emptyDraft(kindProp));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Reset al abrir o cuando cambia el ejercicio que se edita
  useEffect(() => {
    if (!open) return;
    if (isEdit && exercise) {
      setDraft(fromExercise(exercise, kindProp));
      setKind(kindProp);
    } else {
      setDraft(emptyDraft(kindProp));
      setKind(kindProp);
    }
    setError(null);
  }, [open, isEdit, exercise, kindProp]);

  const categories = useMemo(
    () => (kind === 'running' ? RUNNING_CATEGORIES : GYM_CATEGORIES),
    [kind]
  );

  // Si cambia el banco en modo create, ajusta la categoria por defecto
  const handleKindChange = (newKind) => {
    setKind(newKind);
    setDraft((d) => ({
      ...d,
      category: newKind === 'running' ? 'easy_run' : 'general_strength',
    }));
  };

  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const previewSlug = useMemo(() => {
    if (!draft.name.trim()) return '';
    const base = slugify(draft.name);
    return `${base}-${(coachId || '').slice(0, 6)}`;
  }, [draft.name, coachId]);

  const validate = () => {
    if (!draft.name.trim()) return 'El nombre es obligatorio';
    if (!draft.category) return 'La categoría es obligatoria';
    if (!categories.includes(draft.category)) return 'Categoría no válida para este banco';
    if (!LEVELS.includes(draft.level)) return 'Nivel no válido';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const payload = toPayload(draft, kind);
    let result;
    if (isEdit && exercise) {
      // En edicion no permitimos cambiar slug ni coach_id
      result = await updateExercise(kind, exercise.id, payload);
    } else {
      result = await createCustomExercise(kind, coachId, payload);
    }
    setSaving(false);
    if (result.error) {
      const msg = result.error.message || 'No se pudo guardar el ejercicio';
      setError(msg);
      showError(msg);
      return;
    }
    showSuccess(isEdit ? 'Ejercicio actualizado' : 'Ejercicio creado');
    onSaved?.(result.data);
    onClose?.();
  };

  const handleDelete = async () => {
    if (!isEdit || !exercise) return;
    if (!window.confirm(`¿Eliminar "${exercise.name}"? No se puede deshacer.`)) return;
    setDeleting(true);
    const { error: delErr } = await deleteExercise(kind, exercise.id);
    setDeleting(false);
    if (delErr) {
      showError('No se pudo eliminar');
      return;
    }
    showSuccess('Ejercicio eliminado');
    onDeleted?.(exercise.id);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-coach-base rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-coach-base border-b border-slate-200 dark:border-white/10 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isEdit ? 'Editar ejercicio' : 'Nuevo ejercicio'}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Banco */}
              {!isEdit && (
                <Field label="Banco">
                  <div className="flex gap-2">
                    {['running', 'gym'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleKindChange(k)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          kind === k
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'bg-white dark:bg-coach-elevated border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {k === 'running' ? 'Carrera' : 'Gym'}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {/* Name */}
              <Field label="Nombre *">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Ej. Series 8x400m con recuperación de 90s"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                />
                {previewSlug && !isEdit && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    slug: <code className="font-mono">{previewSlug}</code>
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Categoría *">
                  <select
                    value={draft.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nivel">
                  <select
                    value={draft.level}
                    onChange={(e) => setField('level', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Descripción">
                <textarea
                  value={draft.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                  placeholder="Descripción visible para el atleta."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tags (separados por comas)">
                  <input
                    type="text"
                    value={draft.tagsRaw}
                    onChange={(e) => setField('tagsRaw', e.target.value)}
                    placeholder="umbral, vo2max, neuromuscular"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  />
                </Field>
                <Field label="Zonas del cuerpo (comas)">
                  <input
                    type="text"
                    value={draft.bodyRegionRaw}
                    onChange={(e) => setField('bodyRegionRaw', e.target.value)}
                    placeholder="piernas, core, gluteos"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  />
                </Field>
              </div>

              <Field label="Errores comunes (uno por línea)">
                <textarea
                  value={draft.commonErrorsRaw}
                  onChange={(e) => setField('commonErrorsRaw', e.target.value)}
                  rows={3}
                  placeholder={'Salir demasiado rápido\nMal manejo de la respiración'}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                />
              </Field>

              {/* Defaults comunes */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Sets">
                  <input
                    type="number"
                    min={0}
                    value={draft.default_sets}
                    onChange={(e) => setField('default_sets', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  />
                </Field>
                <Field label="Reps">
                  <input
                    type="number"
                    min={0}
                    value={draft.default_reps}
                    onChange={(e) => setField('default_reps', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  />
                </Field>
                <Field label="Descanso (s)">
                  <input
                    type="number"
                    min={0}
                    value={draft.default_rest_seconds}
                    onChange={(e) => setField('default_rest_seconds', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                  />
                </Field>
              </div>

              {/* Específicos por banco */}
              {kind === 'running' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Distancia (m)">
                      <input
                        type="number"
                        min={0}
                        value={draft.distance_meters}
                        onChange={(e) => setField('distance_meters', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                      />
                    </Field>
                    <Field label="Duración (s)">
                      <input
                        type="number"
                        min={0}
                        value={draft.duration_seconds}
                        onChange={(e) => setField('duration_seconds', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                      />
                    </Field>
                  </div>
                  <Field label="Descripción de ritmo">
                    <input
                      type="text"
                      value={draft.pace_description}
                      onChange={(e) => setField('pace_description', e.target.value)}
                      placeholder="Ritmo de 5K"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Grupos musculares (comas)">
                      <input
                        type="text"
                        value={draft.muscle_groupsRaw}
                        onChange={(e) => setField('muscle_groupsRaw', e.target.value)}
                        placeholder="legs, core, glutes"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                      />
                    </Field>
                    <Field label="Material (comas)">
                      <input
                        type="text"
                        value={draft.equipmentRaw}
                        onChange={(e) => setField('equipmentRaw', e.target.value)}
                        placeholder="barbell, bench"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                      />
                    </Field>
                  </div>
                  <Field label="Vídeo (YouTube URL)">
                    <input
                      type="url"
                      value={draft.video_url}
                      onChange={(e) => setField('video_url', e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                    />
                  </Field>
                  <Field label="Instrucciones (una por línea)">
                    <textarea
                      value={draft.instructionsRaw}
                      onChange={(e) => setField('instructionsRaw', e.target.value)}
                      rows={4}
                      placeholder={'Posición inicial…\nBajar controlado…'}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                    />
                  </Field>
                </>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-coach-base border-t border-slate-200 dark:border-white/10 px-5 py-3 flex items-center justify-between gap-2">
              {isEdit ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Eliminar
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white flex items-center gap-1.5"
                >
                  <FiSave className="w-4 h-4" />
                  {isEdit ? 'Guardar cambios' : 'Crear ejercicio'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">{label}</span>
    {children}
  </label>
);

export default ExerciseFormModal;
