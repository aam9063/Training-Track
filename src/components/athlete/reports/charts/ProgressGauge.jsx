/**
 * Simple horizontal bar "gauge".
 * Expected data: { current: number, max: number, label?: string }
 */
export default function ProgressGauge({ data, caption }) {
  const isValid =
    data &&
    Number.isFinite(data.current) &&
    Number.isFinite(data.max) &&
    data.max > 0;

  if (!isValid) {
    return (
      <div className="rounded-xl border border-ath-border bg-ath-inset p-3">
        {caption ? (
          <p className="text-xs text-ath-text-muted">{caption}</p>
        ) : (
          <p className="text-xs text-ath-text-muted">Sin datos disponibles</p>
        )}
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (data.current / data.max) * 100));
  const label = data.label || 'Progreso';

  return (
    <div className="rounded-xl border border-ath-border bg-ath-surface p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-ath-text-primary">{label}</span>
        <span className="text-sm text-ath-text-secondary">
          <span className="font-bold text-ath-text-primary">{data.current}</span>
          <span className="text-ath-text-muted"> / {data.max}</span>
        </span>
      </div>
      <div
        className="h-3 w-full rounded-full bg-ath-inset overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-ath-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-ath-text-muted mt-2 text-right">{pct.toFixed(0)}%</p>
      {caption && (
        <p className="text-xs text-ath-text-muted mt-2 text-center">{caption}</p>
      )}
    </div>
  );
}
