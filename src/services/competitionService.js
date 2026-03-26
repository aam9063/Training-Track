import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Service for independent-athlete self-managed competitions.
 * All operations use the authenticated user's id as athlete_id with coach_id = NULL.
 */

/** Map DB row (target_time_seconds) to frontend field (goal_time_minutes) */
const mapCompetition = (row) => ({
  ...row,
  goal_time_minutes: row.target_time_seconds ? Math.round(row.target_time_seconds / 60) : null,
});

/**
 * Fetch all competitions for the given athlete (upcoming and past).
 *
 * @param {string} userId - UUID of the authenticated athlete
 * @returns {{ data: Array, error: Error|null }}
 */
export const getIndependentCompetitions = async (userId) => {
  if (!userId) {
    return { data: [], error: new Error('No userId provided') };
  }

  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .eq('athlete_id', userId)
    .is('coach_id', null)
    .order('event_date', { ascending: true });

  if (error) {
    return { data: [], error };
  }
  return { data: (data ?? []).map(mapCompetition), error: null };
};

/**
 * Fetch the next upcoming competition for the given athlete.
 *
 * @param {string} userId - UUID of the authenticated athlete
 * @returns {{ data: Object|null, error: Error|null }}
 */
export const getNextCompetition = async (userId) => {
  if (!userId) {
    return { data: null, error: new Error('No userId provided') };
  }

  const today = toLocalDateStr(new Date());

  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .eq('athlete_id', userId)
    .is('coach_id', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }
  return { data: data ? mapCompetition(data) : null, error: null };
};

/**
 * Create a new competition owned by the independent athlete.
 *
 * @param {string} userId - UUID of the authenticated athlete
 * @param {Object} competitionData
 * @param {string} competitionData.name - Competition name (required)
 * @param {string} competitionData.event_date - ISO date string YYYY-MM-DD (required)
 * @param {number|null} competitionData.distance_km - Distance in km (optional)
 * @param {string|null} competitionData.location - Location string (optional)
 * @param {string|null} competitionData.notes - Notes (optional)
 * @param {number|null} competitionData.goal_time_minutes - Goal time in minutes (optional)
 * @returns {{ data: Object|null, error: Error|null }}
 */
export const createCompetition = async (userId, competitionData) => {
  if (!userId) {
    return { data: null, error: new Error('No userId provided') };
  }

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      coach_id: null,
      athlete_id: userId,
      name: competitionData.name,
      event_date: competitionData.event_date,
      distance_km: competitionData.distance_km ?? null,
      location: competitionData.location?.trim() || null,
      notes: competitionData.notes?.trim() || null,
      target_time_seconds: competitionData.goal_time_minutes ? competitionData.goal_time_minutes * 60 : null,
      status: 'upcoming',
    })
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }
  return { data, error: null };
};

/**
 * Update an existing competition.
 *
 * @param {string} competitionId - UUID of the competition row
 * @param {Object} updates - Fields to update
 * @returns {{ data: Object|null, error: Error|null }}
 */
export const updateCompetition = async (competitionId, updates) => {
  if (!competitionId) {
    return { data: null, error: new Error('No competitionId provided') };
  }

  const { data, error } = await supabase
    .from('competitions')
    .update(updates)
    .eq('id', competitionId)
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }
  return { data, error: null };
};

/**
 * Delete a competition.
 *
 * @param {string} competitionId - UUID of the competition row
 * @returns {{ error: Error|null }}
 */
export const deleteCompetition = async (competitionId) => {
  if (!competitionId) {
    return { error: new Error('No competitionId provided') };
  }

  const { error } = await supabase
    .from('competitions')
    .delete()
    .eq('id', competitionId);

  if (error) {
    return { error };
  }
  return { error: null };
};
