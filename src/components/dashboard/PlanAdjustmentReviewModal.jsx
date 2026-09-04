import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiLoader, FiXCircle, FiAlertTriangle, FiCalendar } from 'react-icons/fi';
import { showSuccess, showError } from '../../lib/toast';
import { getTypeLabel, getTypeColor } from '../../lib/athleteUtils';
import { approve, reject } from '../../services/planAdjustmentService';

/**
 * Coach review modal for one `plan_adjustment_suggestions` row (Agent 3).
 * Modeled on AIPlanReviewModal.jsx's overall shell/confirm-action pattern,
 * but READ-ONLY over the diff — the coach approves or rejects the
 * already-computed patch; editing it would invalidate the snapshot guard
 * and is out of scope for slice 1 (design.md's Frontend section).
 *
 * IMPORTANT — this does NOT reuse AIPlanReviewModal's TYPE_CONFIG/DAY_MAP.
 * Those two constants are keyed off that modal's own in-memory *draft*
 * plan-JSON vocabulary (`training_type: 'carrera'|'gimnasio'|'descanso'`,
 * `day_of_week: 'monday'|…`), which is never what gets persisted (see
 * design.md's V8 finding: the real INSERT path always writes
 * `training_type='running'` regardless, a separate pre-existing bug).
 * `patch`/`snapshot` on this table are diffs over the REAL
 * `training_sessions` row shape instead — the real ENUM
 * (`running|gym|rest|cross_training`) and real `scheduled_date` values —
 * so this modal reuses `getTypeLabel`/`getTypeColor` from
 * `lib/athleteUtils.js` instead, which are already keyed off that exact
 * real vocabulary (used by AthleteProfile.jsx's own week grid). Flagged in
 * this batch's apply-progress as a design.md correction, not a silent
 * deviation.
 */

const PATCH_TYPE_LABELS = {
  deload_volume: 'Reducción de volumen',
  insert_recovery: 'Día de recuperación',
  reduce_frequency: 'Reducción de frecuencia',
};

const FINDING_SOURCE_LABELS = {
  acwr_zone: 'Carga (ACWR)',
  tsb_critical: 'Forma (TSB)',
  low_completion: 'Cumplimiento semanal',
};

/**
 * Derive a diff array from the suggestion's own `patch` + `snapshot` —
 * NEVER by re-querying `training_sessions` (design.md: "keeps the modal
 * showing exactly what the coach is being asked to approve"). Only the
 * fields the core module actually snapshots
 * (`scheduled_date, status, training_type, estimated_duration_minutes,
 * title`) can be compared before/after; `description` is patchable but not
 * snapshotted, so it is surfaced as an after-only supplementary line, not
 * a before/after pair.
 */
const buildDiffs = (suggestion) => {
  const patchSessions = suggestion?.patch?.sessions || {};
  const snapshotSessions = suggestion?.snapshot?.sessions || {};

  return Object.keys(patchSessions)
    .map((sessionId) => {
      const patchFields = patchSessions[sessionId] || {};
      const snap = snapshotSessions[sessionId] || {};
      return {
        sessionId,
        scheduledDate: snap.scheduled_date,
        changedFields: Object.keys(patchFields),
        before: {
          trainingType: snap.training_type,
          durationMinutes: snap.estimated_duration_minutes,
          title: snap.title,
        },
        after: {
          trainingType: patchFields.training_type ?? snap.training_type,
          durationMinutes: patchFields.estimated_duration_minutes ?? snap.estimated_duration_minutes,
          title: patchFields.title ?? snap.title,
        },
        descriptionAfter: patchFields.description,
      };
    })
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
};

const formatDayLabel = (dateStr) => {
  if (!dateStr) return '';
  // Append a fixed midday time before parsing a date-only string — the
  // same guard used throughout AthleteProfile.jsx to avoid the UTC
  // rollback this project has documented (`timezone_date_bug`).
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const PlanAdjustmentReviewModal = ({ isOpen, onClose, suggestion, athleteName, onApplied }) => {
  const [busy, setBusy] = useState(false);
  const [driftRefusal, setDriftRefusal] = useState(false);

  const diffs = useMemo(() => buildDiffs(suggestion), [suggestion]);

  if (!isOpen || !suggestion) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      const result = await approve(suggestion.id);
      if (result.applied) {
        showSuccess('Ajuste de plan aplicado correctamente');
        onApplied?.(result);
        onClose();
      } else if (result.refusalReason === 'snapshot_drift') {
        // El plan cambió desde que se calculó esta sugerencia — la
        // sugerencia ya quedó 'superseded' en el servidor, cero sesiones
        // escritas. No cerramos el modal solo: dejamos que el coach vea el
        // mensaje y decida cuándo cerrar.
        setDriftRefusal(true);
      } else {
        showError('No se pudo aplicar el ajuste');
      }
    } catch (err) {
      showError(err.message || 'Error al aplicar el ajuste');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await reject(suggestion.id);
      showSuccess('Sugerencia rechazada');
      onApplied?.({ applied: false, refusalReason: 'rejected', sessionIds: [] });
      onClose();
    } catch (err) {
      showError(err.message || 'Error al rechazar la sugerencia');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseAfterDrift = () => {
    onApplied?.({ applied: false, refusalReason: 'snapshot_drift', sessionIds: [] });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="plan-adjustment-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-coach-surface rounded-2xl shadow-2xl w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-coach-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    {PATCH_TYPE_LABELS[suggestion.patch_type] || 'Ajuste de plan sugerido'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {FINDING_SOURCE_LABELS[suggestion.finding_source] || suggestion.finding_source}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {athleteName || 'este atleta'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                >
                  <FiX className="w-5 h-5 text-coach-text-muted" />
                </button>
              </div>
              {suggestion.message_es && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{suggestion.message_es}</p>
              )}
            </div>

            {/* Body: diff list */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
              {driftRefusal ? (
                <div className="flex flex-col items-center text-center gap-3 py-8">
                  <FiAlertTriangle className="w-8 h-8 text-amber-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    El plan cambió desde que se calculó esta sugerencia
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                    Una o más sesiones fueron modificadas desde entonces, así que no se aplicó ningún cambio.
                    Vuelve a intentarlo desde una nueva sugerencia si sigue siendo necesaria.
                  </p>
                </div>
              ) : diffs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No hay sesiones objetivo en esta sugerencia.
                </p>
              ) : (
                diffs.map((diff) => {
                  const beforeColor = getTypeColor(diff.before.trainingType);
                  const afterColor = getTypeColor(diff.after.trainingType);
                  const typeChanged = diff.before.trainingType !== diff.after.trainingType;
                  const durationChanged = diff.before.durationMinutes !== diff.after.durationMinutes;

                  return (
                    <div
                      key={diff.sessionId}
                      className="rounded-xl border border-gray-200 dark:border-coach-border p-3"
                    >
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500 dark:text-gray-400">
                        <FiCalendar className="w-3.5 h-3.5" />
                        <span className="capitalize">{formatDayLabel(diff.scheduledDate)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Before */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Antes</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium text-white ${beforeColor}`}>
                            {getTypeLabel(diff.before.trainingType)}
                          </span>
                          <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{diff.before.title}</p>
                          {diff.before.durationMinutes > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{diff.before.durationMinutes} min</p>
                          )}
                        </div>

                        {/* After */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Después</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium text-white ${afterColor} ${typeChanged ? 'ring-2 ring-offset-1 ring-sky-400' : ''}`}>
                            {getTypeLabel(diff.after.trainingType)}
                          </span>
                          <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{diff.after.title}</p>
                          {diff.descriptionAfter && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 italic truncate">
                              {diff.descriptionAfter}
                            </p>
                          )}
                          {diff.after.durationMinutes > 0 && (
                            <p className={`text-xs ${durationChanged ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {diff.after.durationMinutes} min
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-coach-border flex-shrink-0">
              {driftRefusal ? (
                <div className="flex justify-end">
                  <button
                    onClick={handleCloseAfterDrift}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleReject}
                    disabled={busy}
                    className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <FiXCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={busy || diffs.length === 0}
                    className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <FiCheck className="w-4 h-4" />
                        Aprobar ajuste
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlanAdjustmentReviewModal;
