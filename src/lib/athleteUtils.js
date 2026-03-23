/**
 * Pure utility functions extracted from AthleteProfile.jsx
 * for computing athlete metrics, formatting paces, etc.
 */

/**
 * Compute age from a birth date string.
 * @param {string|null} birthDate - ISO date string or null
 * @returns {number|null}
 */
export const computeAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Compute BMI from weight (kg) and height (cm).
 * @param {number|null} weightKg
 * @param {number|null} heightCm
 * @returns {string|null} BMI rounded to 1 decimal, or null
 */
export const computeBMI = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return (weightKg / (heightM * heightM)).toFixed(1);
};

/**
 * Format pace in seconds per km to m'ss" display string.
 * @param {number} secs - seconds per km
 * @returns {string}
 */
export const fmtPaceProfile = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
};

/**
 * Format recovery time in seconds to m'ss" or m' display string.
 * @param {number|null} secs
 * @returns {string}
 */
export const fmtRecProfile = (secs) => {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}'${String(s).padStart(2, '0')}"` : `${m}'`;
};

/**
 * Format VAM pace in seconds to m'ss" display string.
 * @param {number|null} secs
 * @returns {string}
 */
export const fmtVamProfile = (secs) => {
  if (!secs) return '\u2013';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
};

/**
 * Format dias_disponibles + horas_por_dia for display.
 * @param {object|null} dias - e.g. { L: true, M: false, ... }
 * @param {object|null} horas - e.g. { L: 1.5, M: null, ... }
 * @returns {Array|null}
 */
export const formatAvailableDays = (dias, horas) => {
  if (!dias || typeof dias !== 'object') return null;
  const dayLabels = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' };
  const dayOrder = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return dayOrder
    .filter((d) => dias[d])
    .map((d) => ({ day: dayLabels[d] || d, hours: horas?.[d] ?? '\u2014' }));
};

/**
 * Map modality codes to Spanish labels.
 */
export const modalityLabels = {
  '800m': '800m', '1500m': '1500m', '5K': '5K', '10K': '10K',
  media_maraton: 'Media Maratón', maraton: 'Maratón', trail: 'Trail',
};

/**
 * Map goal codes to Spanish labels.
 */
export const goalLabels = {
  empezar: 'Empezar a correr', completar: 'Completar distancia',
  mejorar_marca: 'Mejorar marca', salud: 'Salud y forma',
};

/**
 * Get training type background color class.
 * @param {string} type
 * @returns {string}
 */
export const getTypeColor = (type) => {
  const colors = {
    running: 'bg-blue-500',
    gym: 'bg-purple-500',
    rest: 'bg-gray-400',
    cross_training: 'bg-orange-500',
    race: 'bg-red-500',
  };
  return colors[type] || 'bg-gray-400';
};

/**
 * Get training type Spanish label.
 * @param {string} type
 * @returns {string}
 */
export const getTypeLabel = (type) => {
  const labels = {
    running: 'Carrera',
    gym: 'Gimnasio',
    rest: 'Descanso',
    cross_training: 'Cross',
    race: 'Competición',
  };
  return labels[type] || type;
};

/**
 * Get ISO week number from a date.
 * @param {Date|string} date
 * @returns {number}
 */
export const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/**
 * Ordered pace codes for Conconi display.
 */
export const PACE_ORDER = ['RM', 'R10', 'R9', 'R8', 'R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1', 'RR'];

/**
 * Background color classes per pace code.
 */
export const PACE_BG_COLORS = {
  RM: 'bg-red-600', R10: 'bg-red-500', R9: 'bg-red-400', R8: 'bg-orange-500',
  R7: 'bg-orange-400', R6: 'bg-yellow-500', R5: 'bg-yellow-400', R4: 'bg-lime-400',
  R3: 'bg-lime-500', R2: 'bg-green-400', R1: 'bg-green-500', RR: 'bg-emerald-600',
};

/**
 * Percentage labels per pace code.
 */
export const PACE_PCT_LABELS = {
  RM: '100%', R10: '92%', R9: '90%', R8: '88%', R7: '86%', R6: '84%',
  R5: '82%', R4: '78%', R3: '72%', R2: '62%', R1: '50%', RR: '42%',
};

/**
 * Compute sorted Conconi paces from athlete data.
 * @param {Array} athletePaces - athlete.athlete_paces array
 * @returns {Array}
 */
export const getConconiSorted = (athletePaces) => {
  return PACE_ORDER.map(code => athletePaces?.find(p => p.pace_code === code)).filter(Boolean);
};

/**
 * Compute Conconi series recovery mapping.
 * @param {object|null} latestConconi - athlete.latest_conconi
 * @param {Array} conconiSorted - sorted paces from getConconiSorted
 * @returns {object} - pace_code -> recovery_time_seconds mapping
 */
export const getConconiSeriesRecovery = (latestConconi, conconiSorted) => {
  const recovery = {};
  if (latestConconi?.conconi_test_series) {
    const series = [...latestConconi.conconi_test_series].sort((a, b) => a.series_number - b.series_number);
    const totalSeries = series.length;
    const totalPaces = conconiSorted.length;
    conconiSorted.forEach((pace, i) => {
      if (pace.pace_code === 'RR') return;
      const seriesIdx = Math.round((i / (totalPaces - 1)) * (totalSeries - 1));
      const s = series[Math.min(seriesIdx, totalSeries - 1)];
      if (s?.recovery_time_seconds) recovery[pace.pace_code] = s.recovery_time_seconds;
    });
  }
  return recovery;
};

/**
 * Compute VAM derived values from athlete's latest_vam data.
 * @param {object|null} vamData - athlete.latest_vam
 * @returns {object} - { vamKmhVal, vamVo2maxVal, vamMlssKmhVal, vamMlssPaceVal, vamVt2KmhVal, vamVt2PaceVal }
 */
/**
 * Compute all Conconi-derived variables from athlete data.
 * @param {Array|null} athletePaces - athlete.athlete_paces array
 * @param {object|null} latestConconi - athlete.latest_conconi
 * @returns {object} - { conconiSorted, conconiSeriesRecovery, conconiMaxHr, conconiR10, conconiFirstRecov }
 */
export const computeConconiVars = (athletePaces, latestConconi) => {
  const conconiSorted = getConconiSorted(athletePaces);
  const conconiSeriesRecovery = getConconiSeriesRecovery(latestConconi, conconiSorted);
  const conconiMaxHr = latestConconi?.max_hr_reached ?? null;
  const conconiR10 = athletePaces?.find(p => p.pace_code === 'R10') ?? null;
  const conconiFirstRecov = Object.values(conconiSeriesRecovery)[0] ?? null;
  return { conconiSorted, conconiSeriesRecovery, conconiMaxHr, conconiR10, conconiFirstRecov };
};

/**
 * Compute VO2max gauge SVG data (rating, arc positioning, segment colors).
 * @param {number} vo2max - numeric VO2max value
 * @param {string} sexo - 'M' or 'F'
 * @returns {object} - { vo2, isMale, ranges, rating, gaugeMin, gaugeMax, ratio, angle, cx, cy, r, dotX, dotY, segmentColors, segmentCount }
 */
export const computeVo2maxGauge = (vo2max, sexo) => {
  const vo2 = Number(vo2max);
  const isMale = sexo === 'M';
  const ranges = isMale
    ? [{ max: 30, label: 'Pobre' }, { max: 37, label: 'Regular' }, { max: 45, label: 'Bueno' }, { max: 52, label: 'Muy bueno' }, { max: Infinity, label: 'Excelente' }]
    : [{ max: 25, label: 'Pobre' }, { max: 32, label: 'Regular' }, { max: 38, label: 'Bueno' }, { max: 45, label: 'Muy buena' }, { max: Infinity, label: 'Excelente' }];
  const rating = ranges.find((r) => vo2 < r.max)?.label || 'Excelente';
  const gaugeMin = isMale ? 15 : 12;
  const gaugeMax = isMale ? 65 : 58;
  const clampedVal = Math.max(gaugeMin, Math.min(gaugeMax, vo2));
  const ratio = (clampedVal - gaugeMin) / (gaugeMax - gaugeMin);
  const angle = Math.PI * (1 - ratio);
  const cx = 120, cy = 110, r = 90;
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);
  const segmentColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#8B5CF6'];
  const segmentCount = 5;
  return { vo2, isMale, ranges, rating, gaugeMin, gaugeMax, ratio, angle, cx, cy, r, dotX, dotY, segmentColors, segmentCount };
};

export const computeVamValues = (vamData) => {
  const vamKmhVal = vamData ? parseFloat(vamData.vam_kmh) : null;
  const vamVo2maxVal = vamKmhVal ? (vamKmhVal * 3.5).toFixed(1) : null;
  const vamMlssKmhVal = vamKmhVal ? (vamKmhVal * 0.88).toFixed(1) : null;
  const vamMlssPaceVal = vamKmhVal ? Math.round(3600 / (vamKmhVal * 0.88)) : null;
  const vamVt2KmhVal = vamKmhVal ? (vamKmhVal * 0.875).toFixed(1) : null;
  const vamVt2PaceVal = vamKmhVal ? Math.round(3600 / (vamKmhVal * 0.875)) : null;
  return { vamKmhVal, vamVo2maxVal, vamMlssKmhVal, vamMlssPaceVal, vamVt2KmhVal, vamVt2PaceVal };
};
