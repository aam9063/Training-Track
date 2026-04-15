import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
} from 'react-icons/fi';
import InfoTooltip from '../../common/InfoTooltip';
import { CHART_COLORS, ACTIVITY_COLORS } from '../../../lib/chartColors';

const getDateRangeForPeriod = (period) => {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case '7days': start.setDate(end.getDate() - 6); break;
    case '4weeks': start.setDate(end.getDate() - 27); break;
    case '6months': start.setMonth(end.getMonth() - 6); break;
    case '1year': start.setFullYear(end.getFullYear() - 1); break;
    default: start.setDate(end.getDate() - 6);
  }
  return { start, end };
};

const RUNNING_TYPES = ['Run', 'TrailRun', 'VirtualRun'];
const GYM_TYPES = ['WeightTraining', 'Workout', 'CrossFit'];

/**
 * Garmin-style stacked bar chart comparing running vs gym time across a
 * selectable date range.
 */
const TotalActivityTimeChart = ({ activities, selectedPeriod, onPeriodChange }) => {
  // Track the period that `dateRange` was derived from so that changes to the
  // parent-controlled prop reset the local range during render (no effect /
  // setState-in-effect required).
  const [rangeState, setRangeState] = useState(() => ({
    period: selectedPeriod,
    range: getDateRangeForPeriod(selectedPeriod),
  }));

  if (rangeState.period !== selectedPeriod) {
    setRangeState({
      period: selectedPeriod,
      range: getDateRangeForPeriod(selectedPeriod),
    });
  }

  const dateRange = rangeState.period === selectedPeriod
    ? rangeState.range
    : getDateRangeForPeriod(selectedPeriod);

  const setDateRange = (newRange) => {
    setRangeState({ period: selectedPeriod, range: newRange });
  };

  // Aggregate activities by day or week depending on period
  const buildChartData = () => {
    if (!activities?.length) return { labels: [], running: [], gym: [] };

    const { start, end } = dateRange;
    const labels = [];
    const runningData = [];
    const gymData = [];

    if (selectedPeriod === '7days') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toLocaleDateString('es-ES', { weekday: 'short' });
        labels.push(dayStr.charAt(0).toUpperCase() + dayStr.slice(1, 3));

        const dayActivities = activities.filter((a) => {
          const actDate = new Date(a.start_date_local);
          return actDate.toDateString() === d.toDateString();
        });

        const runningTime = dayActivities
          .filter((a) => RUNNING_TYPES.includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        const gymTime = dayActivities
          .filter((a) => GYM_TYPES.includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        runningData.push(Math.round(runningTime));
        gymData.push(Math.round(gymTime));
      }
    } else {
      const weeks = selectedPeriod === '4weeks' ? 4 : selectedPeriod === '6months' ? 26 : 52;
      for (let i = weeks - 1; i >= 0; i -= 1) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        if (selectedPeriod === '4weeks') {
          labels.push(weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        } else {
          labels.push(weekEnd.toLocaleDateString('es-ES', { month: 'short' }));
        }

        const weekActivities = activities.filter((a) => {
          const actDate = new Date(a.start_date_local);
          return actDate >= weekStart && actDate <= weekEnd;
        });

        const runningTime = weekActivities
          .filter((a) => RUNNING_TYPES.includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        const gymTime = weekActivities
          .filter((a) => GYM_TYPES.includes(a.type))
          .reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60;

        runningData.push(Math.round(runningTime));
        gymData.push(Math.round(gymTime));
      }
    }

    return { labels, running: runningData, gym: gymData };
  };

  const data = buildChartData();

  const formatDateRange = () => {
    const options = { day: 'numeric', month: 'short' };
    return `${dateRange.start.toLocaleDateString('es-ES', options)} - ${dateRange.end.toLocaleDateString('es-ES', options)}`;
  };

  const navigatePeriod = (direction) => {
    const days = selectedPeriod === '7days'
      ? 7
      : selectedPeriod === '4weeks'
        ? 28
        : selectedPeriod === '6months'
          ? 180
          : 365;
    const newEnd = new Date(dateRange.end);
    newEnd.setDate(newEnd.getDate() + (direction * days));

    // Don't navigate into the future
    if (newEnd > new Date()) return;

    const newStart = new Date(newEnd);
    newStart.setDate(newStart.getDate() - days + 1);
    setDateRange({ start: newStart, end: newEnd });
  };

  return (
    <div className="bg-ath-surface rounded-2xl border border-ath-border p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-ath-text-primary flex items-center">
            Tiempo Total por Actividad
            <InfoTooltip text="Tiempo de movimiento de cada actividad en el período seleccionado. Permite ver cómo se distribuye el esfuerzo en sesiones cortas vs largas." />
          </h3>
        </div>
      </div>

      {/* Period selector and date navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigatePeriod(-1)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronLeft className="w-5 h-5 text-ath-text-secondary" />
          </button>
          <button
            onClick={() => navigatePeriod(1)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="w-5 h-5 text-ath-text-secondary" />
          </button>
          <span className="text-xs sm:text-sm text-ath-text-secondary flex items-center space-x-1 whitespace-nowrap">
            <FiClock className="w-4 h-4 flex-shrink-0" />
            <span>{formatDateRange()}</span>
          </span>
        </div>

        <div className="flex items-center bg-ath-inset rounded-lg p-1">
          {[
            { value: '7days', label: '7d', labelSm: '7 días' },
            { value: '4weeks', label: '4s', labelSm: '4 semanas' },
            { value: '6months', label: '6m', labelSm: '6 meses' },
            { value: '1year', label: '1a', labelSm: '1 año' },
          ].map((periodOpt) => (
            <button
              key={periodOpt.value}
              onClick={() => onPeriodChange(periodOpt.value)}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                selectedPeriod === periodOpt.value
                  ? 'bg-ath-surface text-ath-text-primary shadow-sm'
                  : 'text-ath-text-secondary hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="sm:hidden">{periodOpt.label}</span>
              <span className="hidden sm:inline">{periodOpt.labelSm}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <Bar
          data={{
            labels: data.labels,
            datasets: [
              {
                label: 'Carrera',
                data: data.running,
                backgroundColor: ACTIVITY_COLORS.Run,
                borderRadius: 4,
                barPercentage: 0.7,
              },
              {
                label: 'Gimnasio y equipo de fitness',
                data: data.gym,
                backgroundColor: CHART_COLORS.gymSurface,
                borderRadius: 4,
                barPercentage: 0.7,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  padding: 20,
                },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} min`,
                },
              },
            },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                grid: { color: CHART_COLORS.grid },
                title: {
                  display: true,
                  text: 'Minutos',
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default TotalActivityTimeChart;
