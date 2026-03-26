import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Sensation labels map to RPE midpoint values.
 * Used when the athlete selects a feeling rather than entering a numeric RPE.
 */
export const SENSATION_RPE_MAP = {
  facil: 2,
  normal: 5,
  duro: 7,
  muy_duro: 9,
};

export const SENSATIONS = [
  { key: 'facil', label: 'Fácil', rpe: 2, colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700' },
  { key: 'normal', label: 'Normal', rpe: 5, colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700' },
  { key: 'duro', label: 'Duro', rpe: 7, colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700' },
  { key: 'muy_duro', label: 'Muy duro', rpe: 9, colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700' },
];

/**
 * Marks a training session as completed with actual performance data.
 *
 * @param {string} sessionId - UUID of the training_session row
 * @param {Object} data
 * @param {number} data.distance - Actual distance in km (required)
 * @param {number|null} data.time - Actual time in minutes (optional)
 * @param {number} data.rpe - Rate of Perceived Exertion 1-10 (required)
 * @param {string|null} data.notes - Completion notes (optional)
 * @returns {{ data: Object|null, error: Error|null }}
 */
export const completeSessionManual = async (sessionId, { distance, time, rpe, notes }) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_distance_km: distance ?? null,
      actual_time_minutes: time != null ? Math.round(time) : null,
      rpe: rpe ?? null,
      completion_notes: notes || null,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }
  return { data, error: null };
};

/**
 * Returns aggregated completion stats for a user over the last N weeks.
 *
 * @param {string} userId - UUID of the athlete
 * @param {number} [weeks=4] - Number of weeks to look back
 * @returns {{ data: Object|null, error: Error|null }}
 *   data: { totalCompleted, totalPlanned, completionRate, avgRpe, totalKm }
 */
export const getCompletionStats = async (userId, weeks = 4) => {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceStr = toLocalDateStr(since);

  const { data, error } = await supabase
    .from('training_sessions')
    .select('status, actual_distance_km, rpe')
    .eq('athlete_id', userId)
    .gte('scheduled_date', sinceStr)
    .neq('training_type', 'rest');

  if (error) {
    return { data: null, error };
  }

  const sessions = data ?? [];
  const totalPlanned = sessions.length;
  const completed = sessions.filter(s => s.status === 'completed');
  const totalCompleted = completed.length;
  const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  const rpeValues = completed.filter(s => s.rpe != null).map(s => s.rpe);
  const avgRpe = rpeValues.length > 0
    ? Math.round((rpeValues.reduce((sum, v) => sum + v, 0) / rpeValues.length) * 10) / 10
    : null;

  const totalKm = completed
    .filter(s => s.actual_distance_km != null)
    .reduce((sum, s) => sum + parseFloat(s.actual_distance_km), 0);

  return {
    data: {
      totalCompleted,
      totalPlanned,
      completionRate,
      avgRpe,
      totalKm: Math.round(totalKm * 10) / 10,
    },
    error: null,
  };
};
