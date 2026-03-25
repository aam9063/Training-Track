import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

// ─── Achievement definitions ──────────────────────────────────────────────────

/**
 * Static achievement definitions evaluated client-side from training_sessions data.
 * Each has: id, title, description, icon, condition(stats) → boolean
 */
export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first_session',
    title: 'Primera sesión',
    description: 'Completaste tu primera sesión de entrenamiento',
    icon: '🏃',
    category: 'hitos',
  },
  {
    id: 'first_week',
    title: 'Primera semana completada',
    description: 'Completaste todas las sesiones de una semana',
    icon: '📅',
    category: 'hitos',
  },
  {
    id: 'streak_7',
    title: 'Racha de 7 días',
    description: '7 días consecutivos de entrenamiento',
    icon: '🔥',
    category: 'racha',
  },
  {
    id: 'streak_14',
    title: 'Racha de 14 días',
    description: '14 días consecutivos de entrenamiento',
    icon: '⚡',
    category: 'racha',
  },
  {
    id: 'streak_30',
    title: 'Racha de un mes',
    description: '30 días consecutivos de entrenamiento',
    icon: '🌟',
    category: 'racha',
  },
  {
    id: 'sessions_10',
    title: '10 sesiones completadas',
    description: 'Has completado 10 sesiones de entrenamiento',
    icon: '💪',
    category: 'volumen',
  },
  {
    id: 'sessions_50',
    title: '50 sesiones completadas',
    description: 'Has completado 50 sesiones de entrenamiento',
    icon: '🏅',
    category: 'volumen',
  },
  {
    id: 'km_100',
    title: '100 km acumulados',
    description: 'Has registrado 100 km en total',
    icon: '🗺️',
    category: 'volumen',
  },
  {
    id: 'km_500',
    title: '500 km acumulados',
    description: 'Has registrado 500 km en total',
    icon: '🌍',
    category: 'volumen',
  },
  {
    id: 'first_ai_plan',
    title: 'Primer plan IA',
    description: 'Generaste tu primer plan de entrenamiento con IA',
    icon: '🤖',
    category: 'hitos',
  },
  {
    id: 'first_competition',
    title: 'Primera competición',
    description: 'Registraste tu primera competición',
    icon: '🏆',
    category: 'hitos',
  },
  {
    id: 'weekly_streak_4',
    title: '4 semanas activas',
    description: '4 semanas consecutivas con al menos una sesión completada',
    icon: '📈',
    category: 'constancia',
  },
  {
    id: 'rpe_consistent',
    title: 'Esfuerzo consistente',
    description: '10 sesiones con RPE registrado',
    icon: '📊',
    category: 'calidad',
  },
];

// ─── Streak calculation ───────────────────────────────────────────────────────

/**
 * Calculate current daily streak: consecutive days (going backwards from today)
 * that have at least one completed non-rest session.
 *
 * @param {string} userId
 * @returns {{ data: { dailyStreak: number, weeklyStreak: number }, error: Error|null }}
 */
export async function getStreak(userId) {
  if (!userId) return { data: { dailyStreak: 0, weeklyStreak: 0 }, error: null };

  const since = new Date();
  since.setDate(since.getDate() - 90); // look back 90 days max

  const { data, error } = await supabase
    .from('training_sessions')
    .select('scheduled_date, status, training_type')
    .eq('athlete_id', userId)
    .eq('status', 'completed')
    .neq('training_type', 'rest')
    .gte('scheduled_date', toLocalDateStr(since))
    .order('scheduled_date', { ascending: false });

  if (error) return { data: { dailyStreak: 0, weeklyStreak: 0 }, error };

  const sessions = data ?? [];

  // ── Daily streak ────────────────────────────────────────────────────────────
  const completedDates = new Set(sessions.map(s => s.scheduled_date));
  let dailyStreak = 0;
  const cursor = new Date();
  // If today has no completed session yet, start counting from yesterday
  if (!completedDates.has(toLocalDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completedDates.has(toLocalDateStr(cursor))) {
    dailyStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ── Weekly streak ───────────────────────────────────────────────────────────
  // Build a set of ISO week keys (YYYY-Www) from completed session dates
  const completedWeeks = new Set(
    sessions.map(s => {
      const d = new Date(s.scheduled_date + 'T00:00:00');
      return getISOWeekKey(d);
    })
  );

  let weeklyStreak = 0;
  const weekCursor = new Date();
  // Start from the current week; if no session this week, start from last week
  if (!completedWeeks.has(getISOWeekKey(weekCursor))) {
    weekCursor.setDate(weekCursor.getDate() - 7);
  }
  while (completedWeeks.has(getISOWeekKey(weekCursor))) {
    weeklyStreak++;
    weekCursor.setDate(weekCursor.getDate() - 7);
  }

  return { data: { dailyStreak, weeklyStreak }, error: null };
}

/**
 * Returns the ISO year-week string (e.g., "2025-W12") for a given date.
 * Used for weekly streak calculation.
 *
 * @param {Date} date
 * @returns {string}
 */
function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ─── Achievement evaluation ───────────────────────────────────────────────────

/**
 * Evaluate which achievements the athlete has unlocked.
 * All computed client-side from existing data (no new table needed).
 *
 * @param {string} userId
 * @returns {{ data: Array<{ id, title, description, icon, category, unlockedAt }>, error: Error|null }}
 */
export async function checkAchievements(userId) {
  if (!userId) return { data: [], error: null };

  // Fetch all data needed for achievement evaluation in parallel
  const [sessionsRes, plansRes, competitionsRes, streakRes] = await Promise.all([
    // All completed non-rest sessions
    supabase
      .from('training_sessions')
      .select('id, scheduled_date, status, training_type, rpe, actual_distance_km, completed_at')
      .eq('athlete_id', userId)
      .eq('status', 'completed')
      .neq('training_type', 'rest')
      .order('scheduled_date', { ascending: true }),

    // AI-generated plans (coach_id IS NULL, created_by = userId)
    supabase
      .from('training_plans')
      .select('id, created_at')
      .eq('created_by', userId)
      .is('coach_id', null)
      .order('created_at', { ascending: true })
      .limit(1),

    // Competitions registered by this athlete
    supabase
      .from('competitions')
      .select('id, event_date')
      .eq('athlete_id', userId)
      .is('coach_id', null)
      .order('event_date', { ascending: true })
      .limit(1),

    // Streak data
    getStreak(userId),
  ]);

  const sessions = sessionsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const competitions = competitionsRes.data ?? [];
  const { data: streakData } = streakRes;

  // ── Compute stats ───────────────────────────────────────────────────────────
  const totalSessions = sessions.length;
  const totalKm = sessions.reduce((sum, s) => sum + (parseFloat(s.actual_distance_km) || 0), 0);
  const rpeSessionsCount = sessions.filter(s => s.rpe != null).length;
  const { dailyStreak, weeklyStreak } = streakData ?? { dailyStreak: 0, weeklyStreak: 0 };

  // Determine if any week had ALL sessions completed (simplified: check if there
  // are any weeks where planned vs completed ratio = 1)
  // For v1, we check if user has completed at least 3 sessions in a single week
  const sessionsByWeek = {};
  sessions.forEach(s => {
    const wk = getISOWeekKey(new Date(s.scheduled_date + 'T00:00:00'));
    sessionsByWeek[wk] = (sessionsByWeek[wk] ?? 0) + 1;
  });
  const hadFullWeek = Object.values(sessionsByWeek).some(count => count >= 3);

  // ── Evaluate conditions ─────────────────────────────────────────────────────
  const unlocked = [];

  const maybeUnlock = (id, condition, dateStr) => {
    if (!condition) return;
    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === id);
    if (def) {
      unlocked.push({ ...def, unlockedAt: dateStr ?? null });
    }
  };

  maybeUnlock('first_session', totalSessions >= 1, sessions[0]?.completed_at?.split('T')[0] ?? sessions[0]?.scheduled_date);
  maybeUnlock('first_week', hadFullWeek, null);
  maybeUnlock('streak_7', dailyStreak >= 7, null);
  maybeUnlock('streak_14', dailyStreak >= 14, null);
  maybeUnlock('streak_30', dailyStreak >= 30, null);
  maybeUnlock('sessions_10', totalSessions >= 10, null);
  maybeUnlock('sessions_50', totalSessions >= 50, null);
  maybeUnlock('km_100', totalKm >= 100, null);
  maybeUnlock('km_500', totalKm >= 500, null);
  maybeUnlock('first_ai_plan', plans.length >= 1, plans[0]?.created_at?.split('T')[0]);
  maybeUnlock('first_competition', competitions.length >= 1, competitions[0]?.event_date);
  maybeUnlock('weekly_streak_4', weeklyStreak >= 4, null);
  maybeUnlock('rpe_consistent', rpeSessionsCount >= 10, null);

  return { data: unlocked, error: null };
}
