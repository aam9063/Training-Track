import { supabase } from '../lib/supabase';
import { calculateAcwr } from '../lib/trainingMetrics';

/**
 * Fetch team health snapshot for all athletes of a coach.
 * Single batch query — no N+1.
 *
 * Returns array of:
 * {
 *   id, firstName, lastName, profileImage,
 *   injuryStatus, injuryNotes,
 *   acwr, ctl, atl, tsb,               // from latest daily_training_load row
 *   lastSessionDate, lastSessionTitle,  // from training_sessions
 *   lastSessionStatus,
 *   engagementTone, silenceDays,        // from athlete_engagement_alerts (open only)
 * }
 */
export const getTeamHealthSnapshot = async (coachId) => {
  if (!coachId) return { data: [], error: null };

  try {
    // 1. Active athlete ids
    const { data: rels, error: relErr } = await supabase
      .from('coach_athlete_relationship')
      .select('athlete_id')
      .eq('coach_id', coachId)
      .eq('status', 'active');

    if (relErr) throw relErr;
    if (!rels?.length) return { data: [], error: null };

    const athleteIds = rels.map(r => r.athlete_id);

    // 2. Parallel batch queries
    const [usersRes, athletesRes, loadRes, sessionsRes, engagementRes] = await Promise.all([
      // Basic user info
      supabase
        .from('users')
        .select('id, first_name, last_name, profile_image')
        .in('id', athleteIds),

      // Injury status from athletes table
      supabase
        .from('athletes')
        .select('id, injury_status, injury_notes')
        .in('id', athleteIds),

      // Latest PMC row per athlete — get last 2 days to have the most recent
      supabase
        .from('daily_training_load')
        .select('athlete_id, date, ctl, atl, tsb, chronic_load_28')
        .in('athlete_id', athleteIds)
        .order('date', { ascending: false })
        .limit(athleteIds.length * 2),

      // Last completed/skipped session per athlete
      supabase
        .from('training_sessions')
        .select('athlete_id, scheduled_date, title, status')
        .eq('coach_id', coachId)
        .in('athlete_id', athleteIds)
        .in('status', ['completed', 'skipped', 'pending'])
        .order('scheduled_date', { ascending: false })
        .limit(athleteIds.length * 5),

      // Open engagement/churn-risk alerts (Agent 2) — at most one open row
      // per athlete (partial unique dedup index on (athlete_id, alert_type)
      // WHERE status='open', and there's only one alert_type).
      supabase
        .from('athlete_engagement_alerts')
        .select('athlete_id, severity, silence_days')
        .in('athlete_id', athleteIds)
        .eq('status', 'open'),
    ]);

    // 3. Build latest load map (first occurrence = most recent per athlete)
    const latestLoadMap = {};
    for (const row of (loadRes.data || [])) {
      if (!latestLoadMap[row.athlete_id]) {
        latestLoadMap[row.athlete_id] = row;
      }
    }

    // 4. Build last session map
    const lastSessionMap = {};
    for (const s of (sessionsRes.data || [])) {
      if (!lastSessionMap[s.athlete_id]) {
        lastSessionMap[s.athlete_id] = s;
      }
    }

    // 5. Build injury map
    const injuryMap = {};
    for (const a of (athletesRes.data || [])) {
      injuryMap[a.id] = { status: a.injury_status || 'ok', notes: a.injury_notes || '' };
    }

    // 5b. Build engagement alert map (severity: 'warning' | 'danger')
    const engagementMap = {};
    for (const e of (engagementRes.data || [])) {
      engagementMap[e.athlete_id] = { tone: e.severity, silenceDays: e.silence_days };
    }

    // 6. Assemble result
    const data = athleteIds.map(id => {
      const user = usersRes.data?.find(u => u.id === id) || {};
      const load = latestLoadMap[id] || null;
      const session = lastSessionMap[id] || null;
      const injury = injuryMap[id] || { status: 'ok', notes: '' };
      const engagement = engagementMap[id] || null;

      const ctl = load?.ctl ?? null;
      const atl = load?.atl ?? null;
      const tsb = load?.tsb != null ? Math.round(load.tsb) : null;
      // ACWR denominator: chronic_load_28 (canonical 28-day chronic window)
      // once recomputed by the agent, falling back to the legacy ctl
      // (42-day) denominator for rows not yet recomputed — same pattern as
      // trainingLoadService.js's getReadinessScore.
      const acwrDenominator = load?.chronic_load_28 ?? ctl ?? null;
      const acwr = acwrDenominator != null && atl != null ? calculateAcwr(atl, acwrDenominator) : null;

      return {
        id,
        firstName: user.first_name || 'Sin nombre',
        lastName: user.last_name || '',
        profileImage: user.profile_image || null,
        injuryStatus: injury.status,
        injuryNotes: injury.notes,
        acwr,
        ctl: ctl != null ? Math.round(ctl) : null,
        atl: atl != null ? Math.round(atl) : null,
        tsb,
        lastLoadDate: load?.date || null,
        lastSessionDate: session?.scheduled_date || null,
        lastSessionTitle: session?.title || null,
        lastSessionStatus: session?.status || null,
        engagementTone: engagement?.tone || null,
        silenceDays: engagement?.silenceDays ?? null,
      };
    });

    return { data, error: null };
  } catch (error) {
    console.error('getTeamHealthSnapshot error:', error);
    return { data: [], error };
  }
};

/**
 * Update injury status for a single athlete.
 */
export const updateAthleteInjuryStatus = async (athleteId, injuryStatus, injuryNotes = '') => {
  const { error } = await supabase
    .from('athletes')
    .update({ injury_status: injuryStatus, injury_notes: injuryNotes })
    .eq('id', athleteId);

  return { error };
};
