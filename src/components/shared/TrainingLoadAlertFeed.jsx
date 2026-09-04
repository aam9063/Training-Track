import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity,
  FiTrendingDown,
  FiCheckSquare,
  FiZap,
  FiAlertTriangle,
  FiX,
  FiLoader,
  FiShield,
  FiClock,
  FiUserX,
  FiEdit3,
  FiChevronRight,
} from 'react-icons/fi';
import { getMergedAlerts, markRead, dismiss } from '../../services/alertFeedService';
import { showError } from '../../lib/toast';
import PlanAdjustmentReviewModal from '../dashboard/PlanAdjustmentReviewModal';

// One entry per merged-feed `label` (alertFeedService.js's view-model) —
// icons are keyed off the normalized label, not the raw alert_type/severity
// column values, so neither training_load_alerts nor athlete_engagement_
// alerts' vocabulary leaks into this component. `plan_suggestion` rows are
// NOT keyed here — their label varies per patch_type (see
// alertFeedService.js's PATCH_TYPE_LABELS), so they're matched by
// `alert.source` instead, below.
const ALERT_LABEL_CONFIG = {
  'Carga (ACWR)': { icon: FiActivity },
  'Forma (TSB)': { icon: FiTrendingDown },
  'Cumplimiento semanal': { icon: FiCheckSquare },
  'Esfuerzo (RPE)': { icon: FiZap },
  Inactividad: { icon: FiClock },
  'Riesgo de abandono': { icon: FiUserX },
};

const SEVERITY_CLASSES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/60',
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/60',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  // Agent 3's plan_suggestion tone — deliberately distinct from
  // 'warning'/'critical': those two are read-only observations, this one
  // needs a coach decision (approve/reject via PlanAdjustmentReviewModal).
  action: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800/60',
    icon: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

/**
 * Merged alert feed — lists open, non-dismissed alerts for one athlete
 * across both `training_load_alerts` (four physiological signals) and
 * `athlete_engagement_alerts` (multi-week silence/churn risk), with
 * read/dismiss actions and es-ES copy. Used by both the coach dashboard
 * (per-athlete view) and the athlete's own pages — RLS decides what each
 * caller can actually see (a supervised athlete's own engagement source
 * naturally resolves to `[]`, no client-side role branching needed), this
 * component just renders whatever `getMergedAlerts` returns for the given
 * `athleteId`.
 *
 * @param {{athleteId: string, title?: string, compact?: boolean, emptyMessage?: string, athleteName?: string}} props
 */
const TrainingLoadAlertFeed = ({
  athleteId,
  title = 'Alertas',
  compact = false,
  emptyMessage = 'Sin alertas activas',
  athleteName,
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // `reviewSuggestion` holds the raw suggestion row (alert.payload) for
  // whichever plan_suggestion row the coach clicked "Revisar ajuste" on —
  // null closes PlanAdjustmentReviewModal. A supervised athlete's own view
  // never populates this: RLS already returns `[]` for plan_suggestion
  // rows on a self-query, so no `plan_suggestion` item — and therefore no
  // "Revisar ajuste" action — can ever appear on the athlete's own
  // Dashboard.jsx rendering of this same component.
  const [reviewSuggestion, setReviewSuggestion] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    try {
      const data = await getMergedAlerts(athleteId);
      setAlerts(data);
    } catch (err) {
      showError(err?.message || 'No se pudieron cargar las alertas');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRead = async (alert) => {
    if (alert.readAt) return;
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, readAt: new Date().toISOString() } : a)));
    try {
      await markRead(alert);
    } catch (err) {
      showError(err?.message || 'No se pudo marcar como leída');
    }
  };

  const handleDismiss = async (alert) => {
    setBusyId(alert.id);
    try {
      await dismiss(alert);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err) {
      showError(err?.message || 'No se pudo descartar la alerta');
    } finally {
      setBusyId(null);
    }
  };

  // Approve/reject inside the modal both resolve the suggestion to a
  // terminal status server-side — re-fetch rather than optimistically
  // patch, since approve() may also have refused (snapshot_drift), which
  // leaves the row in a different state than a plain "remove from list".
  const handleSuggestionResolved = () => {
    fetchAlerts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <FiLoader className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4'}>
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <FiAlertTriangle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          {alerts.length > 0 && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {alerts.length}
            </span>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <FiShield className="w-7 h-7 text-green-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {alerts.map((alert) => {
              const isPlanSuggestion = alert.source === 'plan_suggestion';
              const typeCfg = ALERT_LABEL_CONFIG[alert.label] || ALERT_LABEL_CONFIG['Carga (ACWR)'];
              const sevCfg = SEVERITY_CLASSES[alert.tone] || SEVERITY_CLASSES.warning;
              const Icon = isPlanSuggestion ? FiEdit3 : typeCfg.icon;
              const isUnread = !alert.readAt;

              // plan_suggestion rows open the review modal instead of the
              // plain read-toggle every other row does — approve/reject
              // are the two terminal actions for a suggestion, and both
              // live inside PlanAdjustmentReviewModal, not this row.
              const handleRowClick = () => {
                if (isPlanSuggestion) {
                  handleRead(alert);
                  setReviewSuggestion(alert.payload);
                  return;
                }
                handleRead(alert);
              };

              return (
                <motion.div
                  key={`${alert.source}-${alert.id}`}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleRowClick}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${sevCfg.bg} ${sevCfg.border}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-gray-800/60 ${sevCfg.icon}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sevCfg.badge}`}>
                        {alert.label}
                      </span>
                      {isUnread && <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.icon.replace('text-', 'bg-')}`} />}
                      <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(alert.createdAt)}</span>
                    </div>
                    <p className={`text-sm mt-1 leading-snug ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                      {alert.messageEs}
                    </p>
                  </div>

                  {isPlanSuggestion ? (
                    // No dismiss (×) for a suggestion — approve/reject are
                    // its only terminal actions, both inside the modal, so
                    // a one-click dismiss here would let a coach discard a
                    // plan change without ever seeing the diff.
                    <span className="p-1 flex items-center gap-0.5 flex-shrink-0 text-violet-600 dark:text-violet-400 text-xs font-medium">
                      Revisar
                      <FiChevronRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(alert);
                      }}
                      disabled={busyId === alert.id}
                      title="Descartar"
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-black/20 transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      {busyId === alert.id ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiX className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <PlanAdjustmentReviewModal
        isOpen={Boolean(reviewSuggestion)}
        onClose={() => setReviewSuggestion(null)}
        suggestion={reviewSuggestion}
        athleteName={athleteName}
        onApplied={handleSuggestionResolved}
      />
    </div>
  );
};

export default TrainingLoadAlertFeed;
