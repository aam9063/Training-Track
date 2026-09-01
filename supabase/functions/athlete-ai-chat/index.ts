import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const gemmaApiKey = Deno.env.get('GEMMA4_API_KEY')!;
const GEMMA_MODEL = 'gemini-2.5-flash';
const GEMMA_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=`;;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Build system prompt for coach-about-athlete context ─────────────────────

function buildCoachSystemPrompt(data: Record<string, unknown>): string {
  const athlete = data.athlete as Record<string, unknown> | null;
  const pmc = data.pmc as Record<string, unknown> | null;
  const reports = data.reports as Array<Record<string, unknown>>;
  const sessions = data.sessions as Array<Record<string, unknown>>;
  const diary = data.diary as Array<Record<string, unknown>>;
  const wellness = data.wellness as Array<Record<string, unknown>>;
  const competitions = data.competitions as Array<Record<string, unknown>>;
  const paces = data.paces as Array<Record<string, unknown>>;
  const athleteName = data.athleteName as string;

  // Athlete base info
  const vamKmh = athlete?.vam_kmh ? parseFloat(athlete.vam_kmh as string) : null;
  const vo2max = vamKmh ? (vamKmh * 3.5).toFixed(1) : null;
  const athleteBlock = `ATLETA: ${athleteName}${athlete?.resting_heart_rate ? ` | FC reposo: ${athlete.resting_heart_rate}bpm` : ''}${vamKmh ? ` | VAM: ${vamKmh}km/h | VO2max est: ${vo2max}ml/kg/min` : ''}`;

  // Paces block (R1-R10, RR)
  const pacesBlock = paces.length > 0
    ? 'RITMOS: ' + paces.map(p => {
        const mm = Math.floor((p.pace_seconds_per_km as number) / 60);
        const ss = String((p.pace_seconds_per_km as number) % 60).padStart(2, '0');
        return `${p.pace_code}=${mm}:${ss}/km`;
      }).join(' | ')
    : '';

  // Current PMC state
  const pmcBlock = pmc
    ? `FORMA ACTUAL: CTL=${pmc.ctl} ATL=${pmc.atl} TSB=${pmc.tsb} (TSB>0=fresco, <-10=cargado, <-30=sobrecarga)`
    : 'FORMA ACTUAL: sin datos PMC';

  // Last 4 weekly reports
  const reportsBlock = reports.length > 0
    ? 'ÚLTIMAS SEMANAS:\n' + reports.map(r => {
        const ai = r.ai_analysis as Record<string, unknown> | null;
        return `  ${r.week_start}: ${r.actual_km}km, ${r.sessions_done}/${r.sessions_planned} ses, ACWR=${r.acwr ?? '—'}, TSB=${r.tsb ?? '—'}, RPE=${r.avg_rpe ?? '—'}, alerta=${r.alert_level}${ai?.resumen ? `\n    → ${(ai.resumen as string).substring(0, 120)}...` : ''}`;
      }).join('\n')
    : 'ÚLTIMAS SEMANAS: sin informes generados aún';

  // Recent sessions (last 2 weeks)
  const sessionsBlock = sessions.length > 0
    ? 'SESIONES RECIENTES:\n' + sessions.map(s =>
        `  [${s.scheduled_date}] "${s.title}" — ${s.status}${s.rpe_score ? `, RPE ${s.rpe_score}/10` : ''}`
      ).join('\n')
    : '';

  // Weekly diary entries
  const diaryBlock = diary.length > 0
    ? 'DIARIO ATLETA:\n' + diary.map(d =>
        `  Sem ${d.week_start}: sensación ${d.overall_rating}/5${d.pain_notes ? `, molestias: "${d.pain_notes}"` : ''}, confianza próx sem ${d.next_week_rating}/5`
      ).join('\n')
    : '';

  // Recent wellness (last 7 days with data)
  const wellnessBlock = wellness.length > 0
    ? 'WELLNESS RECIENTE:\n' + wellness.map(w =>
        `  [${w.entry_date}] sueño=${w.sleep_hours ?? '?'}h fatiga=${w.fatigue ?? '?'}/10 dolor=${w.soreness ?? '?'}/10 humor=${w.mood ?? '?'}/10 estrés=${w.stress ?? '?'}/10`
      ).join('\n')
    : '';

  // Upcoming competitions
  const compBlock = competitions.length > 0
    ? 'COMPETICIONES:\n' + competitions.map(c => {
        const days = Math.ceil((new Date(c.event_date as string).getTime() - Date.now()) / 86400000);
        return `  ${c.name} | ${c.event_date}${c.distance_km ? ` | ${c.distance_km}km` : ''} | en ${days} días`;
      }).join('\n')
    : '';

  return `Eres un asistente de entrenamiento deportivo de élite para el entrenador de TrainingTrack.
Tienes acceso a los datos reales del atleta y respondes preguntas sobre su estado, progresión y decisiones de entrenamiento.
Responde en español, de forma concisa y práctica. Usa los datos concretos del atleta en tus respuestas.
Si no tienes suficientes datos para responder con certeza, indícalo claramente.
REGLA DE FORMATO OBLIGATORIA: Tu respuesta debe ser TEXTO PLANO. Prohibido usar cualquier sintaxis Markdown: nada de #, ##, ###, nada de ** o * para negritas/cursivas, nada de listas con - o *. Solo texto normal, saltos de linea, emojis y numeros para listas (1. 2. 3.). Esta regla es CRITICA y no negociable.

${athleteBlock}
${pacesBlock ? '\n' + pacesBlock : ''}

${pmcBlock}

${reportsBlock}
${sessionsBlock ? '\n' + sessionsBlock : ''}
${diaryBlock ? '\n' + diaryBlock : ''}
${wellnessBlock ? '\n' + wellnessBlock : ''}
${compBlock ? '\n' + compBlock : ''}`.trim();
}

// ─── Build system prompt for independent athlete self-chat ────────────────────

function buildIndependentSystemPrompt(data: Record<string, unknown>): string {
  const athleteName = data.athleteName as string;
  const profile = data.profile as Record<string, unknown> | null;
  const recentSessions = data.recentSessions as Array<Record<string, unknown>>;
  const competitions = data.competitions as Array<Record<string, unknown>>;
  const planAdherencePct = data.planAdherencePct as number | null;
  const avgRpe4Weeks = data.avgRpe4Weeks as number | null;
  const recentNotes = data.recentNotes as Array<string>;
  const totalKm = data.totalKm as number;
  const dailyStreak = data.dailyStreak as number;
  const stravaActivities = data.stravaActivities as Array<Record<string, unknown>>;
  const vamTest = data.vamTest as Record<string, unknown> | null;
  const trainingLoad = data.trainingLoad as Record<string, unknown> | null;
  const wellnessEntries = data.wellnessEntries as Array<Record<string, unknown>>;

  const fmtPace = (s: number | null | undefined): string => s ? Math.floor(s / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0') : '-';

  // Profile block
  const profileParts: string[] = [];
  if (profile?.modalidad) profileParts.push(`modalidad: ${profile.modalidad}`);
  if (profile?.objetivo) profileParts.push(`objetivo: ${profile.objetivo}`);
  if (profile?.km_semanales) profileParts.push(`km/sem objetivo: ${profile.km_semanales}`);
  if (profile?.dias_disponibles) profileParts.push(`días disponibles: ${profile.dias_disponibles}`);
  const profileBlock = profileParts.length > 0
    ? `PERFIL: ${athleteName} | ${profileParts.join(' | ')}`
    : `PERFIL: ${athleteName}`;

  // Plan adherence
  const adherenceBlock = planAdherencePct != null
    ? `ADHERENCIA AL PLAN (últimas 4 semanas): ${planAdherencePct}%`
    : 'ADHERENCIA AL PLAN: sin datos suficientes';

  // RPE trend
  const rpeBlock = avgRpe4Weeks != null
    ? `RPE MEDIO (últimas 4 semanas): ${avgRpe4Weeks}/10`
    : 'RPE MEDIO: sin datos registrados';

  // Streak
  const streakBlock = dailyStreak > 0
    ? `RACHA ACTUAL: ${dailyStreak} día${dailyStreak !== 1 ? 's' : ''} consecutivos`
    : 'RACHA ACTUAL: ninguna';

  // Recent sessions (last 2 weeks)
  const sessionsBlock = recentSessions.length > 0
    ? 'SESIONES RECIENTES:\n' + recentSessions.map(s => {
        const parts = [`  [${s.scheduled_date}] "${s.title}" — ${s.status}`];
        if (s.rpe) parts.push(`, RPE ${s.rpe}/10`);
        if (s.actual_distance_km) parts.push(`, ${s.actual_distance_km}km`);
        if (s.actual_time_minutes) parts.push(`, ${s.actual_time_minutes}min`);
        return parts.join('');
      }).join('\n')
    : 'SESIONES RECIENTES: ninguna registrada';

  // Upcoming competitions
  const compBlock = competitions.length > 0
    ? 'PRÓXIMAS COMPETICIONES:\n' + competitions.map(c => {
        const days = Math.ceil((new Date(c.event_date as string).getTime() - Date.now()) / 86400000);
        const parts = [`  ${c.name} | ${c.event_date}`];
        if (c.distance_km) parts.push(` | ${c.distance_km}km`);
        if (c.location) parts.push(` | ${c.location}`);
        if (c.target_time_seconds) {
          const totalSecs = c.target_time_seconds as number;
          const h = Math.floor(totalSecs / 3600);
          const m = Math.floor((totalSecs % 3600) / 60);
          parts.push(` | objetivo: ${h > 0 ? `${h}h` : ''}${m}m`);
        }
        parts.push(` | en ${days} días`);
        return parts.join('');
      }).join('\n')
    : '';

  // Recent completion notes
  const notesBlock = recentNotes.length > 0
    ? 'NOTAS RECIENTES DEL ATLETA:\n' + recentNotes.map(n => `  - "${n}"`).join('\n')
    : '';

  // Total accumulated km
  const totalKmBlock = totalKm > 0 ? `KM ACUMULADOS TOTALES: ${totalKm.toFixed(1)} km` : '';

  // Strava activities block
  const stravaBlock = stravaActivities.length > 0
    ? 'ACTIVIDADES STRAVA (últimos 30 días):\n' + stravaActivities.map(a => {
        const distKm = a.distance_meters ? ((a.distance_meters as number) / 1000).toFixed(1) : '-';
        const elapsed = a.elapsed_time ? `${Math.floor((a.elapsed_time as number) / 60)}min` : '-';
        const pace = a.distance_meters && a.elapsed_time
          ? fmtPace(((a.elapsed_time as number) / ((a.distance_meters as number) / 1000)))
          : '-';
        const hr = a.average_heartrate ? `FC ${Math.round(a.average_heartrate as number)}` : '';
        const elev = a.total_elevation_gain ? `D+ ${Math.round(a.total_elevation_gain as number)}m` : '';
        return `  [${a.activity_date}] ${a.sport_type || 'Run'} ${distKm}km ${elapsed} ${pace}/km${hr ? ' ' + hr : ''}${elev ? ' ' + elev : ''}`;
      }).join('\n') + '\nUsa estos datos reales para evaluar el rendimiento actual del atleta.'
    : '';

  // VAM test block
  let vamBlock = '';
  if (vamTest) {
    const vamKmh = vamTest.vam_kmh ? parseFloat(vamTest.vam_kmh as string) : null;
    const vo2max = vamKmh ? (vamKmh * 3.5).toFixed(1) : null;
    const mlss = vamKmh ? (vamKmh * 0.78).toFixed(1) : null;
    vamBlock = `TEST VAM:\nVAM: ${vamKmh ?? '-'} km/h | Ritmo: ${fmtPace(vamTest.pace_seconds_per_km as number)}/km | Fecha: ${vamTest.test_date}${vo2max ? `\nVO2max estimado: ${vo2max} ml/kg/min | MLSS: ${mlss} km/h` : ''}`;
  }

  // Training load block
  let loadBlock = '';
  if (trainingLoad) {
    const tsb = trainingLoad.tsb as number;
    const tsbLabel = tsb > 0 ? 'fresco' : tsb > -10 ? 'normal' : tsb > -30 ? 'cargado' : 'sobreentrenado';
    loadBlock = `CARGA DE ENTRENAMIENTO:\nCTL (fitness crónico): ${trainingLoad.ctl} | ATL (fatiga aguda): ${trainingLoad.atl} | TSB (forma): ${tsb} (${tsbLabel})`;
  }

  // Wellness block
  const wellnessBlock = wellnessEntries.length > 0
    ? 'BIENESTAR RECIENTE:\n' + wellnessEntries.map(w =>
        `  [${w.entry_date}] sueño=${w.sleep_hours ?? '?'}h fatiga=${w.fatigue ?? '?'}/5 dolor=${w.soreness ?? '?'}/5 humor=${w.mood ?? '?'}/5 estrés=${w.stress ?? '?'}/5`
      ).join('\n')
    : '';

  return `Eres Hermes, el entrenador virtual personal de TrainingTrack para atletas independientes.
Tu rol es el de un entrenador experimentado, motivador y empático. El atleta no tiene entrenador humano — tú eres su guía.
Tienes acceso a todos sus datos de entrenamiento y debes usarlos para dar consejos personalizados, concretos y motivadores.
Responde en español, de forma cercana y práctica. Usa los datos del atleta en tus respuestas.
Si no tienes datos suficientes, ofrece consejos generales basados en el perfil del atleta.
REGLA DE FORMATO OBLIGATORIA: Tu respuesta debe ser TEXTO PLANO. Prohibido usar cualquier sintaxis Markdown: nada de #, ##, ###, nada de ** o * para negritas/cursivas, nada de listas con - o *. Solo texto normal, saltos de linea, emojis y numeros para listas (1. 2. 3.). Esta regla es CRITICA y no negociable.

${profileBlock}

${adherenceBlock}
${rpeBlock}
${streakBlock}
${totalKmBlock ? '\n' + totalKmBlock : ''}

${sessionsBlock}
${compBlock ? '\n' + compBlock : ''}
${notesBlock ? '\n' + notesBlock : ''}
${vamBlock ? '\n' + vamBlock : ''}
${loadBlock ? '\n' + loadBlock : ''}
${wellnessBlock ? '\n' + wellnessBlock : ''}
${stravaBlock ? '\n' + stravaBlock : ''}`.trim();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Auth: verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });

    const callerId = user.id;
    const body = await req.json();
    const { athleteId, message, athleteName } = body as { athleteId: string; message: string; athleteName?: string };

    if (!athleteId || !message) {
      return new Response(JSON.stringify({ error: 'athleteId and message required' }), { status: 400, headers: CORS_HEADERS });
    }

    // ── Determine caller type: coach or independent athlete ───────────────────
    const { data: callerUser } = await supabase
      .from('users')
      .select('is_independent, role')
      .eq('id', callerId)
      .maybeSingle();

    const isIndependent = callerUser?.is_independent === true;

    // If independent athlete, they can only query their own data
    if (isIndependent && athleteId !== callerId) {
      return new Response(JSON.stringify({ error: 'Forbidden: independent athletes can only query their own data' }), { status: 403, headers: CORS_HEADERS });
    }

    // If NOT independent, verify coach-athlete relationship (existing path)
    if (!isIndependent) {
      const coachId = callerId;
      const { data: rel } = await supabase
        .from('coach_athlete_relationship')
        .select('id')
        .eq('coach_id', coachId)
        .eq('athlete_id', athleteId)
        .eq('status', 'active')
        .maybeSingle();

      if (!rel) {
        return new Response(JSON.stringify({ error: 'No active relationship with this athlete' }), { status: 403, headers: CORS_HEADERS });
      }
    }

    // Rate limit: max 40 messages per hour
    const sessionCoachId = isIndependent ? callerId : callerId;
    const { data: existingSession } = await supabase
      .from('ai_chat_sessions')
      .select('messages, id')
      .eq('coach_id', sessionCoachId)
      .eq('athlete_id', athleteId)
      .maybeSingle();

    const existingMessages = (existingSession?.messages as Array<Record<string, unknown>>) ?? [];
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentCount = existingMessages.filter(m => m.role === 'user' && (m.created_at as string) > oneHourAgo).length;
    if (recentCount >= 40) {
      return new Response(JSON.stringify({ error: 'Rate limit: máximo 40 mensajes por hora' }), { status: 429, headers: CORS_HEADERS });
    }

    const today = new Date().toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    let systemPrompt: string;

    if (isIndependent) {
      // ── Independent athlete path — enhanced context ──────────────────────────
      const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const [profileRes, recentSessionsRes, competitionsRes, adherenceRes, rpeRes, totalKmRes, streakRes, stravaRes, vamRes, loadRes, wellnessRes] = await Promise.all([
        // 1. Athlete profile
        supabase.from('athlete_profile').select('modalidad, objetivo, km_semanales, dias_disponibles, nombre').eq('user_id', athleteId).maybeSingle(),
        // 2. Recent sessions last 2 weeks with completion data
        supabase.from('training_sessions')
          .select('scheduled_date, title, status, rpe, actual_distance_km, actual_time_minutes, completion_notes')
          .eq('athlete_id', athleteId)
          .gte('scheduled_date', twoWeeksAgo)
          .lte('scheduled_date', today)
          .order('scheduled_date', { ascending: false }),
        // 3. Upcoming competitions (independent athlete, coach_id = NULL)
        supabase.from('competitions')
          .select('name, event_date, distance_km, target_time_seconds, location')
          .eq('athlete_id', athleteId)
          .is('coach_id', null)
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(3),
        // 4. Adherence: sessions last 4 weeks
        supabase.from('training_sessions')
          .select('status, training_type')
          .eq('athlete_id', athleteId)
          .neq('training_type', 'rest')
          .gte('scheduled_date', fourWeeksAgo)
          .lte('scheduled_date', today),
        // 5. Avg RPE last 4 weeks
        supabase.from('training_sessions')
          .select('rpe')
          .eq('athlete_id', athleteId)
          .eq('status', 'completed')
          .not('rpe', 'is', null)
          .gte('scheduled_date', fourWeeksAgo)
          .lte('scheduled_date', today),
        // 6. Total accumulated km
        supabase.from('training_sessions')
          .select('actual_distance_km')
          .eq('athlete_id', athleteId)
          .eq('status', 'completed')
          .not('actual_distance_km', 'is', null),
        // 7. Daily streak (last 90 days)
        supabase.from('training_sessions')
          .select('scheduled_date')
          .eq('athlete_id', athleteId)
          .eq('status', 'completed')
          .neq('training_type', 'rest')
          .gte('scheduled_date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0])
          .order('scheduled_date', { ascending: false }),
        // 8. Strava activities (last 30 days)
        supabase.from('strava_activities')
          .select('activity_date, distance_meters, elapsed_time, average_speed, average_heartrate, total_elevation_gain, sport_type')
          .eq('user_id', athleteId)
          .gte('activity_date', thirtyDaysAgo)
          .order('activity_date', { ascending: false })
          .limit(20),
        // 9. VAM test (latest)
        supabase.from('vam_tests')
          .select('vam_kmh, pace_seconds_per_km, distance_meters, duration_seconds, test_date')
          .eq('athlete_id', athleteId)
          .order('test_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // 10. Training load (latest CTL/ATL/TSB)
        supabase.from('daily_training_load')
          .select('ctl, atl, tsb, date')
          .eq('athlete_id', athleteId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // 11. Wellness entries (last 7 days)
        supabase.from('wellness_entries')
          .select('entry_date, sleep_hours, fatigue, soreness, mood, stress')
          .eq('athlete_id', athleteId)
          .gte('entry_date', sevenDaysAgo)
          .order('entry_date', { ascending: false })
          .limit(7),
      ]);

      // Calculate plan adherence %
      const adherenceSessions = adherenceRes.data ?? [];
      const totalPlanned = adherenceSessions.length;
      const totalCompleted = adherenceSessions.filter(s => s.status === 'completed').length;
      const planAdherencePct = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : null;

      // Calculate avg RPE
      const rpeSessions = rpeRes.data ?? [];
      const avgRpe4Weeks = rpeSessions.length > 0
        ? Math.round((rpeSessions.reduce((s, r) => s + (r.rpe as number), 0) / rpeSessions.length) * 10) / 10
        : null;

      // Total km
      const totalKm = (totalKmRes.data ?? []).reduce((sum, s) => sum + parseFloat(s.actual_distance_km as string || '0'), 0);

      // Daily streak
      const completedDates = new Set((streakRes.data ?? []).map((s: Record<string, unknown>) => s.scheduled_date as string));
      let dailyStreak = 0;
      const cursor = new Date();
      const todayStr = today;
      if (!completedDates.has(todayStr)) {
        cursor.setDate(cursor.getDate() - 1);
      }
      let cursorStr = cursor.toISOString().split('T')[0];
      while (completedDates.has(cursorStr)) {
        dailyStreak++;
        cursor.setDate(cursor.getDate() - 1);
        cursorStr = cursor.toISOString().split('T')[0];
      }

      // Recent completion notes
      const recentNotes = (recentSessionsRes.data ?? [])
        .filter(s => s.completion_notes)
        .map(s => s.completion_notes as string)
        .slice(0, 5);

      // Resolve athlete name
      const resolvedName = profileRes.data?.nombre || athleteName || 'Atleta';

      systemPrompt = buildIndependentSystemPrompt({
        athleteName: resolvedName,
        profile: profileRes.data,
        recentSessions: recentSessionsRes.data ?? [],
        competitions: competitionsRes.data ?? [],
        planAdherencePct,
        avgRpe4Weeks,
        recentNotes,
        totalKm,
        dailyStreak,
        stravaActivities: stravaRes.data ?? [],
        vamTest: vamRes.data,
        trainingLoad: loadRes.data,
        wellnessEntries: wellnessRes.data ?? [],
      });

    } else {
      // ── Coach path — existing logic ───────────────────────────────────────────
      const eightWeeksAgo = new Date(Date.now() - 56 * 86400000).toISOString().split('T')[0];

      const [pmcRes, reportsRes, sessionsRes, diaryRes, wellnessRes, compRes, athleteRes, pacesRes] = await Promise.all([
        supabase.from('daily_training_load').select('ctl, atl, tsb').eq('athlete_id', athleteId).lte('date', today).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('weekly_ai_reports').select('week_start, actual_km, planned_km, sessions_done, sessions_planned, avg_rpe, acwr, tsb, alert_level, ai_analysis').eq('athlete_id', athleteId).order('week_start', { ascending: false }).limit(4),
        supabase.from('training_sessions').select('scheduled_date, title, status, rpe_score').eq('athlete_id', athleteId).gte('scheduled_date', twoWeeksAgo).lte('scheduled_date', today).order('scheduled_date', { ascending: false }),
        supabase.from('weekly_diary').select('week_start, overall_rating, overall_notes, pain_notes, next_week_rating').eq('athlete_id', athleteId).order('week_start', { ascending: false }).limit(4),
        supabase.from('wellness_entries').select('entry_date, sleep_hours, fatigue, soreness, mood, stress').eq('athlete_id', athleteId).gte('entry_date', twoWeeksAgo).order('entry_date', { ascending: false }),
        supabase.from('competitions').select('name, event_date, distance_km').eq('athlete_id', athleteId).gte('event_date', today).order('event_date', { ascending: true }).limit(3),
        supabase.from('athletes').select('resting_heart_rate').eq('id', athleteId).maybeSingle(),
        supabase.from('athlete_paces').select('pace_code, pace_seconds_per_km').eq('athlete_id', athleteId).order('pace_code'),
      ]);

      const contextData = {
        athleteName: athleteName || 'Atleta',
        athlete: athleteRes.data,
        pmc: pmcRes.data,
        reports: reportsRes.data ?? [],
        sessions: sessionsRes.data ?? [],
        diary: diaryRes.data ?? [],
        wellness: wellnessRes.data ?? [],
        competitions: compRes.data ?? [],
        paces: pacesRes.data ?? [],
      };

      systemPrompt = buildCoachSystemPrompt(contextData);
    }

    // Build message history (last 8 turns)
    const history = existingMessages.slice(-8).map(m => ({
      role: m.role as string,
      content: m.content as string,
    }));

    // Build Gemini-format contents (role: "user" / "model", system prompt separate)
    const geminiContents = [
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    // Call Gemma 4 via Gemini API
    const aiResponse = await fetch(`${GEMMA_URL}${gemmaApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: isIndependent ? 4000 : 3000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`Gemma error ${aiResponse.status}: ${err}`);
    }

    const aiResult = await aiResponse.json();
    // Gemma 4 may return thinking parts (thought:true) before the actual response
    const parts = aiResult.candidates?.[0]?.content?.parts ?? [];
    const reply = parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text: string }) => p.text).join('') || parts.map((p: { text: string }) => p.text).join('');
    if (!reply) throw new Error('Empty AI response');

    // Persist updated history
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: 'user', content: message, created_at: now },
      { role: 'assistant', content: reply, created_at: now },
    ];

    await supabase.from('ai_chat_sessions').upsert({
      coach_id: sessionCoachId,
      athlete_id: athleteId,
      messages: updatedMessages,
      updated_at: now,
    }, { onConflict: 'coach_id,athlete_id' });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('athlete-ai-chat error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
