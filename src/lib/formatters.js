/**
 * Shared formatting helpers for UI display.
 *
 * Pace formatting lives in `trainingMetrics.js` (formatPace) because it is
 * tightly coupled to the VDOT/pace domain. Keep this file for generic
 * display helpers that don't depend on any training domain concept.
 */

/**
 * Format a minute count as either "Xh Ym" or "Ym". Returns "–" for nullish.
 */
export const formatMinutes = (totalMinutes) => {
  if (totalMinutes === null || totalMinutes === undefined) return '–';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/**
 * Format a decimal pace value in min/km as "M:SS".
 * Accepts values like 5.5 → "5:30". Returns "–" for nullish / zero.
 */
export const formatDecimalPace = (minPerKm) => {
  if (minPerKm === null || minPerKm === undefined || minPerKm === 0) return '–';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
