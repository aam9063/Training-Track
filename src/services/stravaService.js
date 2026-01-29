/**
 * Strava API Integration Service
 * Handles OAuth2 flow and activity synchronization
 * Tokens are stored in Supabase (devices table) for persistence across sessions
 */

import { supabase } from '../lib/supabase';

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = `${window.location.origin}/athlete/devices`;

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Local cache keys (for quick access, synced with DB)
const STRAVA_TOKEN_KEY = 'strava_token';
const STRAVA_ATHLETE_KEY = 'strava_athlete';

/**
 * Generate the OAuth2 authorization URL for Strava
 */
export const getStravaAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    scope: 'read,activity:read_all,profile:read_all',
    approval_prompt: 'auto',
  });

  return `${STRAVA_AUTH_URL}?${params.toString()}`;
};

/**
 * Save Strava tokens to Supabase devices table
 */
const saveTokensToDatabase = async (athleteId, tokenData, stravaAthlete) => {
  try {
    const { error } = await supabase
      .from('devices')
      .upsert({
        athlete_id: athleteId,
        device_type: 'strava',
        device_name: stravaAthlete ? `${stravaAthlete.firstname} ${stravaAthlete.lastname}` : 'Strava',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        last_sync: new Date().toISOString(),
        sync_enabled: true,
      }, {
        onConflict: 'athlete_id,device_type',
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error saving tokens to database:', error);
    return { success: false, error };
  }
};

/**
 * Get Strava tokens from Supabase devices table
 */
const getTokensFromDatabase = async (athleteId) => {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return { data, error: null };
  } catch (error) {
    console.error('Error getting tokens from database:', error);
    return { data: null, error };
  }
};

/**
 * Delete Strava connection from database
 */
const deleteTokensFromDatabase = async (athleteId) => {
  try {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('device_type', 'strava');

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting tokens from database:', error);
    return { success: false, error };
  }
};

/**
 * Exchange authorization code for access token
 * @param {string} code - OAuth authorization code
 * @param {string} athleteId - TrackPro athlete ID to associate tokens with
 */
export const exchangeStravaCode = async (code, athleteId = null) => {
  try {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Handle athlete limit exceeded error
      if (response.status === 403) {
        const limitError = new Error('ATHLETE_LIMIT_EXCEEDED');
        limitError.userMessage = 'La aplicación ha alcanzado el límite de usuarios de Strava. Por favor, contacta al administrador para solicitar un aumento del límite.';
        limitError.isLimitError = true;
        throw limitError;
      }

      throw new Error(errorData.message || 'Failed to exchange code');
    }

    const data = await response.json();

    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    // Save to localStorage for quick access
    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(STRAVA_ATHLETE_KEY, JSON.stringify(data.athlete));

    // Save to database if athleteId provided
    if (athleteId) {
      await saveTokensToDatabase(athleteId, tokenData, data.athlete);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Strava token exchange error:', error);
    return { data: null, error };
  }
};

/**
 * Refresh the access token using refresh token
 * @param {string} athleteId - TrackPro athlete ID (optional, for DB update)
 */
export const refreshStravaToken = async (athleteId = null) => {
  const tokenData = getStoredToken();
  if (!tokenData?.refresh_token) {
    return { data: null, error: new Error('No refresh token available') };
  }

  try {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    const newTokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    // Update localStorage
    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(newTokenData));

    // Update database if athleteId provided
    if (athleteId) {
      await saveTokensToDatabase(athleteId, newTokenData, null);
    }

    return { data: newTokenData, error: null };
  } catch (error) {
    console.error('Strava token refresh error:', error);
    // Clear invalid tokens
    disconnectStrava(athleteId);
    return { data: null, error };
  }
};

/**
 * Get stored token data from localStorage
 */
export const getStoredToken = () => {
  try {
    const data = localStorage.getItem(STRAVA_TOKEN_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Get stored athlete data from localStorage
 */
export const getStoredAthlete = () => {
  try {
    const data = localStorage.getItem(STRAVA_ATHLETE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Load tokens from database and cache in localStorage
 * Call this on app init or when user logs in
 */
export const loadStravaTokens = async (athleteId) => {
  const { data } = await getTokensFromDatabase(athleteId);

  if (data) {
    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(new Date(data.token_expires_at).getTime() / 1000),
    };

    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(tokenData));

    // Also fetch and cache athlete data if connected
    if (tokenData.access_token) {
      const { data: athleteData } = await getStravaAthlete();
      if (athleteData) {
        localStorage.setItem(STRAVA_ATHLETE_KEY, JSON.stringify(athleteData));
      }
    }

    return { connected: true, tokenData };
  }

  return { connected: false, tokenData: null };
};

/**
 * Check if Strava is connected and token is valid
 */
export const isStravaConnected = () => {
  const token = getStoredToken();
  if (!token) return false;

  // Check if token is expired (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  return token.expires_at > now + 300;
};

/**
 * Check connection status from database
 */
export const checkStravaConnectionFromDB = async (athleteId) => {
  const { data } = await getTokensFromDatabase(athleteId);
  if (!data) return false;

  // Token exists and can be refreshed
  return !!data.refresh_token;
};

/**
 * Get valid access token (refresh if needed)
 * @param {string} athleteId - TrackPro athlete ID (optional, for DB update)
 */
export const getValidAccessToken = async (athleteId = null) => {
  const token = getStoredToken();
  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);

  // If token expires in less than 5 minutes, refresh it
  if (token.expires_at <= now + 300) {
    const { data, error } = await refreshStravaToken(athleteId);
    if (error) return null;
    return data.access_token;
  }

  return token.access_token;
};

/**
 * Disconnect Strava (clear stored data)
 * @param {string} athleteId - TrackPro athlete ID (optional, for DB deletion)
 */
export const disconnectStrava = async (athleteId = null) => {
  localStorage.removeItem(STRAVA_TOKEN_KEY);
  localStorage.removeItem(STRAVA_ATHLETE_KEY);

  if (athleteId) {
    await deleteTokensFromDatabase(athleteId);
  }
};

/**
 * Make authenticated API request to Strava
 */
const stravaApiRequest = async (endpoint, options = {}, athleteId = null) => {
  const accessToken = await getValidAccessToken(athleteId);

  if (!accessToken) {
    return { data: null, error: new Error('Not authenticated with Strava') };
  }

  try {
    const response = await fetch(`${STRAVA_API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('Strava API error:', error);
    return { data: null, error };
  }
};

/**
 * Get authenticated athlete profile
 */
export const getStravaAthlete = async () => {
  return stravaApiRequest('/athlete');
};

/**
 * Get athlete activities
 * @param {Object} params - Query parameters
 * @param {number} params.before - Epoch timestamp, filter activities before this time
 * @param {number} params.after - Epoch timestamp, filter activities after this time
 * @param {number} params.page - Page number (default 1)
 * @param {number} params.per_page - Items per page (default 30, max 200)
 */
export const getStravaActivities = async (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.before) queryParams.append('before', params.before);
  if (params.after) queryParams.append('after', params.after);
  if (params.page) queryParams.append('page', params.page);
  if (params.per_page) queryParams.append('per_page', params.per_page);

  const queryString = queryParams.toString();
  const endpoint = `/athlete/activities${queryString ? `?${queryString}` : ''}`;

  return stravaApiRequest(endpoint);
};

/**
 * Get detailed activity by ID
 */
export const getStravaActivityDetail = async (activityId) => {
  return stravaApiRequest(`/activities/${activityId}?include_all_efforts=true`);
};

/**
 * Get athlete stats
 */
export const getStravaAthleteStats = async (athleteId) => {
  return stravaApiRequest(`/athletes/${athleteId}/stats`);
};

/**
 * Format Strava activity for display
 */
export const formatStravaActivity = (activity) => {
  return {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type,
    date: activity.start_date_local,
    distance: activity.distance, // meters
    distanceKm: (activity.distance / 1000).toFixed(2),
    moving_time: activity.moving_time, // seconds
    elapsed_time: activity.elapsed_time, // seconds
    formattedTime: formatDuration(activity.moving_time),
    total_elevation_gain: activity.total_elevation_gain,
    average_speed: activity.average_speed, // m/s
    max_speed: activity.max_speed,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    pace: calculatePace(activity.moving_time, activity.distance),
    calories: activity.calories,
    suffer_score: activity.suffer_score,
    has_heartrate: activity.has_heartrate,
    map: activity.map,
    kudos_count: activity.kudos_count,
    achievement_count: activity.achievement_count,
    athlete_count: activity.athlete_count,
  };
};

/**
 * Format duration in seconds to HH:MM:SS
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
};

/**
 * Calculate pace (min/km) from time and distance
 */
export const calculatePace = (seconds, meters) => {
  if (!meters || meters === 0) return '-';

  const paceSecsPerKm = seconds / (meters / 1000);
  const paceMin = Math.floor(paceSecsPerKm / 60);
  const paceSec = Math.round(paceSecsPerKm % 60);

  return `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
};

/**
 * Get activity type label in Spanish
 */
export const getActivityTypeLabel = (type) => {
  const types = {
    Run: 'Carrera',
    TrailRun: 'Trail',
    VirtualRun: 'Carrera Virtual',
    Walk: 'Caminata',
    Hike: 'Senderismo',
    Ride: 'Ciclismo',
    VirtualRide: 'Ciclismo Virtual',
    Swim: 'Natación',
    WeightTraining: 'Gimnasio',
    Workout: 'Entrenamiento',
    Yoga: 'Yoga',
    CrossFit: 'CrossFit',
    Elliptical: 'Elíptica',
    StairStepper: 'Escaladora',
    Rowing: 'Remo',
    AlpineSki: 'Esquí Alpino',
    BackcountrySki: 'Esquí de Fondo',
    Snowboard: 'Snowboard',
    Soccer: 'Fútbol',
    Tennis: 'Tenis',
  };

  return types[type] || type;
};
