import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

/**
 * Compact line chart for report sections.
 * Expected data: { x: string[], y: number[], label?: string }
 */
export default function LineTrend({ data, caption }) {
  const isValid =
    data &&
    Array.isArray(data.x) &&
    Array.isArray(data.y) &&
    data.x.length > 0 &&
    data.x.length === data.y.length;

  const chartData = useMemo(() => {
    if (!isValid) return null;
    return {
      labels: data.x,
      datasets: [
        {
          label: data.label || 'Serie',
          data: data.y,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: 'rgb(34, 197, 94)',
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [data, isValid]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
          ticks: { font: { size: 10 } },
        },
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
        <Line data={chartData} options={options} />
      </div>
      {caption && (
        <p className="text-xs text-ath-text-muted mt-2 text-center">{caption}</p>
      )}
    </div>
  );
}
