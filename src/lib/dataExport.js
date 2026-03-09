/**
 * Data export utilities for athlete metrics.
 * Generates CSV and JSON downloads directly in the browser.
 */

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtPace(avgSpeedMs) {
  if (!avgSpeedMs || avgSpeedMs === 0) return '';
  const secPerKm = 1000 / avgSpeedMs;
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function fmtDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Export Strava activities as CSV.
 * @param {Array} activities - rawActivities from useStravaMetrics
 * @param {string} athleteName
 */
export function exportActivitiesCSV(activities, athleteName = 'atleta') {
  if (!activities || activities.length === 0) return;

  const headers = [
    'Fecha',
    'Tipo',
    'Nombre',
    'Distancia (km)',
    'Duración',
    'Ritmo (min/km)',
    'FC Media (bpm)',
    'FC Máxima (bpm)',
    'Elevación (m)',
    'Cadencia media (rpm)',
    'Calorías',
  ];

  const rows = activities.map((a) => [
    a.start_date_local ? a.start_date_local.split('T')[0] : '',
    a.sport_type || a.type || '',
    (a.name || '').replace(/,/g, ' '),
    a.distance ? (a.distance / 1000).toFixed(2) : '',
    fmtDuration(a.moving_time),
    fmtPace(a.average_speed),
    a.average_heartrate ? Math.round(a.average_heartrate) : '',
    a.max_heartrate ? Math.round(a.max_heartrate) : '',
    a.total_elevation_gain ? Math.round(a.total_elevation_gain) : '',
    a.average_cadence ? Math.round(a.average_cadence * 2) : '', // Strava stores per-leg
    a.calories ? Math.round(a.calories) : '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(','))
    .join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadFile('\uFEFF' + csv, `trainingtrack-actividades-${athleteName}-${date}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export weekly training load (ACWR) as CSV.
 * @param {Array} weeklyLoads - loadData.weeklyLoads from Metrics.jsx
 * @param {string} athleteName
 */
export function exportLoadCSV(weeklyLoads, athleteName = 'atleta') {
  if (!weeklyLoads || weeklyLoads.length === 0) return;

  const headers = ['Semana', 'Km totales', 'ACWR'];

  const rows = weeklyLoads.map((w) => [
    w.label,
    w.km,
    w.acwr !== null ? w.acwr : 'N/D',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${v}"`).join(','))
    .join('\n');

  const date = new Date().toISOString().split('T')[0];
  downloadFile('\uFEFF' + csv, `trainingtrack-carga-${athleteName}-${date}.csv`, 'text/csv;charset=utf-8');
}
