/**
 * AI Report Service
 * Generates performance analysis reports using DeepSeek API via Edge Function
 * Aggregates athlete data from Strava, physiological tests, and training metrics
 * Reports are saved to Supabase (ai_reports table) by the Edge Function
 */

import {
  calculateStravaMetrics,
  extractBestEfforts,
  calculatePeriodComparison,
  estimateRaceTimes,
  formatDuration,
  calculatePace,
} from './stravaService';
import { supabase } from '../lib/supabase';
import { getTrainingPaces, formatPace, getTsbZone } from '../lib/trainingMetrics';
import { getCurrentPMCStatus, getMesocyclesByAthlete, getDailyTrainingLoad } from './trainingLoadService';
import { toLocalDateStr } from '../lib/dateUtils';

// ─── Load Calculation Helpers ────────────────────────────────────────────────

/**
 * Calculate daily loads from activities (distance in km as load proxy)
 */
export const getDailyLoads = (activities, days) => {
  const now = new Date();
  const dailyLoads = new Array(days).fill(0);

  activities.forEach(a => {
    const actDate = new Date(a.start_date_local);
    const diffDays = Math.floor((now - actDate) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < days) {
      dailyLoads[diffDays] += (a.distance || 0) / 1000; // km
    }
  });

  return dailyLoads;
};

/**
 * Calculate standard deviation
 */
const stdDev = (arr) => {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

/**
 * Calculate training load metrics (ACWR, monotony, strain)
 */
export const calculateLoadMetrics = (activities) => {
  const daily28 = getDailyLoads(activities, 28);
  const daily7 = daily28.slice(0, 7);

  const acuteLoad = daily7.reduce((s, v) => s + v, 0);
  const chronicLoadTotal = daily28.reduce((s, v) => s + v, 0);
  const chronicLoadWeekly = chronicLoadTotal / 4; // 4 weeks average

  const acwr = chronicLoadWeekly > 0 ? +(acuteLoad / chronicLoadWeekly).toFixed(2) : 0;

  const avgDaily = chronicLoadTotal / 28;
  const sd = stdDev(daily28);
  const monotony = sd > 0 ? +(avgDaily / sd).toFixed(2) : 0;
  const strain = +(chronicLoadTotal * monotony).toFixed(0);

  return {
    acuteLoad: +acuteLoad.toFixed(1),
    chronicLoadWeekly: +chronicLoadWeekly.toFixed(1),
    acwr,
    monotony,
    strain,
    acuteLoadKm: +acuteLoad.toFixed(1),
    chronicLoadKm: +chronicLoadWeekly.toFixed(1),
  };
};

// ─── Data Aggregation ────────────────────────────────────────────────────────

/**
 * Aggregate all athlete data into a structured object for the AI prompt
 */
export const aggregateReportData = async (athlete, activities) => {
  // Basic profile
  const age = athlete.date_of_birth
    ? Math.floor((new Date() - new Date(athlete.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const athleteName = athlete.user
    ? `${athlete.user.first_name || ''} ${athlete.user.last_name || ''}`.trim()
    : 'Atleta';

  // Strava metrics
  const stravaMetrics = calculateStravaMetrics(activities);
  const bestEfforts = extractBestEfforts(activities);

  // Period comparison (last 2 weeks vs previous 2 weeks)
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const currentPeriod = activities.filter(a => new Date(a.start_date_local) >= twoWeeksAgo);
  const previousPeriod = activities.filter(a => {
    const d = new Date(a.start_date_local);
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  });
  const periodComparison = calculatePeriodComparison(currentPeriod, previousPeriod);

  // Load metrics
  const loadMetrics = calculateLoadMetrics(activities);

  // Race estimates from best effort
  let raceEstimates = null;
  if (bestEfforts.length > 0) {
    const ref = bestEfforts[0];
    raceEstimates = estimateRaceTimes(ref.distance, ref.time);
  }

  // Physiological data
  const vam = athlete.latest_vam;
  const conconi = athlete.latest_conconi;
  const paces = athlete.athlete_paces || [];
  const personalBests = athlete.personal_bests || [];

  // VAM-derived metrics
  let vamDerived = null;
  if (vam?.vam_kmh) {
    const vamKmh = vam.vam_kmh;
    vamDerived = {
      vam_kmh: +vamKmh.toFixed(2),
      vo2max: +(vamKmh * 3.5).toFixed(1),
      mlss_kmh: +(vamKmh * 0.88).toFixed(2),
      vt2_kmh: +(vamKmh * 0.875).toFixed(2),
      vt1_kmh: +(vamKmh * 0.775).toFixed(2),
    };
  }

  // Weekly pace progression (for running activities)
  const runningTypes = ['Run', 'TrailRun', 'VirtualRun'];
  const weeklyPaces = [];
  for (let i = 0; i < 12; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekRuns = activities.filter(a => {
      if (!runningTypes.includes(a.type)) return false;
      const d = new Date(a.start_date_local);
      return d >= weekStart && d < weekEnd;
    });

    if (weekRuns.length > 0) {
      const totalDist = weekRuns.reduce((s, a) => s + (a.distance || 0), 0);
      const totalTime = weekRuns.reduce((s, a) => s + (a.moving_time || 0), 0);
      const avgPaceSecsPerKm = totalDist > 0 ? totalTime / (totalDist / 1000) : 0;
      weeklyPaces.unshift({
        week: `Sem -${i}`,
        avgPaceSecsPerKm: +avgPaceSecsPerKm.toFixed(0),
        avgPace: avgPaceSecsPerKm > 0 ? calculatePace(totalTime, totalDist) : '-',
        distanceKm: +(totalDist / 1000).toFixed(1),
        activities: weekRuns.length,
      });
    }
  }

  // HR efficiency (average HR over time for similar paces)
  const hrActivities = activities
    .filter(a => runningTypes.includes(a.type) && a.average_heartrate && a.distance >= 3000)
    .map(a => ({
      date: a.start_date_local,
      avgHR: a.average_heartrate,
      maxHR: a.max_heartrate,
      paceSecsPerKm: a.moving_time / (a.distance / 1000),
      distanceKm: +(a.distance / 1000).toFixed(1),
    }));

  // ── NEW METRICS ──────────────────────────────────────────────

  // VDOT & Daniels training zones
  let vdotData = null;
  const athleteVdot = athlete.vdot;
  if (athleteVdot) {
    const paceZones = getTrainingPaces(athleteVdot);
    vdotData = {
      vdot: athleteVdot,
      trainingZones: paceZones ? {
        easy: `${formatPace(paceZones.easy.min)} - ${formatPace(paceZones.easy.max)}`,
        marathon: formatPace(paceZones.marathon),
        threshold: formatPace(paceZones.threshold),
        interval: formatPace(paceZones.interval),
        repetition: formatPace(paceZones.repetition),
      } : null,
    };
  }

  // PMC status (TSS-based CTL/ATL/TSB)
  let pmcData = null;
  try {
    const pmcStatus = await getCurrentPMCStatus(athlete.id);
    if (pmcStatus) {
      const tsbZone = getTsbZone(pmcStatus.tsb);
      pmcData = {
        ctl: pmcStatus.ctl,
        atl: pmcStatus.atl,
        tsb: pmcStatus.tsb,
        tss: pmcStatus.tss,
        rampRate: pmcStatus.ramp_rate,
        tsbZone: tsbZone?.label || null,
        date: pmcStatus.date,
      };
    }
  } catch (err) {
    console.warn('PMC data not available:', err.message);
  }

  // PMC trend (last 28 days)
  let pmcTrend = null;
  try {
    const endDate = toLocalDateStr(new Date());
    const startD = new Date();
    startD.setDate(startD.getDate() - 28);
    const startDate = toLocalDateStr(startD);
    const dailyData = await getDailyTrainingLoad(athlete.id, startDate, endDate);
    if (dailyData.length > 0) {
      pmcTrend = dailyData.map(d => ({
        date: d.date,
        ctl: d.ctl,
        atl: d.atl,
        tsb: d.tsb,
        tss: d.tss,
      }));
    }
  } catch (err) {
    console.warn('PMC trend not available:', err.message);
  }

  // Periodization (active mesocycle)
  let periodizationData = null;
  try {
    const mesocycles = await getMesocyclesByAthlete(athlete.id);
    if (mesocycles.length > 0) {
      const today = toLocalDateStr(new Date());
      const active = mesocycles.find(m => m.start_date <= today && m.end_date >= today) || mesocycles[mesocycles.length - 1];
      const micros = active.microcycles || [];
      periodizationData = {
        mesocycleName: active.name,
        phase: active.phase,
        startDate: active.start_date,
        endDate: active.end_date,
        focus: active.focus,
        targetWeeklyKm: active.target_weekly_km,
        totalWeeks: micros.length,
        currentWeek: micros.find(m => {
          const mStart = m.start_date;
          const mEnd = new Date(m.start_date + 'T12:00:00');
          mEnd.setDate(mEnd.getDate() + 6);
          return mStart <= today && toLocalDateStr(mEnd) >= today;
        })?.week_number || null,
        weeks: micros.map(m => ({
          weekNumber: m.week_number,
          type: m.week_type,
          plannedKm: m.planned_km,
          actualKm: m.actual_km,
          compliance: m.planned_km && m.actual_km ? Math.round((m.actual_km / m.planned_km) * 100) : null,
        })),
      };
    }
  } catch (err) {
    console.warn('Periodization data not available:', err.message);
  }

  return {
    profile: {
      name: athleteName,
      age,
      gender: athlete.gender || 'No especificado',
      specialties: athlete.specialties || [],
      raceDistances: athlete.race_distances || [],
      vo2max: athlete.vo2_max,
      restingHR: athlete.resting_heart_rate,
      maxHR: athlete.max_heart_rate,
    },
    strava: {
      totalActivities: stravaMetrics.totalActivities,
      totalDistanceKm: stravaMetrics.totalDistanceKm,
      totalTime: stravaMetrics.totalTimeFormatted,
      totalElevation: stravaMetrics.totalElevation,
      avgPace: stravaMetrics.avgPace,
      avgHeartrate: stravaMetrics.avgHeartrate,
      longestRun: stravaMetrics.longestRun,
      fastestPace: stravaMetrics.fastestPace,
      activityTypes: stravaMetrics.activityTypes,
      weeklyStats: stravaMetrics.weeklyStats,
    },
    bestEfforts: bestEfforts.map(e => ({
      name: e.name,
      time: e.timeFormatted,
      pace: e.pace || calculatePace(e.time, e.distance),
      date: e.date,
    })),
    periodComparison: {
      distanceChange: periodComparison.changes.distance,
      timeChange: periodComparison.changes.time,
      activitiesChange: periodComparison.changes.activities,
      elevationChange: periodComparison.changes.elevation,
    },
    load: loadMetrics,
    physiological: {
      vam: vamDerived,
      vamTestDate: vam?.test_date,
      conconiMaxHR: conconi?.max_hr_reached,
      conconiDate: conconi?.test_date,
      paces: paces.map(p => ({
        code: p.pace_code,
        secsPerKm: p.pace_seconds_per_km,
        pace: calculatePace(p.pace_seconds_per_km, 1000),
        hr: p.heart_rate_bpm,
      })),
    },
    personalBests: personalBests.map(pb => ({
      distance: pb.distance_name,
      time: pb.time_formatted || formatDuration(pb.time_seconds),
      date: pb.date,
    })),
    raceEstimates,
    weeklyPaces,
    hrTrend: hrActivities.slice(-20), // last 20 running activities with HR
    vdot: vdotData,
    pmc: pmcData,
    pmcTrend,
    periodization: periodizationData,
  };
};

// ─── Edge Function Call ──────────────────────────────────────────────────────

/**
 * Call the generate-ai-report Edge Function
 * The Edge Function handles: DeepSeek API call + saving to ai_reports table
 */
const callEdgeFunction = async (reportData, athleteId, periodWeeks) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No hay sesión activa. Inicia sesión de nuevo.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-ai-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ reportData, athleteId, periodWeeks }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor: ${response.status}`);
  }

  return response.json();
};

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generate a complete performance report using AI via Edge Function
 * @param {Object} athlete - Full athlete object from getAthleteDetails
 * @param {Array} activities - Strava activities array
 * @param {number} periodWeeks - Number of weeks for the report period
 * @returns {Object} { reportData, aiAnalysis, reportId }
 */
export const generatePerformanceReport = async (athlete, activities, periodWeeks = 4) => {
  // 1. Aggregate all data locally (async - fetches PMC, periodization, etc.)
  const reportData = await aggregateReportData(athlete, activities);

  // 2. Call Edge Function (handles AI call + DB save)
  const { aiAnalysis, reportId, createdAt } = await callEdgeFunction(
    reportData,
    athlete.id,
    periodWeeks
  );

  // 3. Validate critical fields (fill defaults if missing)
  if (!aiAnalysis.resumen_ejecutivo) {
    aiAnalysis.resumen_ejecutivo = {
      nivel_fitness: 'moderado',
      puntuacion_global: 5,
      logros: [],
      areas_mejora: [],
      resumen_general: 'No se pudo generar el resumen ejecutivo.',
    };
  }

  if (!aiAnalysis.riesgo_lesion) {
    aiAnalysis.riesgo_lesion = {
      nivel_riesgo: 'moderado',
      puntuacion_riesgo: 5,
      factores_riesgo: [],
      medidas_preventivas: [],
    };
  }

  if (!aiAnalysis.recomendaciones) {
    aiAnalysis.recomendaciones = {
      ajustes_entrenamiento: [],
      areas_foco: [],
      proximos_pasos: [],
      mensaje_motivacional: '',
    };
  }

  if (!aiAnalysis.analisis_vdot && reportData.vdot) {
    aiAnalysis.analisis_vdot = {
      interpretacion: 'No se pudo generar el análisis VDOT.',
      zonas_recomendadas: [],
      progresion_sugerida: '',
    };
  }

  if (!aiAnalysis.periodizacion_analisis && reportData.periodization) {
    aiAnalysis.periodizacion_analisis = {
      evaluacion_mesociclo: 'No se pudo generar el análisis de periodización.',
      cumplimiento_plan: '',
      ajustes_sugeridos: [],
    };
  }

  return { reportData, aiAnalysis, reportId, createdAt };
};

// ─── Saved Reports ───────────────────────────────────────────────────────────

/**
 * Get saved reports for an athlete
 */
export const getAthleteReports = async (athleteId) => {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('id, created_at, period_weeks, status, ai_analysis')
    .eq('athlete_id', athleteId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
};

/**
 * Get a single saved report by ID
 */
export const getReportById = async (reportId) => {
  const { data, error } = await supabase
    .from('ai_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Delete a saved report
 */
export const deleteReport = async (reportId) => {
  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
};
