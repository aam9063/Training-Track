import { Doughnut } from 'react-chartjs-2';
import { FiActivity } from 'react-icons/fi';
import { ACTIVITY_COLORS, ACTIVITY_BG_CLASSES } from '../../../lib/chartColors';

// Activity type labels in Spanish
const ACTIVITY_TYPE_LABELS = {
  Run: 'Carrera',
  TrailRun: 'Trail',
  VirtualRun: 'Carrera Virtual',
  Walk: 'Caminata',
  Hike: 'Senderismo',
  Ride: 'Ciclismo',
  VirtualRide: 'Ciclismo Virtual',
  Swim: 'Natación',
  WeightTraining: 'Pesas',
  Workout: 'Entrenamiento',
  CrossFit: 'CrossFit',
  Yoga: 'Yoga',
  Other: 'Otro',
};

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

/**
 * Doughnut chart summarising how time is split across activity types.
 * Pure presentational component: it receives `activities` as a prop and
 * derives the distribution internally.
 */
const ActivityTypeDistribution = ({ activities }) => {
  // Calculate distribution
  const distribution = {};
  let totalTime = 0;
  let totalDistance = 0;

  activities?.forEach((activity) => {
    const type = activity.type || 'Other';
    if (!distribution[type]) {
      distribution[type] = { count: 0, time: 0, distance: 0 };
    }
    distribution[type].count += 1;
    distribution[type].time += activity.moving_time || 0;
    distribution[type].distance += activity.distance || 0;
    totalTime += activity.moving_time || 0;
    totalDistance += activity.distance || 0;
  });

  // Sort by time and keep top 5
  const sortedTypes = Object.entries(distribution)
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, 5);

  const chartData = {
    labels: sortedTypes.map(([type]) => ACTIVITY_TYPE_LABELS[type] || type),
    datasets: [{
      data: sortedTypes.map(([, data]) => Math.round(data.time / 60)), // minutes
      backgroundColor: sortedTypes.map(([type]) => ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  if (!activities?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <FiActivity className="w-12 h-12 text-ath-text-muted mb-3" />
        <p className="text-ath-text-muted">No hay actividades</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Chart + List */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Doughnut chart */}
        <div className="w-36 h-36 flex-shrink-0">
          <Doughnut
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              cutout: '65%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const mins = ctx.parsed;
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      return ` ${ctx.label}: ${h > 0 ? `${h}h ` : ''}${m}m`;
                    },
                  },
                },
              },
            }}
          />
        </div>

        {/* List */}
        <div className="space-y-2 flex-1 w-full">
          {sortedTypes.map(([type, data]) => {
            const percentage = totalTime > 0 ? Math.round((data.time / totalTime) * 100) : 0;
            const dotClass = ACTIVITY_BG_CLASSES[type] || ACTIVITY_BG_CLASSES.other;
            return (
              <div key={type} className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
                <span className="flex-1 text-sm font-medium text-ath-text-secondary truncate">
                  {ACTIVITY_TYPE_LABELS[type] || type}
                </span>
                <span className="text-xs text-ath-text-muted whitespace-nowrap">
                  {data.count} act. · {formatTime(data.time)}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 w-8 text-right flex-shrink-0">
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-ath-border grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-ath-text-primary">{activities.length}</p>
          <p className="text-xs text-ath-text-muted">Actividades totales</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-ath-text-primary">{(totalDistance / 1000).toFixed(1)}</p>
          <p className="text-xs text-ath-text-muted">km totales</p>
        </div>
      </div>
    </div>
  );
};

export default ActivityTypeDistribution;
