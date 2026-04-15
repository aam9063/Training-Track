import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';

const DEFAULT_PALETTE = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

/**
 * Compact doughnut chart for report sections.
 * Expected data: { segments: [{ label: string, value: number, color?: string }] }
 */
export default function DonutDistribution({ data, caption }) {
  const isValid =
    data && Array.isArray(data.segments) && data.segments.length > 0;

  const chartData = useMemo(() => {
    if (!isValid) return null;
    const labels = data.segments.map((s) => s.label ?? '—');
    const values = data.segments.map((s) =>
      Number.isFinite(s.value) ? Number(s.value) : 0
    );
    const colors = data.segments.map(
      (s, i) => s.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
    );
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
        },
      ],
    };
  }, [data, isValid]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10 }, boxWidth: 10, padding: 8 },
        },
        tooltip: { enabled: true },
      },
    }),
    []
  );

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

  return (
    <div className="rounded-xl border border-ath-border bg-ath-surface p-3">
      <div className="h-[200px]">
        <Doughnut data={chartData} options={options} />
      </div>
      {caption && (
        <p className="text-xs text-ath-text-muted mt-2 text-center">{caption}</p>
      )}
    </div>
  );
}
