import { supabase } from '../lib/supabase';

/**
 * Service for managing athletes
 * Optimized queries without complex joins
 */

// Get all athletes for the current coach
export const getAthletes = async (coachId) => {
  if (!coachId) {
    console.warn('getAthletes: No coachId provided');
    return { data: [], error: null };
  }

  try {
    // Step 1: Get relationships
    const { data: relationships, error: relError } = await supabase
      .from('coach_athlete_relationship')
      .select('id, athlete_id, status, start_date')
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (relError) {
      console.error('Error fetching relationships:', relError);
      return { data: [], error: relError };
    }

    if (!relationships || relationships.length === 0) {
      return { data: [], error: null };
    }

    const athleteIds = relationships.map(r => r.athlete_id);

    // Step 2: Fetch athletes and users in parallel
    const [athletesRes, usersRes] = await Promise.all([
      supabase.from('athletes').select('*').in('id', athleteIds),
      supabase.from('users').select('*').in('id', athleteIds),
    ]);

    if (athletesRes.error) {
      console.error('Error fetching athletes:', athletesRes.error);
    }
    if (usersRes.error) {
      console.error('Error fetching users:', usersRes.error);
    }

    // Step 3: Combine data
    const combined = relationships.map(rel => {
      const athlete = athletesRes.data?.find(a => a.id === rel.athlete_id) || {};
      const user = usersRes.data?.find(u => u.id === rel.athlete_id) || {};

      return {
        relationshipId: rel.id,
        status: rel.status,
        startDate: rel.start_date,
        id: rel.athlete_id,
        dateOfBirth: athlete.date_of_birth,
        gender: athlete.gender,
        specialties: athlete.specialties || [],
        vo2Max: athlete.vo2_max,
        restingHeartRate: athlete.resting_heart_rate,
        maxHeartRate: athlete.max_heart_rate,
        firstName: user.first_name || 'Sin nombre',
        lastName: user.last_name || '',
        email: user.email || '',
        profileImage: user.profile_image,
        phone: user.phone,
      };
    });

    return { data: combined, error: null };
  } catch (error) {
    console.error('Error in getAthletes:', error);
    return { data: [], error };
  }
};

// Get athlete details
export const getAthleteDetails = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    // Fetch athlete data
    const { data: athlete, error: athleteError } = await supabase
      .from('athletes')
      .select('*')
      .eq('id', athleteId)
      .single();

    if (athleteError) {
      console.error('Error fetching athlete:', athleteError);
      return { data: null, error: athleteError };
    }

    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', athleteId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
    }

    // Fetch personal bests and paces in parallel
    const [pbRes, pacesRes] = await Promise.all([
      supabase.from('personal_bests').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
      supabase.from('athlete_paces').select('*').eq('athlete_id', athleteId).is('valid_until', null),
    ]);

    const combined = {
      ...athlete,
      user: user || {},
      personal_bests: pbRes.data || [],
      athlete_paces: pacesRes.data || [],
    };

    return { data: combined, error: null };
  } catch (error) {
    console.error('Error fetching athlete details:', error);
    return { data: null, error };
  }
};

// Update athlete data
export const updateAthlete = async (athleteId, updates) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athletes')
      .update(updates)
      .eq('id', athleteId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating athlete:', error);
    return { data: null, error };
  }
};

// Delete athlete relationship
export const removeAthlete = async (relationshipId) => {
  if (!relationshipId) {
    return { error: new Error('No relationshipId provided') };
  }

  try {
    const { error } = await supabase
      .from('coach_athlete_relationship')
      .delete()
      .eq('id', relationshipId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error removing athlete:', error);
    return { error };
  }
};

// Get athlete metrics
export const getAthleteMetrics = async (athleteId, startDate, endDate) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    let query = supabase
      .from('training_metrics')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: true });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching athlete metrics:', error);
    return { data: [], error };
  }
};

// Get athlete training sessions
export const getAthleteSessions = async (athleteId, options = {}) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  const { startDate, endDate, status, limit = 50 } = options;

  try {
    let query = supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('scheduled_date', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('scheduled_date', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching athlete sessions:', error);
    return { data: [], error };
  }
};

// Get athlete paces (R1-R10)
export const getAthletePaces = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athlete_paces')
      .select('*')
      .eq('athlete_id', athleteId)
      .is('valid_until', null)
      .order('pace_code', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching athlete paces:', error);
    return { data: [], error };
  }
};
