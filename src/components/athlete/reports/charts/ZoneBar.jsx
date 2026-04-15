const ZONE_PALETTE = [
  '#9ca3af', // Z1 gris
  '#22c55e', // Z2 verde
  '#3b82f6', // Z3 azul
  '#f59e0b', // Z4 ámbar
  '#ef4444', // Z5 rojo
  '#8b5cf6', // Z6 púrpura
];

/**
 * Horizontal stacked bar for training zones.
 * Expected data: { zones: [{ zone: string, pct: number, color?: string }] }
 */
export default function ZoneBar({ data, caption }) {
  const isValid = data && Array.isArray(data.zones) && data.zones.length > 0;

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

  // Normalise to 100.
  const rawSum = data.zones.reduce(
    (acc, z) => acc + (Number.isFinite(z.pct) ? Math.max(0, Number(z.pct)) : 0),
    0
  );
  const normaliser = rawSum > 0 ? 100 / rawSum : 0;

  const zones = data.zones.map((z, i) => {
    const rawPct = Number.isFinite(z.pct) ? Math.max(0, Number(z.pct)) : 0;
    return {
      zone: z.zone || `Z${i + 1}`,
      pct: rawPct * normaliser,
      color: z.color || ZONE_PALETTE[i % ZONE_PALETTE.length],
    };
  });

  return (
    <div className="rounded-xl border border-ath-border bg-ath-surface p-4">
      <div
        className="h-4 w-full rounded-full overflow-hidden flex bg-ath-inset"
        role="img"
        aria-label="Distribución por zona"
      >
        {zones.map((z, i) => (
          <div
            key={`${z.zone}-${i}`}
            title={`${z.zone}: ${z.pct.toFixed(0)}%`}
            className="h-full transition-all"
            style={{ width: `${z.pct}%`, backgroundColor: z.color }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
        {zones.map((z, i) => (
          <div key={`legend-${z.zone}-${i}`} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: z.color }}
            />
            <span className="text-xs text-ath-text-secondary truncate">
              {z.zone}
            </span>
            <span className="text-xs text-ath-text-muted ml-auto">
              {z.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {caption && (
        <p className="text-xs text-ath-text-muted mt-3 text-center">{caption}</p>
      )}
    </div>
  );
}
