import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';

/**
 * Compact bar comparison chart for report sections.
 * Expected data: { labels: string[], values: number[] }
 */
export default function BarComparison({ data, caption }) {
  const isValid =
    data &&
    Array.isArray(data.labels) &&
    Array.isArray(data.values) &&
    data.labels.length > 0 &&
    data.labels.length === data.values.length;

  const chartData = useMemo(() => {
    if (!isValid) return null;
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Valor',
          data: data.values,
          backgroundColor: 'rgba(34, 197, 94, 0.65)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
          borderRadius: 6,
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
        <Bar data={chartData} options={options} />
      </div>
      {caption && (
        <p className="text-xs text-ath-text-muted mt-2 text-center">{caption}</p>
      )}
    </div>
  );
}
