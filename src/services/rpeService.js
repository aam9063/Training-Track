import { supabase } from '../lib/supabase';

export const RPE_OPTIONS = [
  { score: 1, emoji: '\u{1F62B}', label: 'Muy duro' },
  { score: 2, emoji: '\u{1F613}', label: 'Duro' },
  { score: 3, emoji: '\u{1F60A}', label: 'Normal' },
  { score: 4, emoji: '\u{1F604}', label: 'Bien' },
  { score: 5, emoji: '\u{1F929}', label: 'Genial' },
];

export const getRPEEmoji = (score) => {
  const option = RPE_OPTIONS.find((o) => o.score === score);
  return option ? option.emoji : '';
};

export const getRPELabel = (score) => {
  const option = RPE_OPTIONS.find((o) => o.score === score);
  return option ? option.label : '';
};

export const saveActivityRPE = async (athleteId, stravaActivityId, rpeScore, notes = '') => {
  try {
    const { data, error } = await supabase
      .from('activity_rpe')
      .upsert(
        {
          athlete_id: athleteId,
          strava_activity_id: String(stravaActivityId),
          rpe_score: rpeScore,
          notes,
        },
        { onConflict: 'athlete_id,strava_activity_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving activity RPE:', error);
    return { data: null, error };
  }
};

export const getActivitiesRPE = async (athleteId, stravaActivityIds) => {
  if (!stravaActivityIds || stravaActivityIds.length === 0) {
    return { data: {}, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('activity_rpe')
      .select('strava_activity_id, rpe_score, notes')
      .eq('athlete_id', athleteId)
      .in('strava_activity_id', stravaActivityIds.map(String));

    if (error) throw error;

    const rpeMap = {};
    (data || []).forEach((row) => {
      rpeMap[row.strava_activity_id] = { score: row.rpe_score, notes: row.notes || '' };
    });

    return { data: rpeMap, error: null };
  } catch (error) {
    console.error('Error fetching activities RPE:', error);
    return { data: {}, error };
  }
};
