/**
 * Strava API Integration Service
 * Handles OAuth2 flow and activity synchronization
 */

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = `${window.location.origin}/athlete/devices/strava/callback`;

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Storage keys
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
 * Exchange authorization code for access token
 */
export const exchangeStravaCode = async (code) => {
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
      const error = await response.json();
      throw new Error(error.message || 'Failed to exchange code');
    }

    const data = await response.json();

    // Store token data
    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(STRAVA_ATHLETE_KEY, JSON.stringify(data.athlete));

    return { data, error: null };
  } catch (error) {
    console.error('Strava token exchange error:', error);
    return { data: null, error };
  }
};

/**
 * Refresh the access token using refresh token
 */
export const refreshStravaToken = async () => {
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

    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(newTokenData));

    return { data: newTokenData, error: null };
  } catch (error) {
    console.error('Strava token refresh error:', error);
    // Clear invalid tokens
    disconnectStrava();
    return { data: null, error };
  }
};

/**
 * Get stored token data
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
 * Get stored athlete data
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
 * Get valid access token (refresh if needed)
 */
export const getValidAccessToken = async () => {
  const token = getStoredToken();
  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);

  // If token expires in less than 5 minutes, refresh it
  if (token.expires_at <= now + 300) {
    const { data, error } = await refreshStravaToken();
    if (error) return null;
    return data.access_token;
  }

  return token.access_token;
};

/**
 * Disconnect Strava (clear stored data)
 */
export const disconnectStrava = () => {
  localStorage.removeItem(STRAVA_TOKEN_KEY);
  localStorage.removeItem(STRAVA_ATHLETE_KEY);
};

/**
 * Make authenticated API request to Strava
 */
const stravaApiRequest = async (endpoint, options = {}) => {
  const accessToken = await getValidAccessToken();

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
