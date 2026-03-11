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

/**
 * Infer the effective training type by checking keywords in title/description.
 * Coaches often create sessions as "running" but include Fuerza or Bici content.
 */
const BIKE_KEYWORDS = /bici|rodillo|ciclismo|cycling|bike/i;
const GYM_KEYWORDS = /fuerza|gimnasio|gym|pesas|weights|strength/i;

export const inferTrainingType = (session) => {
  const type = session.type || session.training_type;
  if (type === 'gym' || type === 'rest') return type;

  const title = (session.title || '').toLowerCase();
  const desc = (session.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  // If cross_training, check for bike keywords
  if (type === 'cross_training') {
    if (BIKE_KEYWORDS.test(text)) return 'bike';
    return 'cross_training';
  }

  // For "running" type, check if it's actually a bike or gym session
  if (BIKE_KEYWORDS.test(text) && !GYM_KEYWORDS.test(text)) return 'bike';
  if (GYM_KEYWORDS.test(text) && !BIKE_KEYWORDS.test(text)) return 'cross_training';

  return type || 'running';
};
