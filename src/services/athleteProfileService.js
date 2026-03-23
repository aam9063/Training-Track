import { supabase } from '../lib/supabase';

/**
 * Service for CRUD operations on the athlete_profile table.
 * Athletes own their profile; coaches can read via active relationship (RLS enforced).
 */

/**
 * Fetch the athlete profile for a given user.
 * Returns { data, error } — data is null if no profile exists.
 */
export const getAthleteProfile = async (userId) => {
  if (!userId) {
    return { data: null, error: new Error('No userId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athlete_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

/**
 * Create a new athlete profile.
 * profileData should include all required fields (nombre, sexo, fecha_nacimiento, etc.)
 * user_id is set explicitly from the userId parameter.
 */
export const createAthleteProfile = async (userId, profileData) => {
  if (!userId) {
    return { data: null, error: new Error('No userId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athlete_profile')
      .insert([{ ...profileData, user_id: userId }])
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

/**
 * Update an existing athlete profile.
 * Only updates the fields present in profileData.
 */
export const updateAthleteProfile = async (userId, profileData) => {
  if (!userId) {
    return { data: null, error: new Error('No userId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athlete_profile')
      .update(profileData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};
