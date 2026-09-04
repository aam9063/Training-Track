import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { acwrFromComponents } from '../_shared/trainingLoadCore.js';
import { alertLevelFromOpenAlerts, higherTier, buildNarrowWeekData } from './logic.js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const gemmaApiKey = Deno.env.get('GEMMA4_API_KEY')!;
const GEMMA_MODEL = 'gemini-2.5-flash';
const GEMMA_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=`;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Kill switches (communication-agent D7). Note the deliberately asymmetric
// idioms — each matches the house pattern for its default:
//   default-true  → `!== 'false'`  (training-load-monitor's ALERTS_ENABLED)
//   default-false → `=== 'true'`   (engagement-monitor's ALERTS_ENABLED)
const WIDE_CONTEXT_ENABLED =
  (Deno.env.get('WEEKLY_REPORT_WIDE_CONTEXT_ENABLED') ?? 'true').toLowerCase() !== 'false';
const REACTIVE_ENABLED =
  (Deno.env.get('WEEKLY_REPORT_REACTIVE_ENABLED') ?? 'false').toLowerCase() === 'true';

// Lookback for "recently decided" plan adjustments. 28 days deliberately
// matches chronic_load_28, the window this report already reasons over —
// the narrative window and the physiology window are the same window.
const PLAN_ADJUSTMENT_LOOKBACK_DAYS = 28;
const PLAN_ADJUSTMENT_MAX_ROWS = 10;

// Europe/Madrid local date. New code only — the existing last-week block at
// the bottom of the handler stays on UTC, unchanged (see design.md).
function todayLocalStr(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
}

// Pure UTC-anchored math on an already-resolved 'YYYY-MM-DD' string — not the
// ambient-clock anti-pattern (same shape as engagement-monitor's addDaysISO).
function isoWeekStartLocal(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(fromStr: string, toStr: string): number {
  return Math.round(
    (new Date(`${toStr}T00:00:00Z`).getTime() - new Date(`${fromStr}T00:00:00Z`).getTime()) / 86400000
  );
}

function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try { console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload })); } catch { /* no-op */ }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-cron-job',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RUNNING_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

// ─── Alert level helper ───────────────────────────────────────────────────────
// Severity classification (thresholds) lives exclusively in each source's own
// rulebook: `evaluateLoad` in `_shared/trainingLoadCore.js` for
// `training_load_alerts`, the adherence-detection agent's `engagementCore.js`
// for `athlete_engagement_alerts`, and the planning agent's rules for
// `plan_adjustment_suggestions`. `alertLevelFromOpenAlerts` (now in
// `./logic.js`, communication-agent) only maps the athlete's currently open
// findings across all three sources to the report's 3-tier display level —
// it does not recompute any threshold itself (training-load-alerts "Single
// Alert Rulebook" requirement; replaces the removed `deriveAlertLevel`).
// Mapping: engagement `danger` -> `critical`, `warning` -> `attention`
// (normalizeEngagementSeverity, mirroring alertFeedService.mapEngagementAlert
// client-side); a `pending` plan-adjustment suggestion -> `attention` (an
// outstanding coach decision, downstream of a load alert already counted);
// every decided suggestion status contributes nothing (narrative only).

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

  // ─── Wide-context additions (communication-agent) ──────────────────────────
  // Each interpolation below evaluates to '' when weekData.wide_context is
  // falsy, so the assembled prompt string is byte-identical to today's when
  // WIDE_CONTEXT_ENABLED=false.
  const engagementAlerts = weekData.engagement_alerts as Array<Record<string, unknown>> || [];
  const planAdjustments = weekData.plan_adjustments as Array<Record<string, unknown>> || [];

  const engagementBlock = engagementAlerts.length > 0
    ? engagementAlerts.map((a) => {
        const m = (a.metrics ?? {}) as Record<string, unknown>;
        const variante = m.variant === 'never_started'
          ? 'nunca llego a empezar'
          : `ultima senal de vida: ${m.lastSignalAt ?? 'desconocida'} (${m.lastSignalSource ?? 'sin fuente'})`;
        return `- [${a.severity}] ${a.message_es} — ${a.silence_days} dias sin senal de vida; ${variante}; sesiones planificadas en la ventana: ${m.plannedInWindow ?? 0}`;
      }).join('\n')
    : '- Sin alertas de inactividad: el atleta ha dado senales de vida recientemente';

  const planBlock = planAdjustments.length > 0
    ? planAdjustments.map((p) => {
        const decidido = p.decided_at
          ? `decidido el ${(p.decided_at as string).slice(0, 10)}`
          : 'PENDIENTE de decision del entrenador';
        return `- [${p.status}] ${p.patch_type} (origen: ${p.finding_source}; propuesto el ${(p.created_at as string).slice(0, 10)}; ${decidido}): ${p.message_es}`;
      }).join('\n')
    : '- Ningun ajuste de plan propuesto ni decidido en los ultimos 28 dias';

  const partialWeekNote = weekData.week_partial
    ? `\nATENCION — SEMANA EN CURSO: este informe se genera a mitad de semana, no al cerrarla. Cubre solo del ${weekData.week_start} al ${weekData.week_end} (${weekData.week_elapsed_days} de 7 dias). Las sesiones y los km planificados listados son SOLO los de esos dias transcurridos: NO interpretes el total semanal como incumplido ni proyectes la adherencia de la semana completa a partir de esta muestra parcial.`
    : '';

  const wideContextBlocks = weekData.wide_context
    ? `
SENALES DE ADHERENCIA (agente de deteccion de inactividad; vocabulario: severidad 'danger' equivale a 'critical' en este informe, 'warning' equivale a 'attention'):
${engagementBlock}

AJUSTES DE PLAN PROPUESTOS POR EL SISTEMA (ultimos 28 dias):
${planBlock}${partialWeekNote}`
    : '';

  const crossAgentInstructions = weekData.wide_context
    ? `
8. SINTESIS CRUZADA (obligatoria): las ALERTAS ACTIVAS de carga, las SENALES DE ADHERENCIA y los AJUSTES DE PLAN son tres vistas del MISMO atleta en el MISMO periodo, no tres temas. Cuando haya senales en dos o mas de esas fuentes, el "resumen" debe explicarlas como UNA sola cadena causal — que ocurrio primero, que provoco que, y que decision sigue pendiente — y no como una lista de tres observaciones independientes. Si dos fuentes se contradicen, di explicitamente cual y por que. Si solo hay senales de una fuente, no inventes conexiones con las demas.
9. "nivel_alerta" NUNCA puede ser menos grave que la fuente mas grave listada arriba: una alerta de carga 'critical' o una de adherencia 'danger' obligan a "critical"; cualquier 'warning', o un ajuste de plan PENDIENTE, obligan como minimo a "attention". Puedes subir el nivel si el resto de los datos lo justifica; nunca bajarlo.`
    : '';

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
}${wideContextBlocks}

INSTRUCCIONES DE ANALISIS:
1. Compara las sesiones planificadas con las actividades Strava para evaluar adherencia al plan
2. Si hay actividades Strava que no coinciden con sesiones planificadas, senala el volumen no planificado
3. Si hay sesiones planificadas sin completar y sin actividad Strava ese dia, senala el incumplimiento
4. El RPE es clave para detectar fatiga oculta — analiza coherencia entre datos objetivos y subjetivos
5. Da recomendaciones ESPECIFICAS con numeros concretos (km, ritmos, dias)
6. Si hay diario del atleta: cruza la sensacion subjetiva (ratings 1-5) con los datos objetivos (ACWR, RPE). Si hay discordancia (datos buenos pero atleta se siente mal, o viceversa), señalalo explicitamente.
7. Si el atleta reporta molestias fisicas concretas, incluyelas en las alertas aunque los datos objetivos sean normales.${crossAgentInstructions}

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
  weekEnd: string,
  mode: 'sweep' | 'athlete' = 'sweep',
) {
  // D4 — at most one reactive Gemini call per athlete per week.
  //
  // This MUST run before the Promise.all/upsert further down. Two reasons,
  // both hard:
  //   1. The upsert sets status='generating', so any check made after it can
  //      never observe the pre-existing 'completed' status.
  //   2. Upserting first and skipping second would leave a previously
  //      COMPLETED report stranded at status='generating' with its summary
  //      intact but its status lying, until the next Monday digest repaired
  //      it.
  //
  // status 'error' or 'generating' deliberately fall through to a
  // regenerate: a failed report deserves the retry, and a 'generating' row
  // means a concurrent run whose worst case is one duplicated Gemini call
  // landing on the same upsert key.
  if (mode === 'athlete') {
    const { data: existing } = await supabase
      .from('weekly_ai_reports')
      .select('id, status, alert_level')
      .eq('athlete_id', athleteId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (existing?.status === 'completed') {
      logEvent('weekly_ai_reports.reactive_skipped', {
        athlete_id: athleteId, week_start: weekStart, reason: 'already_reported_this_week',
      });
      return {
        reportId: existing.id,
        alertLevel: existing.alert_level ?? 'ok',
        athleteName,
        skipped: 'already_reported_this_week',
      };
    }
  }

  // All queries are independent — run them in parallel
  const today = new Date().toISOString().split('T')[0];

  const planAdjustmentSince = `${(() => {
    const d = new Date(`${weekEnd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - PLAN_ADJUSTMENT_LOOKBACK_DAYS);
    return d.toISOString().slice(0, 10);
  })()}T00:00:00Z`;

  const [
    sessionsRes, activitiesRes, pmcRes, alertsRes, microRes, athleteRes, compRes, diaryRes,
    engagementRes, planAdjRes,
  ] = await Promise.all([
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
    // 9. Open engagement alerts (Agent 2). Coach-facing churn risk; severity is
    //    CHECK'd to ('warning','danger') and normalized to this report's tiers
    //    in logic.js. metrics carries {variant, lastSignalAt, lastSignalSource,
    //    plannedInWindow} — there is no `zone` key here.
    WIDE_CONTEXT_ENABLED
      ? supabase
          .from('athlete_engagement_alerts')
          .select('alert_type, severity, silence_days, message_es, metrics, metric_date')
          .eq('athlete_id', athleteId)
          .eq('status', 'open')
      : Promise.resolve({ data: [], error: null }),
    // 10. Plan adjustments (Agent 3): every pending row regardless of age (the
    //     partial unique index caps that at one per athlete) plus anything
    //     created in the last 28 days, whatever its status — a rejected deload
    //     from two weeks ago is the causal context the narrative needs.
    WIDE_CONTEXT_ENABLED
      ? supabase
          .from('plan_adjustment_suggestions')
          .select('finding_source, patch_type, status, message_es, metrics, earliest_target_date, created_at, decided_at')
          .eq('athlete_id', athleteId)
          .or(`status.eq.pending,created_at.gte.${planAdjustmentSince}`)
          .order('created_at', { ascending: false })
          .limit(PLAN_ADJUSTMENT_MAX_ROWS)
      : Promise.resolve({ data: [], error: null }),
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
  const engagementAlerts = engagementRes.data ?? [];
  const planAdjustments = planAdjRes.data ?? [];

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

  const alertLevel = alertLevelFromOpenAlerts(openAlerts, engagementAlerts, planAdjustments);

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
    engagement_alerts: engagementAlerts,
    plan_adjustments: planAdjustments,
    wide_context: WIDE_CONTEXT_ENABLED,
    week_partial: mode === 'athlete',
    week_elapsed_days: mode === 'athlete' ? daysBetweenISO(weekStart, weekEnd) + 1 : 7,
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
    const modelLevel = aiAnalysis?.nivel_alerta as string | undefined;
    if (modelLevel && ['critical', 'attention', 'ok'].includes(modelLevel)) {
      // With wide context on, the rulebooks' output is a FLOOR the model may
      // raise (on evidence only it can see, e.g. diary pain_notes) but never
      // lower. With it off, today's exact "model wins" semantics are
      // preserved, byte-for-byte.
      finalAlertLevel = WIDE_CONTEXT_ENABLED ? higherTier(alertLevel, modelLevel) : modelLevel;
    }
  } catch (err) {
    console.error(`DeepSeek error for athlete ${athleteId}:`, err);
  }

  // D8 (amended post-Phase-5) — athlete-safe analysis. weekly_ai_reports has
  // a pre-existing RLS SELECT policy letting an athlete read their own row
  // (src/pages/athlete/MyReports.jsx does exactly this), so the wide-context
  // `aiAnalysis` above — which can carry Agent 2/Agent 3 coach-facing
  // synthesis — must never be the only stored analysis. The fix is a SECOND,
  // independent Gemini call whose weekData never included engagement/plan-
  // adjustment data at all (buildNarrowWeekData), not a prompt instruction
  // or a redaction of the wide output above. The security boundary is what
  // was sent to the model, never what it was told to omit.
  //
  // When WIDE_CONTEXT_ENABLED=false, aiAnalysis itself is already narrow
  // (no second call needed — nothing to duplicate); ai_analysis_athlete_safe
  // stays null and MyReports.jsx falls back to ai_analysis in that case.
  //
  // This call's own failure MUST NOT affect the primary (coach-facing)
  // report already computed above — independent try/catch, log only.
  let aiAnalysisAthleteSafe: Record<string, unknown> | null = null;
  if (WIDE_CONTEXT_ENABLED) {
    try {
      aiAnalysisAthleteSafe = await callDeepSeek(athleteName, buildNarrowWeekData(weekData), competitionDays);
    } catch (err) {
      console.error(`DeepSeek athlete-safe error for athlete ${athleteId}:`, err);
    }
  }

  const summary = aiAnalysis?.resumen as string
    ?? `${sessionsDone}/${sessionsPlanned} sesiones completadas. ${actualKm}km ejecutados (${plannedKm}km planificados). ACWR: ${acwr ?? 'N/A'}.${avgRpe !== null ? ` RPE medio: ${avgRpe}.` : ''}`;

  // D9 (Phase 7) — the narrow athlete-safe call's own `.resumen` IS the
  // athlete-safe summary text: no third Gemini call, just persisting a
  // field that call's response already contains. Mirrors `summary`'s own
  // extraction one line above; not promoted to a logic.js pure function
  // since it is a one-line field read, not decision logic. Stays null when
  // WIDE_CONTEXT_ENABLED=false (no second call made) or when the athlete-
  // safe call itself failed independently above.
  const summaryAthleteSafe = (aiAnalysisAthleteSafe?.resumen as string) ?? null;

  await supabase
    .from('weekly_ai_reports')
    .update({
      alert_level: finalAlertLevel,
      summary,
      ai_analysis: aiAnalysis,
      ai_analysis_athlete_safe: aiAnalysisAthleteSafe,
      summary_athlete_safe: summaryAthleteSafe,
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
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  let jwtUserId: string | null = null;

  if (!isCron && !isServiceRole) {
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
    jwtUserId = user.id;
  }

  const isTrusted = isCron || isServiceRole;

  let weekStart: string;
  let weekEnd: string;
  let targetCoachId: string | null = null;
  let mode: 'sweep' | 'athlete' = 'sweep';
  let targetAthleteId: string | null = null;
  let alertId: string | null = null;

  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.week_start) weekStart = body.week_start;
      if (body.week_end) weekEnd = body.week_end;
      if (body.coach_id) targetCoachId = body.coach_id;
      if (body.mode !== undefined) {
        // Explicit validation, NOT `mode = body.mode ?? 'sweep'`: a typo'd
        // {mode:'athelete'} must not silently degrade into a full-roster
        // sweep. Mirrors engagement-monitor's own {error:'invalid mode'}.
        if (body.mode !== 'sweep' && body.mode !== 'athlete') {
          return new Response(JSON.stringify({ error: 'invalid mode' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        mode = body.mode;
      }
      if (body.athlete_id) targetAthleteId = body.athlete_id;
      if (body.alert_id) alertId = body.alert_id;
    }
  } catch { /* ignore */ }

  if (mode === 'athlete' && !targetAthleteId) {
    return new Response(JSON.stringify({ error: 'athlete_id required for mode:athlete' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // D5 — narrow authorization tightening. Nothing else about auth changes:
  // the three accepted credentials (cron header, service-role Bearer, user
  // JWT) are unchanged; only what a user JWT is permitted to ASK FOR is
  // narrowed.
  if (!isTrusted) {
    // (a) mode:'athlete' is a server-to-server path only. Its cost guard is
    //     per-athlete-per-week, so exposing it to user JWTs would let a
    //     caller walk a roster one athlete at a time and defeat that bound.
    if (mode === 'athlete') {
      logEvent('weekly_ai_reports.forbidden', { reason: 'athlete_mode_requires_service_role', user_id: jwtUserId });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    // (b) A user JWT may only sweep its OWN roster. coach_id is REQUIRED
    //     here, not merely matched: omitting it leaves the relationship
    //     query unfiltered and sweeps every coach's roster through Gemini —
    //     the worst case of the hole this closes. triggerWeeklyReports
    //     always sends it.
    if (!targetCoachId || targetCoachId !== jwtUserId) {
      logEvent('weekly_ai_reports.forbidden', { reason: 'coach_id_mismatch', user_id: jwtUserId, requested: targetCoachId });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // D7 — the reactive kill switch, evaluated before any read or Gemini call.
  // While disabled this branch is the mandated dry-run instrument: every
  // would-have-fired reactive run is logged and counted at zero cost.
  if (mode === 'athlete' && !REACTIVE_ENABLED) {
    logEvent('weekly_ai_reports.reactive_disabled_noop', { athlete_id: targetAthleteId, coach_id: targetCoachId, alert_id: alertId });
    return new Response(JSON.stringify({ ok: true, mode: 'athlete', skipped: 'reactive_disabled' }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (mode === 'athlete') {
    // CURRENT, in-progress week in Europe/Madrid — deliberately NOT the
    // sweep default's completed-last-week window, and deliberately NOT UTC:
    // between 00:00 and 02:00 Madrid on a Monday, UTC still reports Sunday,
    // so a UTC week start would land this partial report on top of the
    // completed digest row the cron job wrote hours earlier. Any
    // caller-supplied week_start / week_end is overridden here on purpose
    // (see design.md).
    const today = todayLocalStr();
    weekStart = isoWeekStartLocal(today);
    weekEnd = today; // Monday..today, not Monday..Sunday
  } else if (!weekStart!) {
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
  if (mode === 'athlete') query = query.eq('athlete_id', targetAthleteId);

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
  const results: Array<{ coachId: string; athleteId: string; alertLevel: string; skipped: string | null; success: boolean }> = [];

  for (let i = 0; i < rels.length; i += BATCH_SIZE) {
    const batch = rels.slice(i, i + BATCH_SIZE);
    const promises = batch.map(rel => {
      const athlete = rel.athletes as { users?: { first_name?: string; last_name?: string } } | null;
      const firstName = athlete?.users?.first_name ?? '';
      const lastName = athlete?.users?.last_name ?? '';
      const athleteName = `${firstName} ${lastName}`.trim() || 'Atleta';
      return processAthlete(rel.coach_id, rel.athlete_id, athleteName, weekStart, weekEnd, mode)
        .then(result => ({
          coachId: rel.coach_id, athleteId: rel.athlete_id,
          alertLevel: result.alertLevel, skipped: result.skipped ?? null, success: true,
        }))
        .catch(err => {
          console.error(`Error processing athlete ${rel.athlete_id}:`, err);
          return { coachId: rel.coach_id, athleteId: rel.athlete_id, alertLevel: 'ok', skipped: null, success: false };
        });
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      results.push(r);
      if (r.skipped) continue; // a skipped run is not a new finding
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
