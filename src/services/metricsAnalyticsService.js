import { supabase } from '../lib/supabase';
import {
  bucketCadence,
  vdotFromRace,
  coefficientOfVariation,
  consistencyLabel,
  vo2maxUth,
  vo2maxFromVdot,
  paceZonesFromThreshold,
  paceZonesFromVdot,
} from '../lib/trainingMetrics';

/**
 * Analytics service for advanced metrics (deep views).
 *
 * All functions return { data, error } where error is null on success,
 * or an object { message } on failure.
 */

// Map Strava best_effort.name (lowercase) to our canonical distance_key.
const BEST_EFFORT_NAME_MAP = {
  '1k': '1K',
  '5k': '5K',
  '10k': '10K',
  '1/2 marathon': 'half',
  'half marathon': 'half',
  'half-marathon': 'half',
  'marathon': 'marathon',
};

const normalizeBestEffortName = (name) => {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return BEST_EFFORT_NAME_MAP[key] || null;
};

// Running-only activity types. Used to exclude cycling, swimming, gym, yoga,
// etc. from analytics that must be running-specific (weekly load, pace zones,
// cadence, VDOT, best efforts). The `type` column in strava_activities uses
// these exact string values (TrailRun/VirtualRun appear as sport_type but type
// defaults to 'Run' for them; we include all three defensively).
const RUNNING_ACTIVITY_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

/**
 * Evolution of best efforts over time for 1K / 5K / 10K / half / marathon.
 * Returns an array of { activity_date, distance_key, elapsed_time_sec }.
 */
export const getBestEffortsEvolution = async (athleteId, limit = 50) => {
  if (!athleteId) {
    return { data: [], error: { message: 'athleteId requerido' } };
  }

  const { data: activities, error } = await supabase
    .from('strava_activities')
    .select('id, start_date_local, best_efforts')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .not('best_efforts', 'is', null)
    .order('start_date_local', { ascending: true })
    .limit(limit);

  if (error) return { data: [], error };

  const rows = [];
  (activities || []).forEach((act) => {
    const efforts = Array.isArray(act.best_efforts) ? act.best_efforts : [];
    efforts.forEach((eff) => {
      const distance_key = normalizeBestEffortName(eff?.name);
      if (!distance_key) return;
      const elapsed = Number(eff?.elapsed_time ?? eff?.elapsed_time_sec);
      if (!Number.isFinite(elapsed) || elapsed <= 0) return;
      rows.push({
        activity_date: act.start_date_local,
        distance_key,
        elapsed_time_sec: elapsed,
      });
    });
  });

  return { data: rows, error: null };
};

const weeksAgoIso = (weeks) => {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString();
};

const fetchStreamsForWindow = async (athleteId, weeks) => {
  const since = weeksAgoIso(weeks);

  const { data: activities, error: actError } = await supabase
    .from('strava_activities')
    .select('id, start_date')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .gte('start_date', since);

  if (actError) return { streams: [], error: actError };
  if (!activities || activities.length === 0) return { streams: [], error: null };

  const ids = activities.map((a) => a.id);
  const { data: streams, error: streamsError } = await supabase
    .from('strava_activity_streams')
    .select('activity_id, heartrate, time')
    .in('activity_id', ids);

  if (streamsError) return { streams: [], error: streamsError };

  return { streams: streams || [], error: null };
};

// Athlete HR zones live in a single `zones` jsonb column synced from Strava's
// /athlete/zones endpoint. Shape example: [{zone:1,min:0,max:130},...].
const loadAthleteZones = async (athleteId) => {
  const { data, error } = await supabase
    .from('athlete_hr_zones')
    .select('zones')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) return { zones: null, error };
  if (!data?.zones || !Array.isArray(data.zones) || data.zones.length < 5) {
    return { zones: null, error: null };
  }

  // Normalize: ensure each zone has {zone, min, max} numbers, sorted by zone.
  const normalized = data.zones
    .map((z) => ({
      zone: Number(z.zone) || 0,
      min: Number(z.min) || 0,
      max: Number(z.max) || 9999,
    }))
    .filter((z) => z.zone >= 1 && z.zone <= 5)
    .sort((a, b) => a.zone - b.zone);

  if (normalized.length < 5) return { zones: null, error: null };
  return { zones: normalized, error: null };
};

const classifyZone = (hr, zones) => {
  for (let i = 0; i < zones.length; i += 1) {
    const z = zones[i];
    if (hr <= z.max && hr > z.min) return z.zone;
  }
  if (hr <= zones[0].max) return 1;
  return 5;
};

const aggregateTimeInZones = (streams, zones) => {
  const secondsByZone = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  streams.forEach((row) => {
    const hrArr = Array.isArray(row.heartrate) ? row.heartrate : [];
    const timeArr = Array.isArray(row.time) ? row.time : [];
    if (hrArr.length === 0) return;

    for (let i = 0; i < hrArr.length; i += 1) {
      const hr = Number(hrArr[i]);
      if (!Number.isFinite(hr) || hr <= 0) continue;
      let dt = 1;
      if (timeArr[i] != null && timeArr[i - 1] != null) {
        dt = Number(timeArr[i]) - Number(timeArr[i - 1]);
        if (!Number.isFinite(dt) || dt <= 0) dt = 1;
      }
      const z = classifyZone(hr, zones);
      secondsByZone[z] += dt;
    }
  });

  return secondsByZone;
};

/**
 * Aggregate time-in-zone across all activity streams in last N weeks.
 * Returns { hasZones, zones: [{zone, seconds, pct}, ...] }.
 */
export const getTimeInZoneAggregate = async (athleteId, weeks = 4) => {
  if (!athleteId) return { data: { hasZones: false }, error: { message: 'athleteId requerido' } };

  const { zones, error: zoneError } = await loadAthleteZones(athleteId);
  if (zoneError) return { data: { hasZones: false }, error: zoneError };
  if (!zones) return { data: { hasZones: false }, error: null };

  const { streams, error: streamsError } = await fetchStreamsForWindow(athleteId, weeks);
  if (streamsError) return { data: { hasZones: true, zones: [] }, error: streamsError };

  const secondsByZone = aggregateTimeInZones(streams, zones);
  const total = Object.values(secondsByZone).reduce((s, v) => s + v, 0);
  const zonesOut = [1, 2, 3, 4, 5].map((z) => ({
    zone: z,
    seconds: secondsByZone[z],
    pct: total > 0 ? Number(((secondsByZone[z] / total) * 100).toFixed(1)) : 0,
  }));

  return { data: { hasZones: true, zones: zonesOut }, error: null };
};

/**
 * Classify intensity distribution (polarizado / piramidal / otro) from last N weeks.
 */
export const getIntensityDistribution = async (athleteId, weeks = 4) => {
  if (!athleteId) {
    return { data: null, error: { message: 'athleteId requerido' } };
  }

  const { data: agg, error } = await getTimeInZoneAggregate(athleteId, weeks);
  if (error) return { data: null, error };
  if (!agg?.hasZones) {
    return { data: { hasZones: false }, error: null };
  }

  const z1 = agg.zones.find((z) => z.zone === 1)?.pct || 0;
  const z2 = agg.zones.find((z) => z.zone === 2)?.pct || 0;
  const z3 = agg.zones.find((z) => z.zone === 3)?.pct || 0;
  const z4 = agg.zones.find((z) => z.zone === 4)?.pct || 0;
  const z5 = agg.zones.find((z) => z.zone === 5)?.pct || 0;

  const z12_pct = Number((z1 + z2).toFixed(1));
  const z3_pct = Number(z3.toFixed(1));
  const z45_pct = Number((z4 + z5).toFixed(1));

  let label = 'otro';
  if (z12_pct >= 75 && z45_pct >= 10 && z3_pct < 15) label = 'polarizado';
  else if (z3_pct > z45_pct && z12_pct > 60) label = 'piramidal';

  return {
    data: { hasZones: true, z12_pct, z3_pct, z45_pct, label, weeks },
    error: null,
  };
};

/**
 * List of athlete shoes (or other gear) stored in athlete_gear.
 */
export const getShoes = async (athleteId) => {
  if (!athleteId) return { data: [], error: { message: 'athleteId requerido' } };

  const { data, error } = await supabase
    .from('athlete_gear')
    .select('id, name, distance_meters, primary_gear, active, brand_name, model_name')
    .eq('athlete_id', athleteId)
    .order('distance_meters', { ascending: false });

  if (error) return { data: [], error };

  const mapped = (data || []).map((row) => ({
    id: row.id,
    name: row.name || [row.brand_name, row.model_name].filter(Boolean).join(' ') || 'Zapatilla',
    distance_km: Math.round((Number(row.distance_meters) || 0) / 1000),
    active: row.active !== false,
    primary: Boolean(row.primary_gear),
  }));
  return { data: mapped, error: null };
};

/**
 * Cardiac drift (Pa:HR) for a single activity's streams.
 * Splits the arrays in two halves by the time stream and computes drift%.
 */
export const getCardiacDriftForActivity = async (activityUuid) => {
  if (!activityUuid) return { data: null, error: { message: 'activityUuid requerido' } };

  const { data, error } = await supabase
    .from('strava_activity_streams')
    .select('heartrate, velocity, time')
    .eq('activity_id', activityUuid)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  const hr = Array.isArray(data.heartrate) ? data.heartrate : [];
  const vel = Array.isArray(data.velocity) ? data.velocity : [];
  const time = Array.isArray(data.time) ? data.time : [];
  const n = Math.min(hr.length, vel.length, time.length);
  if (n < 60) return { data: null, error: null };

  const mid = Math.floor(n / 2);
  const duration_sec = Number(time[n - 1]) - Number(time[0] || 0);

  const halfStats = (start, end) => {
    let hrSum = 0;
    let hrCnt = 0;
    let velSum = 0;
    let velCnt = 0;
    for (let i = start; i < end; i += 1) {
      const h = Number(hr[i]);
      const v = Number(vel[i]);
      if (Number.isFinite(h) && h > 0) {
        hrSum += h;
        hrCnt += 1;
      }
      if (Number.isFinite(v) && v > 0) {
        velSum += v;
        velCnt += 1;
      }
    }
    const avgHR = hrCnt > 0 ? hrSum / hrCnt : 0;
    const avgVel = velCnt > 0 ? velSum / velCnt : 0;
    // Pa:HR ratio: pace (sec/m = 1/velocity) / HR — we use velocity/HR as a
    // proxy for efficiency; higher is better. Drift is negative when efficiency drops.
    const paHr = avgHR > 0 ? avgVel / avgHR : 0;
    return { avgHR, avgVel, paHr };
  };

  const first = halfStats(0, mid);
  const second = halfStats(mid, n);

  if (!first.paHr || !second.paHr) return { data: null, error: null };

  const drift_pct = Number((((second.paHr / first.paHr) - 1) * 100).toFixed(2));
  let interpretation = 'medio';
  if (drift_pct >= 0) interpretation = 'eficiencia';
  else if (drift_pct <= -5) interpretation = 'fatiga';

  return {
    data: {
      drift_pct,
      first_half_pa_hr: Number(first.paHr.toFixed(4)),
      second_half_pa_hr: Number(second.paHr.toFixed(4)),
      duration_min: Math.round(duration_sec / 60),
      interpretation,
    },
    error: null,
  };
};

/**
 * Weekly training load from suffer_score, aggregated over the last N weeks.
 */
export const getWeeklyLoadSeries = async (athleteId, weeks = 12) => {
  if (!athleteId) return { data: [], error: { message: 'athleteId requerido' } };

  const since = weeksAgoIso(weeks);
  const { data, error } = await supabase
    .from('strava_activities')
    .select('start_date_local, suffer_score')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .gte('start_date_local', since)
    .order('start_date_local', { ascending: true });

  if (error) return { data: [], error };

  const weekBuckets = new Map();
  (data || []).forEach((row) => {
    if (!row.start_date_local || row.suffer_score == null) return;
    const d = new Date(row.start_date_local);
    // ISO week key: YYYY-Www
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const pastDays = (d - yearStart) / 86400000;
    const week = Math.ceil((pastDays + yearStart.getUTCDay() + 1) / 7);
    const key = `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    weekBuckets.set(key, (weekBuckets.get(key) || 0) + Number(row.suffer_score));
  });

  const series = Array.from(weekBuckets.entries())
    .map(([week, total_suffer]) => ({ week, total_suffer: Math.round(total_suffer) }))
    .sort((a, b) => (a.week < b.week ? -1 : 1));

  return { data: series, error: null };
};

// ============================================================
// Extended analytics (metrics-charts-extended)
// ============================================================

const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const weekStartLocal = (d) => {
  const x = new Date(d);
  // ISO week starts Monday
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * Cadence distribution over the last N weeks of activities.
 */
export const getCadenceDistribution = async (athleteId, weeks = 8) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  const since = weeksAgoIso(weeks);
  const { data: activities, error: actError } = await supabase
    .from('strava_activities')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .gte('start_date', since);

  if (actError) return { data: null, error: actError };
  if (!activities || activities.length === 0) {
    return { data: { buckets: [], mean_spm: 0, valid_samples: 0 }, error: null };
  }

  const ids = activities.map((a) => a.id);
  const { data: streams, error: streamsError } = await supabase
    .from('strava_activity_streams')
    .select('cadence, time')
    .in('activity_id', ids);

  if (streamsError) return { data: null, error: streamsError };

  const samples = [];
  (streams || []).forEach((row) => {
    const cad = Array.isArray(row.cadence) ? row.cadence : [];
    const t = Array.isArray(row.time) ? row.time : [];
    for (let i = 0; i < cad.length; i += 1) {
      const c = Number(cad[i]);
      if (!Number.isFinite(c) || c <= 0) continue;
      let dt = 1;
      if (t[i] != null && t[i - 1] != null) {
        const delta = Number(t[i]) - Number(t[i - 1]);
        if (Number.isFinite(delta) && delta > 0 && delta < 30) dt = delta;
      }
      samples.push({ cadence: c, dt });
    }
  });

  const bucketed = bucketCadence(samples);
  return { data: bucketed, error: null };
};

/**
 * Weekly heatmap: (weekStart, dayOfWeek) → suffer_score (or distance-km fallback).
 */
export const getWeeklyLoadHeatmap = async (athleteId, weeks = 12) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  const since = weeksAgoIso(weeks);
  const { data, error } = await supabase
    .from('strava_activities')
    .select('start_date_local, suffer_score, distance')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .gte('start_date_local', since)
    .order('start_date_local', { ascending: true });

  if (error) return { data: null, error };

  // Initialize N-week grid ending this week
  const now = new Date();
  const thisWeekStart = weekStartLocal(now);
  const grid = new Map(); // weekStartKey → Map(dow → { score, source })
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const ws = new Date(thisWeekStart);
    ws.setDate(ws.getDate() - w * 7);
    grid.set(toLocalDateStr(ws), new Map());
  }

  (data || []).forEach((row) => {
    if (!row.start_date_local) return;
    const d = new Date(row.start_date_local);
    const ws = weekStartLocal(d);
    const key = toLocalDateStr(ws);
    if (!grid.has(key)) return;
    const dow = (d.getDay() === 0 ? 6 : d.getDay() - 1); // Mon=0..Sun=6
    const score = row.suffer_score != null ? Number(row.suffer_score) : null;
    const kmLoad = score == null && row.distance != null
      ? Math.round(Number(row.distance) / 1000)
      : null;
    const cell = grid.get(key);
    const prev = cell.get(dow) || { score: 0, source: 'suffer' };
    const value = score != null ? score : (kmLoad || 0);
    const source = score != null ? 'suffer' : 'distance';
    cell.set(dow, { score: prev.score + value, source });
  });

  const weeksOut = Array.from(grid.entries()).map(([week_start, cell]) => ({
    week_start,
    days: Array.from({ length: 7 }, (_, dow) => ({
      dow,
      ...(cell.get(dow) || { score: 0, source: 'suffer' }),
    })),
  }));

  return { data: { weeks: weeksOut }, error: null };
};

/**
 * VDOT progression — best VDOT per week from best_efforts.
 */
export const getVdotProgression = async (athleteId) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  const { data: activities, error } = await supabase
    .from('strava_activities')
    .select('start_date_local, best_efforts')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .not('best_efforts', 'is', null)
    .order('start_date_local', { ascending: true });

  if (error) return { data: null, error };

  const weekBest = new Map();
  (activities || []).forEach((act) => {
    if (!act.start_date_local) return;
    const efforts = Array.isArray(act.best_efforts) ? act.best_efforts : [];
    const d = new Date(act.start_date_local);
    const ws = toLocalDateStr(weekStartLocal(d));

    efforts.forEach((eff) => {
      const distance = Number(eff?.distance ?? eff?.distance_m);
      const elapsed = Number(eff?.elapsed_time ?? eff?.elapsed_time_sec);
      if (!Number.isFinite(distance) || distance < 1000) return;
      if (!Number.isFinite(elapsed) || elapsed <= 0) return;
      const vdot = vdotFromRace(distance, elapsed);
      if (!vdot) return;
      const prev = weekBest.get(ws);
      if (!prev || vdot > prev.vdot) {
        weekBest.set(ws, { date: ws, vdot });
      }
    });
  });

  const series = Array.from(weekBest.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1
  );

  return { data: { series }, error: null };
};

/**
 * Minetti cost of running from grade (as decimal, e.g., 0.05 = 5%).
 */
const minettiCost = (g) => {
  const pow = (b, e) => b ** e;
  return (
    155.4 * pow(g, 5)
    - 30.4 * pow(g, 4)
    - 43.3 * pow(g, 3)
    + 46.3 * pow(g, 2)
    + 19.5 * g
    + 3.6
  );
};
const FLAT_COST = minettiCost(0); // ≈ 3.6

/**
 * Compute grade-adjusted pace series for a single activity.
 */
export const getGapForActivity = async (activityUuid) => {
  if (!activityUuid) return { data: null, error: { message: 'activityUuid requerido' } };

  const { data, error } = await supabase
    .from('strava_activity_streams')
    .select('velocity_smooth, grade_smooth, distance, time')
    .eq('activity_id', activityUuid)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  const vel = Array.isArray(data.velocity_smooth) ? data.velocity_smooth : [];
  const grade = Array.isArray(data.grade_smooth) ? data.grade_smooth : [];
  const time = Array.isArray(data.time) ? data.time : [];
  const n = Math.min(vel.length, grade.length, time.length);
  if (n < 60) return { data: null, error: null };

  const outTime = [];
  const outReal = [];
  const outGap = [];
  let deltaSum = 0;
  let deltaCnt = 0;

  for (let i = 0; i < n; i += 1) {
    const v = Number(vel[i]);
    const g = Number(grade[i]) / 100; // %
    if (!Number.isFinite(v) || v <= 0.5) continue;
    const paceReal = 1000 / v / 60 * 60; // sec/km
    const cost = minettiCost(g);
    const adjustment = cost > 0 ? FLAT_COST / cost : 1;
    const paceGap = paceReal * adjustment;
    if (Number.isFinite(paceReal) && Number.isFinite(paceGap)) {
      outTime.push(Number(time[i]) || i);
      outReal.push(Math.round(paceReal));
      outGap.push(Math.round(paceGap));
      deltaSum += (paceReal - paceGap);
      deltaCnt += 1;
    }
  }

  if (outTime.length === 0) {
    return { data: null, error: null };
  }

  return {
    data: {
      time: outTime,
      pace_real: outReal,
      pace_gap: outGap,
      avg_delta_sec: deltaCnt > 0 ? Math.round(deltaSum / deltaCnt) : 0,
    },
    error: null,
  };
};

/**
 * Per-km splits parsed from splits_metric JSONB.
 */
export const getSplitsForActivity = async (activityUuid) => {
  if (!activityUuid) return { data: null, error: { message: 'activityUuid requerido' } };

  const { data, error } = await supabase
    .from('strava_activities')
    .select('splits_metric')
    .eq('id', activityUuid)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data?.splits_metric || !Array.isArray(data.splits_metric) || data.splits_metric.length === 0) {
    return { data: { splits: [] }, error: null };
  }

  const splits = data.splits_metric.map((s, idx) => {
    const avgSpeed = Number(s.average_speed);
    const pace = avgSpeed > 0 ? Math.round(1000 / avgSpeed) : null;
    return {
      km: idx + 1,
      pace_sec_per_km: pace,
      hr: Number.isFinite(Number(s.average_heartrate)) ? Number(s.average_heartrate) : null,
      elev_diff: Number.isFinite(Number(s.elevation_difference))
        ? Number(s.elevation_difference)
        : 0,
    };
  });

  return { data: { splits }, error: null };
};

/**
 * Laps from `laps` JSONB — with consistency (CV of pace).
 */
export const getLapsForActivity = async (activityUuid) => {
  if (!activityUuid) return { data: null, error: { message: 'activityUuid requerido' } };

  const { data, error } = await supabase
    .from('strava_activities')
    .select('laps')
    .eq('id', activityUuid)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data?.laps || !Array.isArray(data.laps) || data.laps.length === 0) {
    return { data: { laps: [], consistency_cv_pct: 0, consistency_label: 'Irregular' }, error: null };
  }

  const laps = data.laps.map((l, idx) => {
    const distance = Number(l.distance) || 0;
    const time = Number(l.moving_time ?? l.elapsed_time) || 0;
    const pace = distance > 0 && time > 0 ? Math.round((time / distance) * 1000) : 0;
    return {
      lap_index: idx + 1,
      time,
      distance,
      pace,
      hr: Number.isFinite(Number(l.average_heartrate)) ? Number(l.average_heartrate) : null,
    };
  });

  const paces = laps.map((l) => l.pace).filter((p) => p > 0);
  const cv = coefficientOfVariation(paces);
  return {
    data: {
      laps,
      consistency_cv_pct: Math.round(cv * 10000) / 100,
      consistency_label: consistencyLabel(cv),
    },
    error: null,
  };
};

/**
 * VO2max estimate (Uth primary, VDOT fallback) with a small trend.
 */
export const getVo2maxEstimate = async (athleteId) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  // Get max/rest HR from athletes table
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('max_heart_rate, resting_heart_rate')
    .eq('id', athleteId)
    .maybeSingle();

  if (athleteError) {
    // Don't fail hard — keep fallback path
  }

  let vo2max = null;
  let method = null;
  const maxHr = Number(athlete?.max_heart_rate);
  const restHr = Number(athlete?.resting_heart_rate);
  if (Number.isFinite(maxHr) && maxHr > 0 && Number.isFinite(restHr) && restHr > 0) {
    vo2max = vo2maxUth(maxHr, restHr);
    method = 'uth';
  }

  // Build trend from VDOT progression (up to last 12 points)
  const { data: vdotData } = await getVdotProgression(athleteId);
  const series = (vdotData?.series || []).slice(-12);

  if (vo2max == null && series.length > 0) {
    const latest = series[series.length - 1];
    vo2max = vo2maxFromVdot(latest.vdot);
    method = 'vdot';
  }

  if (vo2max == null) {
    return { data: null, error: null };
  }

  const trend = series.map((p) => ({
    date: p.date,
    value: vo2maxFromVdot(p.vdot) || 0,
  }));

  return { data: { vo2max, method, trend }, error: null };
};

/**
 * Pace zones distribution for the last N weeks (from velocity_smooth streams).
 */
export const getPaceZones = async (athleteId, weeks = 4) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  const since = weeksAgoIso(weeks);
  const { data: activities, error: actError } = await supabase
    .from('strava_activities')
    .select('id')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .in('type', RUNNING_ACTIVITY_TYPES)
    .gte('start_date', since);

  if (actError) return { data: null, error: actError };
  if (!activities || activities.length === 0) {
    return { data: { zones: [], total_seconds: 0, zonesSource: 'default' }, error: null };
  }

  // Resolve zones from vdot if available
  const { data: athlete } = await supabase
    .from('athletes')
    .select('vdot')
    .eq('id', athleteId)
    .maybeSingle();

  let zones;
  let zonesSource = 'default';
  if (Number.isFinite(Number(athlete?.vdot)) && Number(athlete.vdot) > 0) {
    zones = paceZonesFromVdot(Number(athlete.vdot));
    zonesSource = 'vdot';
  } else {
    zones = paceZonesFromThreshold(null);
  }

  const ids = activities.map((a) => a.id);
  const { data: streams, error: streamsError } = await supabase
    .from('strava_activity_streams')
    .select('velocity_smooth, time')
    .in('activity_id', ids);

  if (streamsError) return { data: null, error: streamsError };

  const secondsByZone = zones.map(() => 0);
  let totalSeconds = 0;

  (streams || []).forEach((row) => {
    const vel = Array.isArray(row.velocity_smooth) ? row.velocity_smooth : [];
    const t = Array.isArray(row.time) ? row.time : [];
    for (let i = 0; i < vel.length; i += 1) {
      const v = Number(vel[i]);
      if (!Number.isFinite(v) || v <= 0.5) continue;
      let dt = 1;
      if (t[i] != null && t[i - 1] != null) {
        const delta = Number(t[i]) - Number(t[i - 1]);
        if (Number.isFinite(delta) && delta > 0 && delta < 30) dt = delta;
      }
      const paceSec = 1000 / v; // sec/km
      for (let z = 0; z < zones.length; z += 1) {
        if (paceSec >= zones[z].minSec && paceSec < zones[z].maxSec) {
          secondsByZone[z] += dt;
          totalSeconds += dt;
          break;
        }
      }
    }
  });

  const zonesOut = zones.map((z, i) => ({
    zone: z.zone,
    label: z.label,
    seconds: secondsByZone[i],
    pct: totalSeconds > 0 ? Number(((secondsByZone[i] / totalSeconds) * 100).toFixed(1)) : 0,
  }));

  return {
    data: { zones: zonesOut, total_seconds: totalSeconds, zonesSource },
    error: null,
  };
};

/**
 * Rest vs active days grid for the last N weeks.
 */
export const getRestVsActiveDays = async (athleteId, weeks = 8) => {
  if (!athleteId) return { data: null, error: { message: 'athleteId requerido' } };

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);

  const { data, error } = await supabase
    .from('strava_activities')
    .select('start_date_local')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .gte('start_date_local', start.toISOString());

  if (error) return { data: null, error };

  const activeSet = new Set();
  (data || []).forEach((row) => {
    if (!row.start_date_local) return;
    const d = new Date(row.start_date_local);
    d.setHours(0, 0, 0, 0);
    activeSet.add(toLocalDateStr(d));
  });

  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = toLocalDateStr(cur);
    days.push({ date: key, active: activeSet.has(key) });
    cur.setDate(cur.getDate() + 1);
  }

  return { data: { days }, error: null };
};

/**
 * Recent activities for the selector dropdown.
 */
export const getRecentActivitiesForSelector = async (athleteId, limit = 30) => {
  if (!athleteId) return { data: [], error: { message: 'athleteId requerido' } };

  const { data, error } = await supabase
    .from('strava_activities')
    .select('id, strava_id, name, type, start_date_local, distance, moving_time, has_streams')
    .eq('athlete_id', athleteId)
    .eq('deleted', false)
    .order('start_date_local', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error };

  return { data: data || [], error: null };
};
