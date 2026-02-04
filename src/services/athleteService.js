import { supabase } from '../lib/supabase';

/**
 * Service for managing athletes
 * Optimized queries without complex joins
 */

// Get all athletes for the current coach (active relationships)
export const getAthletes = async (coachId) => {
  if (!coachId) {
    console.warn('getAthletes: No coachId provided');
    return { data: [], error: null };
  }

  try {
    // Step 1: Get active relationships
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

// Get pending athlete requests for the coach
export const getPendingAthleteRequests = async (coachId) => {
  if (!coachId) {
    console.warn('getPendingAthleteRequests: No coachId provided');
    return { data: [], error: null };
  }

  try {
    // Get pending relationships
    const { data: relationships, error: relError } = await supabase
      .from('coach_athlete_relationship')
      .select('id, athlete_id, status, created_at')
      .eq('coach_id', coachId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (relError) {
      console.error('Error fetching pending relationships:', relError);
      return { data: [], error: relError };
    }

    if (!relationships || relationships.length === 0) {
      return { data: [], error: null };
    }

    const athleteIds = relationships.map(r => r.athlete_id);

    // Fetch athletes and users in parallel
    const [athletesRes, usersRes] = await Promise.all([
      supabase.from('athletes').select('*').in('id', athleteIds),
      supabase.from('users').select('*').in('id', athleteIds),
    ]);

    // Combine data
    const combined = relationships.map(rel => {
      const athlete = athletesRes.data?.find(a => a.id === rel.athlete_id) || {};
      const user = usersRes.data?.find(u => u.id === rel.athlete_id) || {};

      return {
        relationshipId: rel.id,
        status: rel.status,
        requestDate: rel.created_at,
        id: rel.athlete_id,
        specialties: athlete.specialties || [],
        firstName: user.first_name || 'Sin nombre',
        lastName: user.last_name || '',
        email: user.email || '',
        profileImage: user.profile_image,
      };
    });

    return { data: combined, error: null };
  } catch (error) {
    console.error('Error in getPendingAthleteRequests:', error);
    return { data: [], error };
  }
};

// Accept athlete request
export const acceptAthleteRequest = async (relationshipId) => {
  if (!relationshipId) {
    return { error: new Error('No relationshipId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('coach_athlete_relationship')
      .update({
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error accepting athlete request:', error);
    return { data: null, error };
  }
};

// Reject athlete request
export const rejectAthleteRequest = async (relationshipId) => {
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
    console.error('Error rejecting athlete request:', error);
    return { error };
  }
};

// Get athlete's Strava connection info (for coach to view activities)
export const getAthleteStravaConnection = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching athlete Strava connection:', error);
    return { data: null, error };
  }
};

// Get athlete's Strava activities (using their stored tokens)
export const getAthleteStravaActivities = async (athleteId, params = {}) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    // Get athlete's Strava tokens from database
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava')
      .single();

    if (deviceError || !device) {
      return { data: [], error: null, notConnected: true };
    }

    // Check if token is expired and needs refresh
    const tokenExpiresAt = new Date(device.token_expires_at).getTime();
    const now = Date.now();
    let accessToken = device.access_token;

    if (tokenExpiresAt <= now + 300000) { // 5 min buffer
      // Refresh the token
      const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
      const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;

      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: device.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return { data: [], error: new Error('Failed to refresh token'), notConnected: true };
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update tokens in database
      await supabase
        .from('devices')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
        })
        .eq('id', device.id);
    }

    // Fetch activities from Strava
    const queryParams = new URLSearchParams();
    if (params.before) queryParams.append('before', params.before);
    if (params.after) queryParams.append('after', params.after);
    queryParams.append('page', params.page || 1);
    queryParams.append('per_page', params.per_page || 10);

    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${queryParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      throw new Error('Failed to fetch activities');
    }

    const activities = await activitiesResponse.json();
    return { data: activities, error: null };
  } catch (error) {
    console.error('Error fetching athlete Strava activities:', error);
    return { data: [], error };
  }
};

// Get detailed Strava activity (with laps, splits, segments)
export const getAthleteStravaActivityDetail = async (athleteId, activityId) => {
  if (!athleteId || !activityId) {
    return { data: null, error: new Error('Missing athleteId or activityId') };
  }

  try {
    // Get athlete's Strava tokens from database
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava')
      .single();

    if (deviceError || !device) {
      return { data: null, error: new Error('Athlete not connected to Strava') };
    }

    // Check if token is expired and needs refresh
    const tokenExpiresAt = new Date(device.token_expires_at).getTime();
    const now = Date.now();
    let accessToken = device.access_token;

    if (tokenExpiresAt <= now + 300000) {
      const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
      const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;

      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: device.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return { data: null, error: new Error('Failed to refresh token') };
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await supabase
        .from('devices')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
        })
        .eq('id', device.id);
    }

    // Fetch detailed activity from Strava
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch activity details');
    }

    const activity = await response.json();
    return { data: activity, error: null };
  } catch (error) {
    console.error('Error fetching activity details:', error);
    return { data: null, error };
  }
};

// Get upcoming events/competitions for athlete
export const getAthleteEvents = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('training_type', 'race')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(5);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching athlete events:', error);
    return { data: [], error };
  }
};
