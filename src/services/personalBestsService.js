import { supabase } from '../lib/supabase';

/**
 * Fetch personal bests for a given athlete, ordered by fastest time first.
 */
export const getPersonalBestsByAthlete = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('personal_bests')
      .select('distance, time_seconds, date')
      .eq('athlete_id', athleteId)
      .order('time_seconds', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};
