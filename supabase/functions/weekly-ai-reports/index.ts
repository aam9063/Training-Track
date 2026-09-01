import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { acwrFromComponents } from '../_shared/trainingLoadCore.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const gemmaApiKey = Deno.env.get('GEMMA4_API_KEY')!;
const GEMMA_MODEL = 'gemini-2.5-flash';
const GEMMA_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=`;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-job',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RUNNING_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

// ─── Alert level helper ───────────────────────────────────────────────────────
// Severity classification (thresholds) lives exclusively in the single
// rulebook (`evaluateLoad` in `_shared/trainingLoadCore.js`) and its output,
// `training_load_alerts`. This function only maps the athlete's currently
// open alert rows to the report's 3-tier display level — it does not
// recompute any threshold itself (training-load-alerts "Single Alert
// Rulebook" requirement; replaces the removed `deriveAlertLevel`).

function alertLevelFromOpenAlerts(openAlerts: Array<{ severity: string }>): string {
  if (openAlerts.some((a) => a.severity === 'critical')) return 'critical';
  if (openAlerts.some((a) => a.severity === 'warning')) return 'attention';
  return 'ok';
}

// ─── DeepSeek call ────────────────────────────────────────────────────────────

async function callDeepSeek(
  athleteName: string,
  weekData: Record<string, unknown>,
  competitionDays: number | null
) {
  const avgRpe = weekData.avg_rpe as number | null;
  const internalLoad = weekData.internal_load as number | null;
  const sessions = weekData.session_details as Array<Record<string, unknown>> || [];
  const activities = weekData.activity_details as Array<Record<string, unknown>> || [];
  const diary = weekData.diary as Record<string, unknown> | null;

  const rpeBlock = avgRpe !== null
    ? `- RPE medio: ${avgRpe.toFixed(1)}/10 (percepcion subjetiva del esfuerzo; 1=muy facil, 10=maximo)
- Carga interna (RPExmin): ${internalLoad ?? 0} UA
- Nota: si el RPE es alto con volumen normal, puede indicar fatiga oculta, enfermedad o estres externo`
    : `- RPE medio: sin datos (el atleta no registro percepcion de esfuerzo esta semana)`;

  const openAlerts = weekData.training_load_alerts as Array<{ alert_type: string; message_es: string }> || [];
  const alertsBlock = openAlerts.length > 0
    ? openAlerts.map((a) => `- [${a.alert_type}] ${a.message_es}`).join('\n')
    : '- Sin alertas activas del sistema de monitorizacion de carga';

  // Build detailed session list for prompt
  const sessionLines = sessions.length > 0
    ? sessions.map((s: Record<string, unknown>, i: number) => {
        const desc = s.description && s.description !== s.title ? ` | Detalle: ${(s.description as string).replace(/\n/g, '; ')}` : '';
        return `  ${i + 1}. [${s.scheduled_date}] "${s.title}"${desc} — Estado: ${s.status}${s.rpe_score ? `, RPE: ${s.rpe_score}/10` : ''}${s.strava_activity_id ? ' (vinculada a Strava)' : ''}${s.estimated_duration_minutes ? `, Duracion estimada: ${s.estimated_duration_minutes}min` : ''}`;
      }).join('\n')
    : '  (ninguna sesion planificada esta semana)';

  // Build detailed activity list for prompt
  const activityLines = activities.length > 0
    ? activities.map((a: Record<string, unknown>, i: number) => {
        const distKm = ((a.distance as number) / 1000).toFixed(1);
        const mins = Math.round((a.moving_time as number) / 60);
        const paceSecPerKm = (a.moving_time as number) / ((a.distance as number) / 1000);
        const paceMin = Math.floor(paceSecPerKm / 60);
        const paceSec = Math.round(paceSecPerKm % 60);
        return `  ${i + 1}. [${(a.start_date_local as string).split('T')[0]}] ${a.type} — ${distKm}km en ${mins}min (${paceMin}:${String(paceSec).padStart(2, '0')}/km)${a.average_heartrate ? ` FC med: ${a.average_heartrate}bpm` : ''}${a.total_elevation_gain ? ` D+: ${a.total_elevation_gain}m` : ''}`;
      }).join('\n')
    : '  (sin actividades Strava esta semana)';

  const prompt = `Eres un entrenador de running de elite analizando los datos semanales de un atleta. Responde SOLO con JSON valido sin markdown.

Atleta: ${athleteName}
Semana: ${weekData.week_start} a ${weekData.week_end}

SESIONES PLANIFICADAS POR EL ENTRENADOR:
${sessionLines}
Total: ${weekData.sessions_done}/${weekData.sessions_planned} completadas

ACTIVIDADES REGISTRADAS EN STRAVA:
${activityLines}
Total running: ${weekData.actual_km} km

Km planificados (del plan de periodizacion): ${weekData.planned_km} km

METRICAS DE CARGA:
- ACWR: ${weekData.acwr ?? 'no disponible'} (zona segura: 0.8-1.3; >1.5 = riesgo lesion)
- TSB: ${weekData.tsb ?? 'no disponible'} (positivo = fresco, negativo = cargado; <-30 = sobrecarga)
${weekData.restingHR ? `- FC reposo: ${weekData.restingHR} bpm` : ''}

ALERTAS ACTIVAS (sistema de monitorizacion de carga):
${alertsBlock}

CARGA PERCIBIDA:
${rpeBlock}

DIARIO DEL ATLETA (autovaloracion del domingo):
${diary
  ? `- Sensacion general semana: ${diary.overall_rating}/5${diary.overall_notes ? ` — "${diary.overall_notes}"` : ''}
- Molestias fisicas: ${diary.pain_notes ? `"${diary.pain_notes}"` : 'ninguna reportada'}
- Confianza para proxima semana: ${diary.next_week_rating}/5${diary.next_week_notes ? ` — "${diary.next_week_notes}"` : ''}`
  : '- El atleta no relleno el diario esta semana'}
${
  competitionDays !== null
    ? `\nCOMPETICION PROXIMA: ${weekData.nextCompetitionName ?? ''} en ${competitionDays} dias`
    : ''
}

INSTRUCCIONES DE ANALISIS:
1. Compara las sesiones planificadas con las actividades Strava para evaluar adherencia al plan
2. Si hay actividades Strava que no coinciden con sesiones planificadas, senala el volumen no planificado
3. Si hay sesiones planificadas sin completar y sin actividad Strava ese dia, senala el incumplimiento
4. El RPE es clave para detectar fatiga oculta — analiza coherencia entre datos objetivos y subjetivos
5. Da recomendaciones ESPECIFICAS con numeros concretos (km, ritmos, dias)
6. Si hay diario del atleta: cruza la sensacion subjetiva (ratings 1-5) con los datos objetivos (ACWR, RPE). Si hay discordancia (datos buenos pero atleta se siente mal, o viceversa), señalalo explicitamente.
7. Si el atleta reporta molestias fisicas concretas, incluyelas en las alertas aunque los datos objetivos sean normales.

IMPORTANTE — INTERPRETACION DE KM PLANIFICADOS VS REALES:
Los km planificados se parsean del texto del plan y a menudo solo incluyen la parte de calidad. Ten en cuenta el tipo de sesion al comparar:
- Sesiones de SERIES (titulo con patron NxDistancia como "5x1000m", "20x400m", "10x200m"): los km planificados solo cuentan las repeticiones. La sesion real incluye calentamiento (2-4km) y vuelta a calma (1-2km). Es NORMAL que los km reales superen los planificados en un 30-60%. NO penalices esta diferencia.
- Sesiones con calentamiento explicito (titulo incluye "R1", "RR", "Mov" antes de las series, ej: "4k R1 + 5x1000m + 2k RR"): los km planificados ya incluyen todo. La comparacion directa es valida.
- Rodajes continuos (titulo como "14km R2", "30km RR", "Rodaje 8km"): la comparacion directa km planificados vs reales es valida. Desviaciones de ±10% son normales.
- Si los km totales planificados de la semana son significativamente menores que los reales, antes de alertar por sobrecarga comprueba si la diferencia se explica por calentamientos y vueltas a calma no contabilizados en sesiones de series.

Genera un analisis con este JSON exacto:
{
  "resumen": "3-4 frases de sintesis que mencionen: sesiones completadas vs planificadas, km ejecutados vs planificados, estado de carga (ACWR/TSB), y RPE si hay datos. Incluye nombres de las sesiones clave realizadas.",
  "nivel_alerta": "critical|attention|ok",
  "alertas": [
    {
      "tipo": "nombre corto de la alerta",
      "nivel": "critical|attention|ok",
      "descripcion": "explicacion concisa de 1-2 frases"
    }
  ],
  "comparativa": {
    "km_ejecutado": ${weekData.actual_km},
    "km_planificado": ${weekData.planned_km},
    "sesiones_ejecutadas": ${weekData.sessions_done},
    "sesiones_planificadas": ${weekData.sessions_planned},
    "tiempo_ejecutado_min": ${weekData.actual_time_min ?? 0},
    "tiempo_planificado_min": ${weekData.planned_time_min ?? 0},
    "rpe_medio": ${avgRpe ?? 'null'},
    "carga_interna": ${internalLoad ?? 'null'}
  },
  "recomendaciones": [
    "recomendacion especifica 1 con numeros concretos",
    "recomendacion especifica 2",
    "recomendacion especifica 3",
    "recomendacion especifica 4"
  ],
  "prediccion_competicion": ${
    competitionDays !== null && competitionDays <= 60
      ? `{
    "nombre": "${weekData.nextCompetitionName ?? 'Proxima competicion'}",
    "dias": ${competitionDays},
    "estado_forma": "descripcion del estado de forma actual y proyeccion basada en los datos de la semana",
    "puntuacion_preparacion": 70,
    "listo_para_competir": true
  }`
      : 'null'
  }
}`;

  const response = await fetch(`${GEMMA_URL}${gemmaApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt + '\n\nResponde SOLO con JSON válido, sin markdown ni explicaciones.' }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemma error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const content = parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text: string }) => p.text).join('') || parts.map((p: { text: string }) => p.text).join('');
  if (!content) throw new Error('Empty Gemma response');
  return JSON.parse(content);
}

// ─── Process one athlete ──────────────────────────────────────────────────────

async function processAthlete(
  coachId: string,
  athleteId: string,
  athleteName: string,
  weekStart: string,
  weekEnd: string
) {
  // All queries are independent — run them in parallel
  const today = new Date().toISOString().split('T')[0];

  const [sessionsRes, activitiesRes, pmcRes, alertsRes, microRes, athleteRes, compRes, diaryRes] = await Promise.all([
    // 1. Sessions
    supabase
      .from('training_sessions')
      .select('id, scheduled_date, status, title, description, estimated_duration_minutes, rpe_score, strava_activity_id')
      .eq('athlete_id', athleteId)
      .eq('coach_id', coachId)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd),
    // 2. Strava activities (week)
    supabase
      .from('strava_activities')
      .select('distance, moving_time, type, start_date_local, average_heartrate, total_elevation_gain, name')
      .eq('athlete_id', athleteId)
      .gte('start_date_local', weekStart)
      .lte('start_date_local', weekEnd + 'T23:59:59'),
    // 3. PMC — reads atl/chronic_load_28 (canonical ACWR components, D1),
    //    NOT a raw 28-day Strava activity re-derivation. daily_training_load
    //    has no plain `acwr` column, so acwrFromComponents() (single
    //    rulebook-adjacent formula, _shared/trainingLoadCore.js) derives it.
    supabase
      .from('daily_training_load')
      .select('ctl, atl, tsb, chronic_load_28')
      .eq('athlete_id', athleteId)
      .lte('date', weekEnd)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // 4. Open training_load_alerts (all 4 alert_types) — replaces the
    //    removed inline deriveAlertLevel() threshold logic; the single
    //    rulebook (training-load-monitor) is the only alert producer.
    supabase
      .from('training_load_alerts')
      .select('alert_type, severity, message_es, metrics')
      .eq('athlete_id', athleteId)
      .eq('status', 'open'),
    // 5. Planned km
    supabase.rpc('get_athlete_planned_km', {
      p_athlete_id: athleteId,
      p_week_start: weekStart,
      p_week_end: weekEnd,
    }),
    // 6. Athlete resting HR
    supabase
      .from('athletes')
      .select('resting_heart_rate')
      .eq('id', athleteId)
      .maybeSingle(),
    // 7. Next competition
    supabase
      .from('competitions')
      .select('name, event_date')
      .eq('athlete_id', athleteId)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // 8. Weekly diary (athlete self-reported feelings from Sunday)
    supabase
      .from('weekly_diary')
      .select('overall_rating, overall_notes, pain_notes, next_week_rating, next_week_notes')
      .eq('athlete_id', athleteId)
      .eq('week_start', weekStart)
      .maybeSingle(),
  ]);

  // Process sessions
  const allSessions = sessionsRes.data ?? [];
  const sessionsPlanned = allSessions.length;
  const completedSessions = allSessions.filter(s => s.status === 'completed');
  const sessionsDone = completedSessions.length;
  const plannedTimeMin = allSessions.reduce((s, sess) => s + (sess.estimated_duration_minutes ?? 0), 0);
  const actualTimeMin = completedSessions.reduce((s, sess) => s + (sess.estimated_duration_minutes ?? 0), 0);

  const sessionsWithRpe = completedSessions.filter(s => s.rpe_score != null && s.rpe_score > 0);
  const avgRpe = sessionsWithRpe.length > 0
    ? +(sessionsWithRpe.reduce((sum, s) => sum + s.rpe_score, 0) / sessionsWithRpe.length).toFixed(2)
    : null;
  const internalLoad = sessionsWithRpe.length > 0
    ? +(sessionsWithRpe.reduce((sum, s) => sum + s.rpe_score * (s.estimated_duration_minutes ?? 30), 0)).toFixed(1)
    : null;

  // Process activities
  const activities = activitiesRes.data;
  const runActivities = (activities ?? []).filter(a => RUNNING_TYPES.includes(a.type));
  const actualKm = +(runActivities.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000).toFixed(1);
  const actualTimeFromStrava = Math.round(runActivities.reduce((s, a) => s + (a.moving_time ?? 0), 0) / 60);

  // PMC — tsb + acwr both derive from the same stored daily_training_load
  // row, the single source of truth (D1/D3). acwrFromComponents() is the
  // one implementation of the ratio; no re-derivation from raw activities.
  const tsb = pmcRes.data?.tsb ?? null;
  const acwr = acwrFromComponents(pmcRes.data?.atl, pmcRes.data?.chronic_load_28);

  // Open training_load_alerts for this athlete (all 4 alert_types) —
  // the single alert rulebook's output, not recomputed here.
  const openAlerts = alertsRes.data ?? [];

  // Planned km
  let plannedKm = 0;
  const microRows = microRes.data;
  if (microRows && microRows.length > 0 && microRows[0].planned_km) {
    plannedKm = +microRows[0].planned_km;
  }

  // Athlete & competition
  const athleteRow = athleteRes.data;
  const nextComp = compRes.data;

  const competitionDays = nextComp
    ? Math.ceil((new Date(nextComp.event_date).getTime() - Date.now()) / 86400000)
    : null;

  const alertLevel = alertLevelFromOpenAlerts(openAlerts);

  // Build detailed data for the prompt
  const sessionDetails = allSessions.map(s => ({
    scheduled_date: s.scheduled_date,
    title: s.title,
    description: s.description,
    status: s.status,
    rpe_score: s.rpe_score,
    strava_activity_id: s.strava_activity_id,
    estimated_duration_minutes: s.estimated_duration_minutes,
  }));

  const activityDetails = (activities ?? []).map(a => ({
    start_date_local: a.start_date_local,
    type: a.type,
    distance: a.distance,
    moving_time: a.moving_time,
    average_heartrate: a.average_heartrate,
    total_elevation_gain: a.total_elevation_gain,
  }));

  const diary = diaryRes.data ?? null;

  const weekData = {
    week_start: weekStart,
    week_end: weekEnd,
    diary,
    sessions_planned: sessionsPlanned,
    sessions_done: sessionsDone,
    actual_km: actualKm,
    planned_km: plannedKm,
    actual_time_min: actualTimeFromStrava > 0 ? actualTimeFromStrava : actualTimeMin,
    planned_time_min: plannedTimeMin,
    acwr,
    tsb,
    avg_rpe: avgRpe,
    internal_load: internalLoad,
    rpe_sessions_count: sessionsWithRpe.length,
    restingHR: athleteRow?.resting_heart_rate ?? null,
    nextCompetitionName: nextComp?.name ?? null,
    session_details: sessionDetails,
    activity_details: activityDetails,
    training_load_alerts: openAlerts,
  };

  const { data: reportRow, error: insertErr } = await supabase
    .from('weekly_ai_reports')
    .upsert({
      coach_id: coachId,
      athlete_id: athleteId,
      week_start: weekStart,
      week_end: weekEnd,
      alert_level: alertLevel,
      sessions_planned: sessionsPlanned,
      sessions_done: sessionsDone,
      planned_km: plannedKm,
      actual_km: actualKm,
      acwr,
      tsb,
      avg_rpe: avgRpe,
      internal_load: internalLoad,
      status: 'generating',
      report_data: weekData,
    }, { onConflict: 'athlete_id,week_start', ignoreDuplicates: false })
    .select('id')
    .single();

  if (insertErr) throw insertErr;
  const reportId = reportRow.id;

  let aiAnalysis: Record<string, unknown> | null = null;
  let finalAlertLevel = alertLevel;
  try {
    aiAnalysis = await callDeepSeek(athleteName, weekData, competitionDays);
    if (aiAnalysis?.nivel_alerta && ['critical', 'attention', 'ok'].includes(aiAnalysis.nivel_alerta as string)) {
      finalAlertLevel = aiAnalysis.nivel_alerta as string;
    }
  } catch (err) {
    console.error(`DeepSeek error for athlete ${athleteId}:`, err);
  }

  const summary = aiAnalysis?.resumen as string
    ?? `${sessionsDone}/${sessionsPlanned} sesiones completadas. ${actualKm}km ejecutados (${plannedKm}km planificados). ACWR: ${acwr ?? 'N/A'}.${avgRpe !== null ? ` RPE medio: ${avgRpe}.` : ''}`;

  await supabase
    .from('weekly_ai_reports')
    .update({
      alert_level: finalAlertLevel,
      summary,
      ai_analysis: aiAnalysis,
      status: aiAnalysis ? 'completed' : 'error',
      error_message: aiAnalysis ? null : 'DeepSeek generation failed',
    })
    .eq('id', reportId);

  return { reportId, alertLevel: finalAlertLevel, athleteName };
}

// ─── Send push to coach ───────────────────────────────────────────────────────

async function notifyCoach(coachId: string, criticalCount: number, attentionCount: number) {
  const total = criticalCount + attentionCount;
  if (total === 0) return;
  const title = 'Informes semanales listos';
  const body = criticalCount > 0
    ? `${criticalCount} atleta${criticalCount > 1 ? 's' : ''} requiere${criticalCount > 1 ? 'n' : ''} atencion urgente`
    : `${attentionCount} atleta${attentionCount > 1 ? 's' : ''} con alertas moderadas`;

  try {
    await supabase.rpc('send_push_notification', {
      p_user_ids: [coachId], p_title: title, p_body: body,
      p_url: '/dashboard/ai-reports', p_tag: 'tt-weekly-report',
    });
  } catch { /* push may not be configured */ }

  await supabase.from('notifications').insert({
    user_id: coachId, title, body, url: '/dashboard/ai-reports', type: 'ai_report',
  }).catch(() => {});
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const isCron = req.headers.get('x-supabase-cron-job') === 'true';
  const authHeader = req.headers.get('Authorization');

  if (!isCron && authHeader !== `Bearer ${serviceRoleKey}`) {
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  let weekStart: string;
  let weekEnd: string;
  let targetCoachId: string | null = null;

  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.week_start) weekStart = body.week_start;
      if (body.week_end) weekEnd = body.week_end;
      if (body.coach_id) targetCoachId = body.coach_id;
    }
  } catch { /* ignore */ }

  if (!weekStart!) {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7) - 7);
    lastMonday.setUTCHours(0, 0, 0, 0);
    weekStart = lastMonday.toISOString().split('T')[0];
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
    weekEnd = lastSunday.toISOString().split('T')[0];
  }

  let query = supabase
    .from('coach_athlete_relationship')
    .select('coach_id, athlete_id, athletes!athlete_id(users!id(first_name, last_name))')
    .eq('status', 'active');

  if (targetCoachId) query = query.eq('coach_id', targetCoachId);

  const { data: relationships, error: relErr } = await query;
  if (relErr) {
    return new Response(JSON.stringify({ error: relErr.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const coachSummary: Record<string, { critical: number; attention: number }> = {};

  // Process all athletes in parallel (batches of 5 to avoid overwhelming DeepSeek)
  const BATCH_SIZE = 5;
  const rels = relationships ?? [];
  const results: Array<{ coachId: string; athleteId: string; alertLevel: string; success: boolean }> = [];

  for (let i = 0; i < rels.length; i += BATCH_SIZE) {
    const batch = rels.slice(i, i + BATCH_SIZE);
    const promises = batch.map(rel => {
      const athlete = rel.athletes as { users?: { first_name?: string; last_name?: string } } | null;
      const firstName = athlete?.users?.first_name ?? '';
      const lastName = athlete?.users?.last_name ?? '';
      const athleteName = `${firstName} ${lastName}`.trim() || 'Atleta';
      return processAthlete(rel.coach_id, rel.athlete_id, athleteName, weekStart, weekEnd)
        .then(result => ({ coachId: rel.coach_id, athleteId: rel.athlete_id, alertLevel: result.alertLevel, success: true }))
        .catch(err => {
          console.error(`Error processing athlete ${rel.athlete_id}:`, err);
          return { coachId: rel.coach_id, athleteId: rel.athlete_id, alertLevel: 'ok', success: false };
        });
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      results.push(r);
      if (!coachSummary[r.coachId]) coachSummary[r.coachId] = { critical: 0, attention: 0 };
      if (r.alertLevel === 'critical') coachSummary[r.coachId].critical++;
      else if (r.alertLevel === 'attention') coachSummary[r.coachId].attention++;
    }
  }

  for (const [coachId, counts] of Object.entries(coachSummary)) {
    try { await notifyCoach(coachId, counts.critical, counts.attention); }
    catch (err) { console.error(`Push notification error for coach ${coachId}:`, err); }
  }

  return new Response(JSON.stringify({
    ok: true, week_start: weekStart, week_end: weekEnd,
    processed: results.length, results,
  }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
