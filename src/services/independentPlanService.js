import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-plan`;

const DAY_OF_WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Generate an AI training plan for the currently authenticated independent athlete.
 * Calls the generate-ai-plan Edge Function using the athlete's own JWT.
 *
 * @param {string} userId - UUID of the authenticated independent athlete
 * @returns {Promise<object>} Parsed plan JSON with plan_name, duration_weeks, tier, weeks[]
 * @throws {Error} On auth failure, network error, or AI generation failure
 */
export const generateSelfPlan = async (userId) => {
  if (!userId) {
    throw new Error('No userId provided');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No hay sesión activa');
  }

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ athlete_id: userId }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data?.error ?? 'unknown_error';
    const message = errorCode === 'ai_generation_failed'
      ? 'No se pudo generar el plan. Inténtalo de nuevo.'
      : errorCode === 'rate_limit_exceeded'
        ? 'Has alcanzado el límite de regeneraciones esta semana (máx. 2).'
        : data?.message ?? `Error ${response.status}`;
    throw new Error(message);
  }

  return data;
};

/**
 * Auto-assign a generated plan to the athlete by creating training_sessions
 * directly (coach_id = NULL, created_by = userId).
 *
 * The plan flows through: training_plans -> mesocycles -> microcycles -> training_sessions
 *
 * @param {object} planData - Plan data returned by generate-ai-plan Edge Function
 * @param {string} userId - UUID of the authenticated independent athlete
 * @param {Date} [startDate=today] - Optional start date for the plan
 * @returns {Promise<{ planId: string, sessionCount: number }>}
 */
export const autoAssignPlan = async (planData, userId, startDate = null) => {
  if (!planData || !userId) {
    throw new Error('planData and userId are required');
  }

  const assignDate = startDate ?? new Date();
  // Align to the upcoming Monday
  const dayOfWeek = assignDate.getDay(); // 0=Sunday, 1=Monday
  const daysUntilMonday = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const planStart = new Date(assignDate);
  planStart.setDate(planStart.getDate() + daysUntilMonday);

  // 1. Create the training_plan
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert([{
      coach_id: null,
      created_by: userId,
      name: planData.plan_name ?? 'Plan generado por IA',
      duration_weeks: planData.duration_weeks ?? 4,
      description: `Plan IA — ${planData.tier ?? 'profile_only'}`,
      is_active: true,
    }])
    .select()
    .single();

  if (planError) throw new Error(`Error al crear plan: ${planError.message}`);

  // 2. Create mesocycle for the full 4-week block
  const { data: meso, error: mesoError } = await supabase
    .from('mesocycles')
    .insert([{
      plan_id: plan.id,
      name: 'Bloque 4 semanas',
      phase: 'build',
      order_index: 1,
      duration_weeks: planData.duration_weeks ?? 4,
    }])
    .select()
    .single();

  if (mesoError) throw new Error(`Error al crear mesociclo: ${mesoError.message}`);

  // 3. Create microcycles (one per week) and training_sessions
  const weeks = planData.weeks ?? [];
  let totalSessionCount = 0;

  for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
    const week = weeks[weekIdx];
    const weekStart = new Date(planStart);
    weekStart.setDate(weekStart.getDate() + weekIdx * 7);

    // Build content JSON for microcycle
    const microcycleContent = {
      sessions: (week.sessions ?? []).map(s => ({
        day_of_week: s.day_of_week,
        title: s.title,
        description: s.description,
        training_type: s.training_type,
        estimated_distance_km: s.estimated_distance_km,
        estimated_duration_minutes: s.estimated_duration_minutes,
        intensity: s.intensity,
      })),
    };

    const { data: micro, error: microError } = await supabase
      .from('microcycles')
      .insert([{
        mesocycle_id: meso.id,
        week_number: weekIdx + 1,
        content: microcycleContent,
      }])
      .select()
      .single();

    if (microError) throw new Error(`Error al crear microciclo semana ${weekIdx + 1}: ${microError.message}`);

    // 4. Create training_sessions for each day in the week
    const sessions = (week.sessions ?? []).map(session => {
      const dayIndex = DAY_OF_WEEK_ORDER.indexOf(session.day_of_week);
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + (dayIndex >= 0 ? dayIndex : 0));

      return {
        coach_id: null,
        athlete_id: userId,
        microcycle_id: micro.id,
        scheduled_date: toLocalDateStr(sessionDate),
        training_type: session.training_type ?? 'carrera',
        status: 'planned',
        title: session.title ?? '',
        description: session.description ?? '',
        estimated_duration_minutes: session.estimated_duration_minutes ?? null,
        estimated_distance_km: session.estimated_distance_km > 0
          ? session.estimated_distance_km
          : null,
        intensity: session.intensity ?? null,
      };
    });

    const nonRestSessions = sessions.filter(s => s.training_type !== 'descanso');

    if (nonRestSessions.length > 0) {
      const { error: sessionsError } = await supabase
        .from('training_sessions')
        .insert(nonRestSessions);

      if (sessionsError) throw new Error(`Error al crear sesiones semana ${weekIdx + 1}: ${sessionsError.message}`);

      totalSessionCount += nonRestSessions.length;
    }
  }

  // 5. Create plan_assignment linking the plan to the athlete
  const { error: assignError } = await supabase
    .from('plan_assignments')
    .insert([{
      plan_id: plan.id,
      athlete_id: userId,
      start_date: toLocalDateStr(planStart),
      assigned_by: userId,
    }]);

  if (assignError) {
    // Non-fatal: plan_assignments may not exist; log but don't throw
    // The sessions are already created
  }

  return { planId: plan.id, sessionCount: totalSessionCount };
};

/**
 * Get the current week's active training sessions for an independent athlete.
 *
 * @param {string} userId - UUID of the athlete
 * @returns {Promise<{ data: Array, error: Error|null }>}
 */
export const getMyActivePlan = async (userId) => {
  if (!userId) {
    return { data: [], error: new Error('No userId provided') };
  }

  try {
    // Get current week bounds (Monday to Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', userId)
      .is('coach_id', null)
      .gte('scheduled_date', toLocalDateStr(monday))
      .lte('scheduled_date', toLocalDateStr(sunday))
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    return { data: data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
};

/**
 * Get plan history: past training sessions grouped by week.
 * Returns weeks with at least one completed or planned session.
 *
 * @param {string} userId - UUID of the athlete
 * @param {number} [limit=8] - How many past weeks to return
 * @returns {Promise<{ data: Array<{weekStart: string, sessions: Array}>, error: Error|null }>}
 */
export const getMyPlanHistory = async (userId, limit = 8) => {
  if (!userId) {
    return { data: [], error: new Error('No userId provided') };
  }

  try {
    // Go back limit weeks from start of current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    thisMonday.setHours(0, 0, 0, 0);

    const fromDate = new Date(thisMonday);
    fromDate.setDate(thisMonday.getDate() - limit * 7);

    const toDate = new Date(thisMonday);
    toDate.setDate(thisMonday.getDate() - 1); // Up to yesterday (past weeks only)

    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', userId)
      .is('coach_id', null)
      .gte('scheduled_date', toLocalDateStr(fromDate))
      .lte('scheduled_date', toLocalDateStr(toDate))
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    // Group sessions by week start (Monday)
    const weeksMap = new Map();
    for (const session of data ?? []) {
      const sessionDate = new Date(session.scheduled_date + 'T00:00:00');
      const sessionDow = sessionDate.getDay();
      const weekMonday = new Date(sessionDate);
      weekMonday.setDate(sessionDate.getDate() - (sessionDow === 0 ? 6 : sessionDow - 1));
      const weekKey = toLocalDateStr(weekMonday);

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, { weekStart: weekKey, sessions: [] });
      }
      weeksMap.get(weekKey).sessions.push(session);
    }

    const weeks = Array.from(weeksMap.values()).sort((a, b) =>
      b.weekStart.localeCompare(a.weekStart)
    );

    return { data: weeks, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
};

/**
 * Check how many AI plan generations the athlete has used this week (last 7 days).
 * Returns { used, remaining, canGenerate }.
 *
 * Rate limit: max 2 regenerations per 7-day window.
 *
 * @param {string} userId - UUID of the athlete
 * @returns {Promise<{ used: number, remaining: number, canGenerate: boolean }>}
 */
export const checkGenerationRateLimit = async (userId) => {
  if (!userId) {
    return { used: 0, remaining: 2, canGenerate: true };
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Count training_plans created by this user (self-generated) in the last 7 days
    const { count, error } = await supabase
      .from('training_plans')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .is('coach_id', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (error) throw error;

    const used = count ?? 0;
    const remaining = Math.max(0, 2 - used);

    return { used, remaining, canGenerate: remaining > 0 };
  } catch {
    // Fail open — allow generation if we can't check
    return { used: 0, remaining: 2, canGenerate: true };
  }
};
