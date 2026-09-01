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
} from 'react-icons/fi';
import { getAlerts, markRead, dismiss } from '../../services/trainingLoadAlertsService';
import { showError } from '../../lib/toast';

// One entry per training_load_alerts.alert_type (training-load-alerts spec
// "Alert Type Taxonomy" — exactly these four, never blended).
const ALERT_TYPE_CONFIG = {
  acwr_zone: { icon: FiActivity, label: 'Carga (ACWR)' },
  tsb_critical: { icon: FiTrendingDown, label: 'Forma (TSB)' },
  low_completion: { icon: FiCheckSquare, label: 'Adherencia' },
  high_rpe: { icon: FiZap, label: 'Esfuerzo (RPE)' },
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
 * Alert feed for `training_load_alerts` — lists open, non-dismissed alerts
 * for one athlete across all four signals, with read/dismiss actions and
 * es-ES copy from `message_es`. Used by both the coach dashboard
 * (per-athlete view) and the athlete's own pages — RLS decides what each
 * caller can actually see, this component just renders whatever
 * `getAlerts` returns for the given `athleteId`.
 *
 * @param {{athleteId: string, title?: string, compact?: boolean, emptyMessage?: string}} props
 */
const TrainingLoadAlertFeed = ({
  athleteId,
  title = 'Alertas de carga',
  compact = false,
  emptyMessage = 'Sin alertas activas',
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    try {
      const data = await getAlerts(athleteId, { status: 'open' });
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
    if (alert.read_at) return;
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, read_at: new Date().toISOString() } : a)));
    try {
      await markRead(alert.id);
    } catch (err) {
      showError(err?.message || 'No se pudo marcar como leída');
    }
  };

  const handleDismiss = async (alert) => {
    setBusyId(alert.id);
    try {
      await dismiss(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err) {
      showError(err?.message || 'No se pudo descartar la alerta');
    } finally {
      setBusyId(null);
    }
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
              const typeCfg = ALERT_TYPE_CONFIG[alert.alert_type] || ALERT_TYPE_CONFIG.acwr_zone;
              const sevCfg = SEVERITY_CLASSES[alert.severity] || SEVERITY_CLASSES.warning;
              const Icon = typeCfg.icon;
              const isUnread = !alert.read_at;

              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleRead(alert)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${sevCfg.bg} ${sevCfg.border}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-gray-800/60 ${sevCfg.icon}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sevCfg.badge}`}>
                        {typeCfg.label}
                      </span>
                      {isUnread && <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.icon.replace('text-', 'bg-')}`} />}
                      <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(alert.created_at)}</span>
                    </div>
                    <p className={`text-sm mt-1 leading-snug ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                      {alert.message_es}
                    </p>
                  </div>

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
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TrainingLoadAlertFeed;
