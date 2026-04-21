import { supabase } from '../lib/supabase';
import { toLocalDateStr } from '../lib/dateUtils';

/**
 * Fetch public coach info for invite link registration.
 */
export const getCoachPublicInfo = async (coachUuid) => {
  return supabase.rpc('get_coach_public_info', { coach_uuid: coachUuid });
};

/**
 * Service for managing athletes
 * Optimized queries without complex joins
 */

/**
 * Refresh Strava token via Edge Function (keeps client_secret server-side)
 */
const refreshStravaTokenViaEdge = async (refreshToken, athleteId) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/strava-token-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        athlete_id: athleteId,
      }),
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

// Get all athletes for the current coach (active relationships)
export const getAthletes = async (coachId) => {
  if (!coachId) {
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

    if (athletesRes.error) return { data: [], error: athletesRes.error };
    if (usersRes.error) return { data: [], error: usersRes.error };

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
        raceDistances: athlete.race_distances || [],
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
      return { data: null, error: athleteError };
    }

    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', athleteId)
      .single();

    if (userError) return { data: null, error: userError };

    // Fetch personal bests, paces, latest VAM test, and latest Conconi test in parallel
    const [pbRes, pacesRes, vamRes, conconiRes] = await Promise.all([
      supabase.from('personal_bests').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
      supabase.from('athlete_paces').select('*').eq('athlete_id', athleteId).is('valid_until', null).order('pace_code', { ascending: true }),
      supabase.from('vam_tests').select('*').eq('athlete_id', athleteId).order('test_date', { ascending: false }).limit(1),
      supabase.from('conconi_tests').select('*, conconi_test_series(*)').eq('athlete_id', athleteId).order('test_date', { ascending: false }).limit(1),
    ]);

    const combined = {
      ...athlete,
      user: user || {},
      personal_bests: pbRes.data || [],
      athlete_paces: pacesRes.data || [],
      latest_vam: vamRes.data?.[0] || null,
      latest_conconi: conconiRes.data?.[0] || null,
    };

    return { data: combined, error: null };
  } catch (error) {
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
    return { data: [], error };
  }
};

// Get pending athlete requests for the coach
export const getPendingAthleteRequests = async (coachId) => {
  if (!coachId) {
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
        start_date: toLocalDateStr(new Date()),
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
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
    return { error };
  }
};

// Helper: call strava-proxy Edge Function (tokens stay server-side)
const callStravaProxy = async (athleteId, endpoint, params = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No session');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/strava-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ athlete_id: athleteId, endpoint, params }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Strava proxy error: ${response.status}`);
  }

  return response.json();
};

// Get athlete's Strava connection info (for coach to view activities)
// Uses safe view that excludes access_token/refresh_token
export const getAthleteStravaConnection = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('devices_safe_view')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Get athlete's Strava activities via server-side proxy (tokens never reach coach's browser)
export const getAthleteStravaActivities = async (athleteId, params = {}) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const activities = await callStravaProxy(athleteId, 'activities', {
      before: params.before,
      after: params.after,
      page: params.page || 1,
      per_page: params.per_page || 10,
    });

    return { data: activities, error: null };
  } catch (error) {
    if (error.message?.includes('not connected') || error.message?.includes('Not authorized')) {
      return { data: [], error: null, notConnected: true };
    }
    return { data: [], error };
  }
};

// Get detailed Strava activity via server-side proxy
export const getAthleteStravaActivityDetail = async (athleteId, activityId) => {
  if (!athleteId || !activityId) {
    return { data: null, error: new Error('Missing athleteId or activityId') };
  }

  try {
    const activity = await callStravaProxy(athleteId, 'activity_detail', {
      activity_id: activityId,
    });

    return { data: activity, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// =============================================
// COMPETITIONS (Competiciones del atleta)
// =============================================

// Get upcoming competitions for athlete
export const getAthleteCompetitions = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const today = toLocalDateStr(new Date());

    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(10);

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// Get all competitions for athlete (including past)
export const getAthleteAllCompetitions = async (athleteId) => {
  if (!athleteId) {
    return { data: [], error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// Create a new competition for athlete
export const createAthleteCompetition = async (coachId, athleteId, competitionData) => {
  if (!coachId || !athleteId) {
    return { data: null, error: new Error('Missing coachId or athleteId') };
  }

  try {
    const { data, error } = await supabase
      .from('competitions')
      .insert({
        coach_id: coachId,
        athlete_id: athleteId,
        name: competitionData.name,
        event_date: competitionData.event_date,
        location: competitionData.location || null,
        distance_km: competitionData.distance_km || null,
        distance_name: competitionData.distance_name || null,
        event_type: competitionData.event_type || 'race',
        surface: competitionData.surface || null,
        target_time_seconds: competitionData.target_time_seconds || null,
        target_pace_seconds: competitionData.target_pace_seconds || null,
        priority: competitionData.priority || 'A',
        notes: competitionData.notes || null,
        status: 'upcoming',
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Create a competition for multiple athletes at once
export const createCompetitionForAthletes = async (coachId, athleteIds, competitionData) => {
  if (!coachId || !athleteIds?.length) {
    return { data: null, error: new Error('Missing coachId or athleteIds') };
  }

  try {
    const rows = athleteIds.map(athleteId => ({
      coach_id: coachId,
      athlete_id: athleteId,
      name: competitionData.name,
      event_date: competitionData.event_date,
      location: competitionData.location || null,
      distance_km: competitionData.distance_km || null,
      distance_name: competitionData.distance_name || null,
      event_type: competitionData.event_type || 'race',
      surface: competitionData.surface || null,
      target_time_seconds: competitionData.target_time_seconds || null,
      target_pace_seconds: competitionData.target_pace_seconds || null,
      priority: competitionData.priority || 'A',
      notes: competitionData.notes || null,
      status: 'upcoming',
    }));

    const { data, error } = await supabase
      .from('competitions')
      .insert(rows)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Add more athletes to an existing competition (uses same data as original rows)
export const addAthletesToCompetition = async (coachId, athleteIds, competitionData) => {
  if (!coachId || !athleteIds?.length) {
    return { data: null, error: new Error('Missing coachId or athleteIds') };
  }

  try {
    const rows = athleteIds.map(athleteId => ({
      coach_id: coachId,
      athlete_id: athleteId,
      name: competitionData.name,
      event_date: competitionData.event_date,
      location: competitionData.location || null,
      distance_km: competitionData.distance_km || null,
      distance_name: competitionData.distance_name || null,
      event_type: competitionData.event_type || 'race',
      surface: competitionData.surface || null,
      target_time_seconds: competitionData.target_time_seconds || null,
      target_pace_seconds: competitionData.target_pace_seconds || null,
      priority: competitionData.priority || 'A',
      notes: competitionData.notes || null,
      status: 'upcoming',
    }));

    const { data, error } = await supabase
      .from('competitions')
      .insert(rows)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Update a competition
export const updateAthleteCompetition = async (competitionId, updates) => {
  if (!competitionId) {
    return { data: null, error: new Error('No competitionId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('competitions')
      .update(updates)
      .eq('id', competitionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Delete a competition
export const deleteAthleteCompetition = async (competitionId) => {
  if (!competitionId) {
    return { error: new Error('No competitionId provided') };
  }

  try {
    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competitionId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
};

// =============================================
// VDOT / HR PROFILE
// =============================================

// Fetch the athlete's VDOT index.
export const getAthleteVdot = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('vdot, max_heart_rate, resting_heart_rate')
      .eq('id', athleteId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Persist a new VDOT value for the athlete.
export const setAthleteVdot = async (athleteId, vdot) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athletes')
      .update({ vdot })
      .eq('id', athleteId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Fetch the athlete's heart-rate profile (max / resting).
export const getAthleteHrProfile = async (athleteId) => {
  if (!athleteId) {
    return { data: null, error: new Error('No athleteId provided') };
  }

  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('max_heart_rate, resting_heart_rate')
      .eq('id', athleteId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Fetch Strava-synced HR zones for the athlete from `athlete_hr_zones`.
 * Returns a normalised array `[{zone, min, max, color}]` sorted by zone,
 * or `null` when no zones are configured.
 * Colors come from TRAINING_ZONE_COLORS to stay in sync with the design
 * system.
 */
export const getAthleteHrZones = async (athleteId) => {
  if (!athleteId) return { data: null, error: new Error('No athleteId provided') };

  try {
    const { data, error } = await supabase
      .from('athlete_hr_zones')
      .select('zones')
      .eq('athlete_id', athleteId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.zones || !Array.isArray(data.zones) || data.zones.length < 1) {
      return { data: null, error: null };
    }

    // Lazy import to avoid a circular dep on chartColors if athleteService is
    // consumed outside the app bundle (SSR/testing).
    const { TRAINING_ZONE_COLORS } = await import('../lib/chartColors');

    const normalised = data.zones
      .map((z) => {
        const zoneNum = Number(z.zone) || 0;
        return {
          zone: zoneNum,
          min: Number(z.min) || 0,
          max: Number(z.max) || 9999,
          color: TRAINING_ZONE_COLORS[zoneNum - 1] || TRAINING_ZONE_COLORS[0],
        };
      })
      .sort((a, b) => a.zone - b.zone);

    return { data: normalised, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// =============================================
// LEGACY ALIASES (para compatibilidad)
// =============================================
export const getAthleteEvents = getAthleteCompetitions;
export const createAthleteEvent = createAthleteCompetition;
export const deleteAthleteEvent = deleteAthleteCompetition;
