import { useState } from 'react';
import { FiZap, FiLock } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import useAiAnalysisQuota from '../../hooks/useAiAnalysisQuota';
import AiAnalysisPanel from './AiAnalysisPanel';

/**
 * Reusable AI analyzer trigger.
 *
 * Props:
 *  - chartType: string
 *  - data: object (payload sent to the edge function)
 *  - athleteContext: { nivel, objetivo, vam } | null
 *  - compact?: boolean (icon only)
 *  - label?: string (overrides default button text)
 *  - title?: string (modal title)
 *  - disabled?: boolean (external gating, e.g. empty data)
 */
export default function MetricAIAnalyzer({
  chartType,
  data,
  athleteContext,
  compact = false,
  label = 'Analizar con IA',
  title,
  disabled = false,
}) {
  const quota = useAiAnalysisQuota();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const noQuota = !quota.loading && !quota.canUse;
  const isDisabled = disabled || quota.loading;

  const handleClick = () => {
    if (isDisabled) return;
    if (noQuota) {
      setUpgradeOpen(true);
      return;
    }
    setOpen(true);
  };

  const baseBtn = compact
    ? 'w-9 h-9 rounded-lg flex items-center justify-center'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold';

  const btnClass = noQuota
    ? `${baseBtn} bg-ath-inset text-ath-text-muted cursor-not-allowed`
    : `${baseBtn} bg-ath-accent-surface text-ath-accent hover:bg-ath-accent hover:text-ath-on-accent transition-colors`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled && !noQuota}
        title={noQuota ? 'Cuota mensual agotada' : 'Obtén un análisis personalizado con IA'}
        aria-label={label}
        className={`${btnClass} ${isDisabled ? 'opacity-60' : ''}`}
      >
        {noQuota ? (
          <FiLock className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        ) : (
          <FiZap className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        )}
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <AiAnalysisPanel
          open={open}
          onClose={() => {
            setOpen(false);
            quota.refetch();
          }}
          chartType={chartType}
          data={data}
          athleteContext={athleteContext}
          title={title || label}
          onSuccess={() => quota.refetch()}
        />
      )}

      {upgradeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setUpgradeOpen(false)}
        >
          <div
            className="relative w-full sm:max-w-md bg-ath-surface rounded-t-3xl sm:rounded-2xl border border-ath-border shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <FiLock className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-ath-text-primary">
                Cuota mensual agotada
              </h3>
              <p className="text-sm text-ath-text-secondary">
                Ya has usado todos tus análisis con IA de este mes. Actualiza a Premium para desbloquear análisis ilimitados.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(false)}
                  className="px-4 py-2 rounded-lg bg-ath-inset text-ath-text-primary text-sm font-semibold hover:bg-ath-border transition-colors"
                >
                  Cerrar
                </button>
                <Link
                  to="/pricing"
                  onClick={() => setUpgradeOpen(false)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-ath-accent text-ath-on-accent text-sm font-semibold hover:bg-ath-accent-hover transition-colors"
                >
                  <FiZap className="w-4 h-4" />
                  Ver planes
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
