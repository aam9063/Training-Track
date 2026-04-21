import { useEffect, useMemo, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { CHART_COLORS, CHART_TOOLTIP } from '../../lib/chartColors';
import { downsampleStream } from '../../lib/trainingMetrics';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

/**
 * Compact reusable line chart for a single Strava stream (HR, pace,
 * elevation, cadence, temperature). Uses Chart.js directly via ref to avoid
 * the "Canvas is already in use" bug that react-chartjs-2 triggers when
 * several charts mount/unmount inside the same modal.
 *
 * Props:
 * - title:      string label shown above the chart
 * - xData:      array of x-axis values (numbers — typically kilometres)
 * - yData:      array of y-axis values (same length as xData)
 * - color:      line colour
 * - fillColor:  area fill below the line (optional)
 * - yFormatter: (v) => string — tooltip formatter for y
 * - xLabel:     axis label text (x)
 * - yLabel:     axis suffix used on tick labels (y)
 * - height:     pixel height of the canvas wrapper (default 180)
 * - zones:      optional [{min,max,color}] horizontal bands
 */
export default function ActivityStreamChart({
  title,
  xData,
  yData,
  color = CHART_COLORS.fatigue,
  fillColor,
  yFormatter,
  xLabel,
  yLabel,
  height = 180,
  zones = null,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const { labels, points, hasData } = useMemo(() => {
    if (!Array.isArray(xData) || !Array.isArray(yData) || xData.length === 0) {
      return { labels: [], points: [], hasData: false };
    }
    const len = Math.min(xData.length, yData.length);
    const xs = xData.slice(0, len);
    const ys = yData.slice(0, len);
    const xsDown = downsampleStream(xs, 300);
    const ysDown = downsampleStream(ys, 300);
    const has = ysDown.some((v) => Number.isFinite(Number(v)));
    return { labels: xsDown, points: ysDown, hasData: has };
  }, [xData, yData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasData) return undefined;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const zonePlugin =
      Array.isArray(zones) && zones.length > 0
        ? {
            id: 'stream-zone-bands',
            beforeDatasetsDraw(chart) {
              const { ctx, chartArea, scales } = chart;
              if (!ctx || !chartArea || !scales?.y) return;
              ctx.save();
              zones.forEach((z) => {
                if (z == null) return;
                const yMin = Number.isFinite(z.min) ? z.min : null;
                const yMax = Number.isFinite(z.max) ? z.max : null;
                if (yMin === null || yMax === null) return;
                const top = scales.y.getPixelForValue(yMax);
                const bottom = scales.y.getPixelForValue(yMin);
                ctx.fillStyle = z.color || CHART_COLORS.mutedLight;
                ctx.globalAlpha = 0.15;
                ctx.fillRect(
                  chartArea.left,
                  Math.min(top, bottom),
                  chartArea.right - chartArea.left,
                  Math.abs(bottom - top)
                );
              });
              ctx.restore();
            },
          }
        : null;

    const instance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: title || 'stream',
            data: points,
            borderColor: color,
            backgroundColor: fillColor || 'transparent',
            fill: Boolean(fillColor),
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: CHART_TOOLTIP.bg,
            titleColor: CHART_TOOLTIP.title,
            bodyColor: CHART_TOOLTIP.body,
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title(items) {
                if (!items.length) return '';
                const raw = items[0].label;
                const n = Number(raw);
                if (!Number.isFinite(n)) return `${raw}`;
                return `${n.toFixed(2)} km`;
              },
              label(ctx) {
                const v = ctx.parsed.y;
                if (yFormatter) return yFormatter(v);
                return `${title || ''}: ${v}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: xLabel
              ? { display: true, text: xLabel, color: CHART_COLORS.axisTick, font: { size: 10 } }
              : { display: false },
            grid: { color: CHART_COLORS.grid },
            ticks: {
              color: CHART_COLORS.axisTick,
              maxTicksLimit: 6,
              font: { size: 10 },
              callback(v) {
                const lab = this.getLabelForValue(v);
                const n = Number(lab);
                if (!Number.isFinite(n)) return lab;
                return `${n.toFixed(1)}`;
              },
            },
          },
          y: {
            title: yLabel
              ? { display: true, text: yLabel, color: CHART_COLORS.axisTick, font: { size: 10 } }
              : { display: false },
            grid: { color: CHART_COLORS.grid },
            ticks: {
              color: CHART_COLORS.axisTick,
              font: { size: 10 },
              callback(v) {
                if (yFormatter) return yFormatter(v);
                return v;
              },
            },
          },
        },
      },
      plugins: zonePlugin ? [zonePlugin] : [],
    });

    chartRef.current = instance;
    return () => {
      instance.destroy();
      chartRef.current = null;
    };
  }, [labels, points, color, fillColor, title, xLabel, yLabel, yFormatter, zones, hasData]);

  return (
    <div className="rounded-xl border border-ath-border bg-ath-surface p-3">
      {title && (
        <p className="text-xs font-semibold text-ath-text-secondary mb-2">{title}</p>
      )}
      <div style={{ height: `${height}px` }}>
        {hasData ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-ath-text-muted">
            Sin datos
          </div>
        )}
      </div>
    </div>
  );
}
