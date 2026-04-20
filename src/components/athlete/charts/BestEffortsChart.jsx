import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FiTrendingUp, FiLoader } from 'react-icons/fi';
import { getBestEffortsEvolution } from '../../../services/metricsAnalyticsService';
import { MetricAIAnalyzer } from '../MetricAIAnalyzer';
import DateRangeSelector from './DateRangeSelector';

const DISTANCE_OPTIONS = [
  { key: '1K', label: '1K' },
  { key: '5K', label: '5K' },
  { key: '10K', label: '10K' },
  { key: 'half', label: 'Media' },
  { key: 'marathon', label: 'Maratón' },
];

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatTime = (sec) => {
  if (!Number.isFinite(sec)) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDateShort = (iso, crossesYear) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
  return crossesYear ? `${base} ${d.getFullYear()}` : base;
};

const formatDateFull = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function BestEffortsChart({ athleteId, athleteContext, range: rangeProp }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [active, setActive] = useState(['5K', '10K']);
  const [internalRange, setInternalRange] = useState(rangeProp ?? null);

  const range = rangeProp !== undefined ? rangeProp : internalRange;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!athleteId) return;
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await getBestEffortsEvolution(athleteId, 100);
      if (cancelled) return;
      if (error) {
        setErrorMsg(error.message || 'Error al cargar');
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const filteredRows = useMemo(() => {
    if (!range) return rows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return rows.filter((r) => new Date(r.activity_date) >= cutoff);
  }, [rows, range]);

  const grouped = useMemo(() => {
    const byKey = new Map();
    filteredRows.forEach((r) => {
      if (!byKey.has(r.distance_key)) byKey.set(r.distance_key, []);
      byKey.get(r.distance_key).push({
        date: r.activity_date,
        time_sec: r.elapsed_time_sec,
      });
    });
    return byKey;
  }, [filteredRows]);

  const { crossesYear, chartData } = useMemo(() => {
    const colors = {
      '1K': '#3b82f6',
      '5K': '#22c55e',
      '10K': '#f59e0b',
      half: '#ec4899',
      marathon: '#ef4444',
    };
    const allDates = new Set();
    active.forEach((key) => {
      (grouped.get(key) || []).forEach((pt) => allDates.add(pt.date));
    });
    const labels = Array.from(allDates).sort();
    const years = new Set(
      labels.map((iso) => new Date(iso).getFullYear()).filter((y) => Number.isFinite(y))
    );
    const cross = years.size > 1;

    const datasets = active.map((key) => {
      const series = grouped.get(key) || [];
      const map = new Map(series.map((s) => [s.date, s.time_sec]));
      return {
        label: DISTANCE_OPTIONS.find((o) => o.key === key)?.label || key,
        data: labels.map((d) => map.get(d) ?? null),
        borderColor: colors[key],
        backgroundColor: `${colors[key]}33`,
        spanGaps: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    return { crossesYear: cross, chartData: { labels, datasets } };
  }, [active, grouped]);

  const hasData = chartData.labels.length > 0 && active.length > 0;

  const aiData = useMemo(() => {
    const series = active.map((key) => ({
      distance: DISTANCE_OPTIONS.find((o) => o.key === key)?.label || key,
      evolution: (grouped.get(key) || []).map((pt) => ({
        date: pt.date,
        time_sec: pt.time_sec,
      })),
    }));
    return { series };
  }, [active, grouped]);

  return (
    <div className="bg-white dark:bg-ath-elevated rounded-2xl border border-ath-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FiTrendingUp className="w-5 h-5 text-ath-accent shrink-0" />
          <h3 className="text-base font-bold text-ath-text-primary truncate">
            Evolución de marcas
          </h3>
        </div>
        <MetricAIAnalyzer
          chartType="best_efforts"
          data={aiData}
          athleteContext={athleteContext}
          compact
          title="Análisis de evolución de marcas"
          disabled={!hasData}
        />
      </div>

      {rangeProp === undefined && (
        <div className="flex justify-end">
          <DateRangeSelector value={internalRange} onChange={setInternalRange} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {DISTANCE_OPTIONS.map((opt) => {
          const isActive = active.includes(opt.key);
          const available = grouped.has(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              disabled={!available}
              onClick={() => {
                setActive((prev) =>
                  prev.includes(opt.key)
                    ? prev.filter((k) => k !== opt.key)
                    : [...prev, opt.key]
                );
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-colors ${
                isActive
                  ? 'bg-ath-accent text-ath-on-accent'
                  : 'bg-ath-inset text-ath-text-secondary hover:bg-ath-border'
              } ${!available ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-ath-text-muted">
            <FiLoader className="w-6 h-6 animate-spin" />
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-center h-full text-xs text-red-500">
            {errorMsg}
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted text-center px-6">
            Aún no hay mejores esfuerzos registrados para las distancias seleccionadas.
          </div>
        ) : (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10 } },
                tooltip: {
                  callbacks: {
                    title: (items) => formatDateFull(items?.[0]?.label),
                    label: (ctx) => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y)}`,
                  },
                },
              },
              scales: {
                x: {
                  ticks: {
                    maxTicksLimit: 6,
                    autoSkip: true,
                    callback(value) {
                      const iso = this.getLabelForValue(value);
                      return formatDateShort(iso, crossesYear);
                    },
                  },
                },
                y: {
                  ticks: {
                    callback: (v) => formatTime(v),
                  },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
