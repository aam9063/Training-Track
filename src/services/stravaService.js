/**
 * Strava API Integration Service
 * Handles OAuth2 flow and activity synchronization
 * Tokens are stored in Supabase (devices table) for persistence across sessions
 */

import { supabase } from '../lib/supabase';

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_REDIRECT_URI = `${window.location.origin}/athlete/devices`;

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
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
 * Call the strava-token-exchange Edge Function (server-side secret)
 */
const callStravaTokenEdgeFunction = async (body) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No hay sesión activa. Inicia sesión de nuevo.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/strava-token-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 403 || errorData.error === 'ATHLETE_LIMIT_EXCEEDED') {
      const limitError = new Error('ATHLETE_LIMIT_EXCEEDED');
      limitError.userMessage = 'La aplicación ha alcanzado el límite de usuarios de Strava. Por favor, contacta al administrador para solicitar un aumento del límite.';
      limitError.isLimitError = true;
      throw limitError;
    }

    throw new Error(errorData.error || `Error del servidor: ${response.status}`);
  }

  return response.json();
};

/**
 * Exchange authorization code for access token
 * @param {string} code - OAuth authorization code
 * @param {string} athleteId - TrackPro athlete ID to associate tokens with
 */
export const exchangeStravaCode = async (code, athleteId = null) => {
  try {
    const data = await callStravaTokenEdgeFunction({
      grant_type: 'authorization_code',
      code,
      athlete_id: athleteId,
    });

    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    // Save to localStorage for quick access
    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(tokenData));
    if (data.athlete) {
      localStorage.setItem(STRAVA_ATHLETE_KEY, JSON.stringify(data.athlete));
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
    const data = await callStravaTokenEdgeFunction({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
      athlete_id: athleteId,
    });

    const newTokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    // Update localStorage
    localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(newTokenData));

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

/**
 * Calculate aggregated metrics from Strava activities
 * @param {Array} activities - Array of raw Strava activities
 * @returns {Object} Aggregated metrics
 */
export const calculateStravaMetrics = (activities) => {
  if (!activities || activities.length === 0) {
    return {
      totalActivities: 0,
      totalDistance: 0,
      totalTime: 0,
      totalElevation: 0,
      avgPace: null,
      avgHeartrate: null,
      avgDistance: 0,
      longestRun: null,
      fastestPace: null,
      weeklyStats: [],
      activityTypes: {},
    };
  }

  // Filter only running activities for pace calculations
  const runningTypes = ['Run', 'TrailRun', 'VirtualRun'];
  const runningActivities = activities.filter(a => runningTypes.includes(a.type));
  const allActivities = activities;

  // Basic totals
  const totalDistance = allActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalTime = allActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const totalElevation = allActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

  // Running-specific metrics
  const runningDistance = runningActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const runningTime = runningActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);

  // Average pace (only for running)
  const avgPace = runningDistance > 0
    ? calculatePace(runningTime, runningDistance)
    : null;

  // Average heartrate (only running activities with HR data)
  const hrActivities = runningActivities.filter(a => a.average_heartrate);
  const avgHeartrate = hrActivities.length > 0
    ? Math.round(hrActivities.reduce((sum, a) => sum + a.average_heartrate, 0) / hrActivities.length)
    : null;

  // Longest run
  const longestRun = runningActivities.length > 0
    ? runningActivities.reduce((max, a) => a.distance > max.distance ? a : max, runningActivities[0])
    : null;

  // Fastest pace (min 1km distance to be meaningful)
  const meaningfulRuns = runningActivities.filter(a => a.distance >= 1000);
  const fastestPace = meaningfulRuns.length > 0
    ? meaningfulRuns.reduce((fastest, a) => {
        const pace = a.moving_time / (a.distance / 1000);
        const fastestPaceVal = fastest.moving_time / (fastest.distance / 1000);
        return pace < fastestPaceVal ? a : fastest;
      }, meaningfulRuns[0])
    : null;

  // Activity types breakdown
  const activityTypes = allActivities.reduce((types, a) => {
    const type = a.type || 'Other';
    if (!types[type]) {
      types[type] = { count: 0, distance: 0, time: 0 };
    }
    types[type].count++;
    types[type].distance += a.distance || 0;
    types[type].time += a.moving_time || 0;
    return types;
  }, {});

  // Weekly breakdown (last 4 weeks) - running only
  const weeklyStats = calculateWeeklyStats(runningActivities);

  // Per-sport distance breakdown
  const sportBreakdown = {};
  const cyclingTypes = ['Ride', 'VirtualRide'];
  const swimTypes = ['Swim'];
  const gymTypes = ['WeightTraining', 'Workout', 'CrossFit', 'Yoga'];

  const cyclingActivities = allActivities.filter(a => cyclingTypes.includes(a.type));
  const swimActivities = allActivities.filter(a => swimTypes.includes(a.type));
  const gymActivitiesArr = allActivities.filter(a => gymTypes.includes(a.type));

  if (runningActivities.length > 0) {
    sportBreakdown.running = {
      count: runningActivities.length,
      distanceKm: (runningDistance / 1000).toFixed(1),
      time: runningTime,
      timeFormatted: formatDuration(runningTime),
      elevation: Math.round(runningActivities.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
    };
  }
  if (cyclingActivities.length > 0) {
    const dist = cyclingActivities.reduce((s, a) => s + (a.distance || 0), 0);
    const time = cyclingActivities.reduce((s, a) => s + (a.moving_time || 0), 0);
    sportBreakdown.cycling = {
      count: cyclingActivities.length,
      distanceKm: (dist / 1000).toFixed(1),
      time,
      timeFormatted: formatDuration(time),
      elevation: Math.round(cyclingActivities.reduce((s, a) => s + (a.total_elevation_gain || 0), 0)),
      avgSpeedKmh: dist > 0 ? ((dist / 1000) / (time / 3600)).toFixed(1) : '0',
    };
  }
  if (swimActivities.length > 0) {
    const dist = swimActivities.reduce((s, a) => s + (a.distance || 0), 0);
    const time = swimActivities.reduce((s, a) => s + (a.moving_time || 0), 0);
    sportBreakdown.swimming = {
      count: swimActivities.length,
      distanceM: Math.round(dist),
      distanceKm: (dist / 1000).toFixed(1),
      time,
      timeFormatted: formatDuration(time),
      pacePer100m: dist > 0 ? formatDuration(Math.round(time / (dist / 100))) : '-',
    };
  }
  if (gymActivitiesArr.length > 0) {
    const time = gymActivitiesArr.reduce((s, a) => s + (a.moving_time || 0), 0);
    sportBreakdown.gym = {
      count: gymActivitiesArr.length,
      time,
      timeFormatted: formatDuration(time),
      avgDuration: formatDuration(Math.round(time / gymActivitiesArr.length)),
    };
  }

  return {
    totalActivities: allActivities.length,
    totalDistance,
    totalDistanceKm: (totalDistance / 1000).toFixed(1),
    runningDistanceKm: (runningDistance / 1000).toFixed(1),
    totalTime,
    totalTimeFormatted: formatDuration(totalTime),
    totalElevation: Math.round(totalElevation),
    avgPace,
    avgHeartrate,
    avgDistance: allActivities.length > 0 ? totalDistance / allActivities.length : 0,
    avgDistanceKm: allActivities.length > 0 ? (totalDistance / allActivities.length / 1000).toFixed(1) : '0',
    sportBreakdown,
    longestRun: longestRun ? {
      name: longestRun.name,
      distance: longestRun.distance,
      distanceKm: (longestRun.distance / 1000).toFixed(2),
      date: longestRun.start_date_local,
    } : null,
    fastestPace: fastestPace ? {
      name: fastestPace.name,
      pace: calculatePace(fastestPace.moving_time, fastestPace.distance),
      distance: fastestPace.distance,
      date: fastestPace.start_date_local,
    } : null,
    weeklyStats,
    activityTypes,
    runningActivities: runningActivities.length,
  };
};

/**
 * Calculate weekly statistics from activities
 * @param {Array} activities - Array of Strava activities
 * @returns {Array} Weekly stats for last 4 weeks
 */
const calculateWeeklyStats = (activities) => {
  const weeks = [];
  const now = new Date();

  for (let i = 0; i < 4; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekActivities = activities.filter(a => {
      const activityDate = new Date(a.start_date_local);
      return activityDate >= weekStart && activityDate <= weekEnd;
    });

    const distance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
    const time = weekActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
    const elevation = weekActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

    weeks.push({
      weekNumber: i === 0 ? 'Esta semana' : i === 1 ? 'Semana pasada' : `Hace ${i} semanas`,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      activities: weekActivities.length,
      distance,
      distanceKm: (distance / 1000).toFixed(1),
      time,
      timeFormatted: formatDuration(time),
      elevation: Math.round(elevation),
    });
  }

  return weeks;
};

/**
 * Calculate period comparison (current vs previous)
 * @param {Array} currentActivities - Activities from current period
 * @param {Array} previousActivities - Activities from previous period
 * @returns {Object} Comparison metrics with percentage changes
 */
export const calculatePeriodComparison = (currentActivities, previousActivities) => {
  const current = {
    distance: currentActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
    time: currentActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
    activities: currentActivities.length,
    elevation: currentActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
  };

  const previous = {
    distance: previousActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
    time: previousActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
    activities: previousActivities.length,
    elevation: previousActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
  };

  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    current,
    previous,
    changes: {
      distance: calcChange(current.distance, previous.distance),
      time: calcChange(current.time, previous.time),
      activities: calcChange(current.activities, previous.activities),
      elevation: calcChange(current.elevation, previous.elevation),
    },
  };
};

/**
 * Extract best efforts/personal bests from Strava activities
 * Looks for standard distances: 1km, 5km, 10km, Half Marathon, Marathon
 * @param {Array} activities - Array of raw Strava activities with best_efforts
 * @returns {Array} Best efforts sorted by distance
 */
export const extractBestEfforts = (activities) => {
  if (!activities || activities.length === 0) return [];

  // Standard distances we want to track (in meters)
  const targetDistances = [
    { name: '1 km', meters: 1000, tolerance: 50 },
    { name: '1 Milla', meters: 1609, tolerance: 50 },
    { name: '5 km', meters: 5000, tolerance: 100 },
    { name: '10 km', meters: 10000, tolerance: 200 },
    { name: 'Media Maratón', meters: 21097, tolerance: 500 },
    { name: 'Maratón', meters: 42195, tolerance: 1000 },
  ];

  const bestEfforts = {};

  // First, check if activities have best_efforts from Strava (detailed activity)
  activities.forEach(activity => {
    if (activity.best_efforts) {
      activity.best_efforts.forEach(effort => {
        const key = effort.name;
        if (!bestEfforts[key] || effort.moving_time < bestEfforts[key].time) {
          bestEfforts[key] = {
            name: effort.name,
            distance: effort.distance,
            time: effort.moving_time,
            timeFormatted: formatDuration(effort.moving_time),
            date: activity.start_date_local,
            activityName: activity.name,
            activityId: activity.id,
          };
        }
      });
    }
  });

  // If no best_efforts, calculate from activity distances
  if (Object.keys(bestEfforts).length === 0) {
    const runningActivities = activities.filter(a =>
      ['Run', 'TrailRun', 'VirtualRun'].includes(a.type)
    );

    targetDistances.forEach(target => {
      // Find activities that match this distance (within tolerance)
      const matchingActivities = runningActivities.filter(a => {
        const diff = Math.abs(a.distance - target.meters);
        return diff <= target.tolerance;
      });

      if (matchingActivities.length > 0) {
        // Get the fastest one
        const fastest = matchingActivities.reduce((best, a) =>
          a.moving_time < best.moving_time ? a : best
        );

        bestEfforts[target.name] = {
          name: target.name,
          distance: fastest.distance,
          time: fastest.moving_time,
          timeFormatted: formatDuration(fastest.moving_time),
          pace: calculatePace(fastest.moving_time, fastest.distance),
          date: fastest.start_date_local,
          activityName: fastest.name,
          activityId: fastest.id,
        };
      }
    });
  }

  // Convert to array and sort by distance
  return Object.values(bestEfforts).sort((a, b) => a.distance - b.distance);
};

/**
 * Get estimated race times based on a reference time
 * Uses Riegel formula: T2 = T1 * (D2/D1)^1.06
 * @param {number} referenceDistance - Distance in meters
 * @param {number} referenceTime - Time in seconds
 * @returns {Object} Estimated times for various distances
 */
export const estimateRaceTimes = (referenceDistance, referenceTime) => {
  const distances = [
    { name: '5 km', meters: 5000 },
    { name: '10 km', meters: 10000 },
    { name: 'Media Maratón', meters: 21097 },
    { name: 'Maratón', meters: 42195 },
  ];

  const estimates = {};

  distances.forEach(d => {
    if (d.meters !== referenceDistance) {
      const estimatedTime = referenceTime * Math.pow(d.meters / referenceDistance, 1.06);
      estimates[d.name] = {
        time: Math.round(estimatedTime),
        timeFormatted: formatDuration(Math.round(estimatedTime)),
        pace: calculatePace(Math.round(estimatedTime), d.meters),
      };
    }
  });

  return estimates;
};
