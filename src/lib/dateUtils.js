/**
 * Format a Date to YYYY-MM-DD string using local timezone.
 *
 * IMPORTANT: Do NOT use date.toISOString().split('T')[0] for this purpose.
 * toISOString() converts to UTC, which shifts the date back by 1 day
 * for timezones ahead of UTC (e.g. CET/CEST in Spain).
 */
export const toLocalDateStr = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
