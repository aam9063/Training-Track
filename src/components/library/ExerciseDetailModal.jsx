import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiMessageSquare,
  FiSave,
  FiAlertTriangle,
  FiEdit3,
  FiTrash2,
  FiPlus,
  FiEdit2,
} from 'react-icons/fi';
import {
  upsertCoachNote,
  deleteCoachNote,
} from '../../services/coachExerciseNotesService';
import { showSuccess, showError } from '../../lib/toast';

const formatSeconds = (s) => {
  if (s == null) return '';
  if (s < 60) return `${s}"`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}' ${rest}"` : `${m}'`;
};

const formatDistance = (m) => {
  if (m == null) return '';
  return m >= 1000 ? `${(m / 1000).toString().replace(/\.0$/, '')} km` : `${m} m`;
};

/**
 * Renderiza kpi.blocks legible. Soporta:
 *  - blocks: [{distance_meters|duration_seconds, effort_pct, label}]
 *  - blocks: [{repeat: N|null, segments: [...], until?}]
 */
const KpiBlocks = ({ blocks }) => {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.segments) {
          return (
            <div
              key={i}
              className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {b.repeat != null ? `× ${b.repeat}` : (b.until ? `repetir hasta ${b.until}` : 'Patrón')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.segments.map((s, j) => (
                  <div key={j} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-medium">
                      {s.duration_seconds ? formatSeconds(s.duration_seconds) : formatDistance(s.distance_meters)}
                      {s.label ? ` — ${s.label}` : ''}
                    </span>
                    {s.effort_pct != null && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                        {s.effort_pct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          >
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {b.duration_seconds ? formatSeconds(b.duration_seconds) : formatDistance(b.distance_meters)}
              {b.label ? ` — ${b.label}` : ''}
            </span>
            {b.effort_pct != null && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                {b.effort_pct}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const youtubeEmbedUrl = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
  } catch {
    return null;
  }
  return null;
};

const ExerciseDetailModal = ({
  open,
  exercise,
  kind,
  mode,
  coachId,
  existingNote,
  canEdit = false,
  onClose,
  onPickExercise,
  onNoteSaved,
  onEdit,
}) => {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset cuando cambia el ejercicio
  useEffect(() => {
    setEditingNote(false);
    setNoteDraft(existingNote?.note || '');
  }, [exercise?.id, existingNote?.note]);

  if (!exercise) return null;

  const isCoach = mode === 'coach';
  const canEditNote = isCoach && !!coachId;
  const embedUrl = kind === 'gym' ? youtubeEmbedUrl(exercise.video_url) : null;

  const handleSaveNote = async () => {
    if (!coachId) return;
    setSaving(true);
    const { error } = await upsertCoachNote(coachId, kind, exercise.id, noteDraft);
    setSaving(false);
    if (error) {
      showError('No se pudo guardar la nota');
      return;
    }
    showSuccess(noteDraft.trim() ? 'Nota guardada' : 'Nota eliminada');
    setEditingNote(false);
    onNoteSaved?.();
  };

  const handleDeleteNote = async () => {
    if (!coachId) return;
    setSaving(true);
    const { error } = await deleteCoachNote(coachId, kind, exercise.id);
    setSaving(false);
    if (error) {
      showError('No se pudo eliminar la nota');
      return;
    }
    showSuccess('Nota eliminada');
    setEditingNote(false);
    setNoteDraft('');
    onNoteSaved?.();
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
            className="w-full max-w-2xl bg-white dark:bg-coach-base rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-coach-base border-b border-slate-200 dark:border-white/10 px-5 py-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {exercise.name}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>{kind === 'running' ? 'Carrera' : 'Gym'}</span>
                  {exercise.level && exercise.level !== 'todos' && <span>· {exercise.level}</span>}
                  {exercise.is_custom && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                      custom
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Vídeo (solo gym) */}
              {embedUrl && (
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-black">
                  <iframe
                    src={embedUrl}
                    title={`Vídeo ${exercise.name}`}
                    className="w-full h-full"
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Descripción */}
              {exercise.description && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {exercise.description}
                </p>
              )}

              {/* Tags + body_region */}
              {(exercise.tags?.length > 0 || exercise.body_region?.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {exercise.body_region?.map((b) => (
                    <span key={`b-${b}`} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                      {b}
                    </span>
                  ))}
                  {exercise.tags?.map((t) => (
                    <span key={`t-${t}`} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Métricas por defecto */}
              {(exercise.default_sets || exercise.default_reps || exercise.default_rest_seconds || exercise.distance_meters || exercise.duration_seconds) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {exercise.default_sets != null && (
                    <Stat label="Series" value={exercise.default_sets} />
                  )}
                  {exercise.default_reps != null && (
                    <Stat label="Reps" value={exercise.default_reps} />
                  )}
                  {exercise.default_rest_seconds != null && (
                    <Stat label="Descanso" value={formatSeconds(exercise.default_rest_seconds)} />
                  )}
                  {exercise.distance_meters != null && (
                    <Stat label="Distancia" value={formatDistance(exercise.distance_meters)} />
                  )}
                  {exercise.duration_seconds != null && exercise.distance_meters == null && (
                    <Stat label="Duración" value={formatSeconds(exercise.duration_seconds)} />
                  )}
                  {exercise.pace_description && (
                    <div className="col-span-2 sm:col-span-4 p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Ritmo:</span> {exercise.pace_description}
                    </div>
                  )}
                </div>
              )}

              {/* Bloques de kpi (fartleks, ritmos…) */}
              {Array.isArray(exercise.kpi?.blocks) && exercise.kpi.blocks.length > 0 && (
                <Section title="Estructura">
                  <KpiBlocks blocks={exercise.kpi.blocks} />
                </Section>
              )}

              {/* KPI extras (rpe, cadence_spm…) */}
              {exercise.kpi && Object.keys(exercise.kpi).some((k) => k !== 'blocks') && (
                <Section title="Objetivos">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {exercise.kpi.rpe != null && <Stat label="RPE" value={`${exercise.kpi.rpe}/10`} />}
                    {Array.isArray(exercise.kpi.cadence_spm) && (
                      <Stat label="Cadencia" value={`${exercise.kpi.cadence_spm[0]}-${exercise.kpi.cadence_spm[1]} spm`} />
                    )}
                    {exercise.kpi.recovery_seconds != null && (
                      <Stat label="Recuperación" value={formatSeconds(exercise.kpi.recovery_seconds)} />
                    )}
                    {Array.isArray(exercise.kpi.gradient_pct) && (
                      <Stat label="Pendiente" value={`${exercise.kpi.gradient_pct[0]}-${exercise.kpi.gradient_pct[1]}%`} />
                    )}
                  </div>
                </Section>
              )}

              {/* Instrucciones (gym) */}
              {Array.isArray(exercise.instructions) && exercise.instructions.length > 0 && (
                <Section title="Ejecución">
                  <ol className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                    {exercise.instructions.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[11px] font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {/* Errores comunes */}
              {Array.isArray(exercise.common_errors) && exercise.common_errors.length > 0 && (
                <Section title="Errores comunes" icon={<FiAlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {exercise.common_errors.map((err, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500 flex-shrink-0">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Material (gym) */}
              {Array.isArray(exercise.equipment) && exercise.equipment.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 self-center">Material:</span>
                  {exercise.equipment.map((e) => (
                    <span key={e} className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                      {e}
                    </span>
                  ))}
                </div>
              )}

              {/* Nota del coach */}
              <Section
                title="Nota del coach"
                icon={<FiMessageSquare className="w-3.5 h-3.5 text-amber-500" />}
              >
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={3}
                      placeholder="Escribe una nota visible para todos tus atletas en este ejercicio…"
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-coach-elevated border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNote}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white flex items-center gap-1.5"
                      >
                        <FiSave className="w-3.5 h-3.5" />
                        Guardar
                      </button>
                      <button
                        onClick={() => { setEditingNote(false); setNoteDraft(existingNote?.note || ''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      >
                        Cancelar
                      </button>
                      {existingNote && (
                        <button
                          onClick={handleDeleteNote}
                          disabled={saving}
                          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-1.5"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ) : existingNote ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      {existingNote.note}
                    </p>
                    {canEditNote && (
                      <button
                        onClick={() => setEditingNote(true)}
                        className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                      >
                        <FiEdit3 className="w-3.5 h-3.5" />
                        Editar nota
                      </button>
                    )}
                  </div>
                ) : canEditNote ? (
                  <button
                    onClick={() => setEditingNote(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-dashed border-slate-300 dark:border-white/15 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-1.5"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                    Añadir nota para mis atletas
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tu coach no ha dejado nota en este ejercicio.</p>
                )}
              </Section>
            </div>

            {/* Footer con acciones */}
            {isCoach && (canEdit || onPickExercise) && (
              <div className="sticky bottom-0 bg-white dark:bg-coach-base border-t border-slate-200 dark:border-white/10 px-5 py-3 flex items-center justify-between gap-2">
                {canEdit && onEdit ? (
                  <button
                    onClick={() => onEdit(exercise)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1.5"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    Editar
                  </button>
                ) : <div />}
                {onPickExercise && (
                  <button
                    onClick={() => { onPickExercise(kind, exercise); onClose(); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    Usar en una sesión
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Stat = ({ label, value }) => (
  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/5">
    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{value}</div>
  </div>
);

const Section = ({ title, icon, children }) => (
  <div>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

export default ExerciseDetailModal;
