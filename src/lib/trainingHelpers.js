import { inferTrainingType } from './dateUtils';
import { toLocalDateStr } from './dateUtils';

/**
 * Shared training helper functions used by Training.jsx and MyPlan.jsx.
 * Extracted to avoid code duplication between coached and independent athlete views.
 */

export const getTypeLabel = (session) => {
  const t = typeof session === 'string' ? session : inferTrainingType(session);
  const labels = {
    running: 'Carrera',
    gym: 'Gimnasio',
    rest: 'Descanso',
    cross_training: 'Cross Training',
    bike: 'Bici / Rodillo',
  };
  return labels[t] || t;
};

export const getTypeColor = (session) => {
  const t = typeof session === 'string' ? session : inferTrainingType(session);
  const colors = {
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    gym: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    rest: 'bg-gray-100 text-gray-700 dark:bg-[#242424] dark:text-gray-400',
    cross_training: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    bike: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return colors[t] || colors.running;
};

export const isPastOrToday = (dateStr) => {
  if (!dateStr) return false;
  const todayStr = toLocalDateStr(new Date());
  return dateStr <= todayStr;
};

export const getPaceLabel = (paceCode) => {
  const paces = {
    R1: 'R1 - Regenerativo',
    R2: 'R2 - Aeróbico 1',
    R3: 'R3 - Aeróbico 2',
    R4: 'R4 - Aeróbico 3',
    R5: 'R5 - Umbral',
    R6: 'R6 - VO2 Bajo',
    R7: 'R7 - VO2 Alto',
    R8: 'R8 - Anaeróbico',
    R9: 'R9 - Velocidad',
    R10: 'R10 - Sprint',
  };
  return paces[paceCode] || paceCode;
};

export const formatDistance = (meters) => {
  if (!meters) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
};

export const formatRest = (seconds) => {
  if (!seconds) return null;
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}' ${secs}"` : `${mins} min`;
  }
  return `${seconds} seg`;
};
