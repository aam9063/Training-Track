import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';
import { getWeekStartDate } from './weeklyTrainingService';

/**
 * Get the diary entry for the current week for an athlete.
 * Returns null if no entry exists yet.
 */
export async function getCurrentWeekDiary(athleteId) {
  const weekStart = toLocalDateStr(getWeekStartDate());
  const { data, error } = await supabase
    .from('weekly_diary')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Upsert (create or update) a weekly diary entry.
 * Safe to call multiple times — last save wins.
 */
export async function upsertWeeklyDiary(athleteId, weekStart, payload) {
  const { data, error } = await supabase
    .from('weekly_diary')
    .upsert(
      { athlete_id: athleteId, week_start: weekStart, ...payload },
      { onConflict: 'athlete_id,week_start' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Get a specific week's diary entry for a coach viewing an athlete's report.
 * Uses the coach's authenticated session — RLS coach_read_athlete_diary policy applies.
 */
export async function getWeeklyDiaryForCoach(athleteId, weekStart) {
  const { data, error } = await supabase
    .from('weekly_diary')
    .select('overall_rating, overall_notes, pain_notes, next_week_rating, next_week_notes, week_start')
    .eq('athlete_id', athleteId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data, error: null };
}
