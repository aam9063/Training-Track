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

// Gemma 4 config defined above

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// Map Spanish day abbreviations (from athlete_profile.dias_disponibles) to English day names (used in AI output)
const DAY_ABBR_TO_ENGLISH: Record<string, string> = {
  L: 'monday',
  M: 'tuesday',
  X: 'wednesday',
  J: 'thursday',
  V: 'friday',
  S: 'saturday',
  D: 'sunday',
};

// ─── Data tier computation ───────────────────────────────────────────────────

type DataTier = 'full_data' | 'partial_data' | 'minimal_data' | 'profile_only';

const computeDataTier = (stravaCount: number): DataTier => {
  if (stravaCount >= 90) return 'full_data';
  if (stravaCount >= 30) return 'partial_data';
  if (stravaCount > 0) return 'minimal_data';
  return 'profile_only';
};

const tierLabels: Record<DataTier, string> = {
  full_data: 'full',
  partial_data: 'mixed',
  minimal_data: 'profile_heavy',
  profile_only: 'profile_only',
};

// ─── Strava weekly aggregation ───────────────────────────────────────────────

interface WeeklySummary {
  week_start: string;
  total_km: number;
  avg_pace_min_km: number | null;
  session_count: number;
}

const aggregateStravaWeekly = (activities: Array<Record<string, unknown>>): WeeklySummary[] => {
  const weeks = new Map<string, { km: number; paces: number[]; count: number }>();

  for (const act of activities) {
    const date = new Date(act.activity_date as string);
    // Get Monday of that week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekKey = monday.toISOString().split('T')[0];

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, { km: 0, paces: [], count: 0 });
    }
    const w = weeks.get(weekKey)!;
    const distKm = Number(act.distance_meters ?? 0) / 1000;
    w.km += distKm;
    w.count += 1;
    if (act.average_speed && Number(act.average_speed) > 0) {
      // Convert m/s to min/km
      const paceMinKm = 1000 / (Number(act.average_speed) * 60);
      w.paces.push(paceMinKm);
    }
  }

  const result: WeeklySummary[] = [];
  for (const [weekStart, data] of weeks) {
    result.push({
      week_start: weekStart,
      total_km: Math.round(data.km * 10) / 10,
      avg_pace_min_km: data.paces.length > 0
        ? Math.round((data.paces.reduce((a, b) => a + b, 0) / data.paces.length) * 100) / 100
        : null,
      session_count: data.count,
    });
  }

  return result.sort((a, b) => a.week_start.localeCompare(b.week_start));
};

// ─── System prompt builder ───────────────────────────────────────────────────

// Resume kpi.blocks de un ejercicio (fartlek/ritmos) a una linea para el prompt.
// Ejemplos:
//   {repeat:10, segments:[{duration_seconds:60,effort_pct:85,label:"rápido"},...]}
//   -> "10x (60s 85% rápido / 60s 55% trote)"
//   [{distance_meters:2000,effort_pct:60},{distance_meters:1000,effort_pct:80}]
//   -> "2km 60% / 1km 80%"
const summarizeBlocks = (kpi: unknown): string => {
  const k = kpi as Record<string, unknown> | null;
  const blocks = (k && Array.isArray(k.blocks)) ? (k.blocks as Array<Record<string, unknown>>) : null;
  if (!blocks || blocks.length === 0) return '';
  const fmtSeg = (s: Record<string, unknown>): string => {
    const dur = s.duration_seconds as number | undefined;
    const dist = s.distance_meters as number | undefined;
    const pct = s.effort_pct as number | undefined;
    const label = s.label as string | undefined;
    const sizePart = dur != null
      ? (dur >= 60 && dur % 60 === 0 ? `${dur / 60}min` : `${dur}s`)
      : dist != null
        ? (dist >= 1000 ? `${dist / 1000}km` : `${dist}m`)
        : '';
    const pctPart = pct != null ? ` ${pct}%` : '';
    const labelPart = label ? ` ${label}` : '';
    return `${sizePart}${pctPart}${labelPart}`.trim();
  };
  const parts = blocks.map((b) => {
    const segs = (b.segments as Array<Record<string, unknown>> | undefined) || null;
    if (segs && segs.length > 0) {
      const inner = segs.map(fmtSeg).join(' / ');
      const r = b.repeat as number | null | undefined;
      const until = b.until as string | undefined;
      if (r) return `${r}x (${inner})`;
      if (until) return `(${inner}) hasta ${until}`;
      return `(${inner})`;
    }
    return fmtSeg(b as Record<string, unknown>);
  });
  return parts.join(' + ');
};

// Formato compacto de un ejercicio para el prompt
const formatRunningEx = (ex: Record<string, unknown>): string => {
  const tags = Array.isArray(ex.tags) && ex.tags.length > 0 ? ` #${(ex.tags as string[]).join(',')}` : '';
  const lvl = ex.level && ex.level !== 'todos' ? ` [${ex.level}]` : '';
  const blocks = summarizeBlocks(ex.kpi);
  const blocksPart = blocks ? ` => ${blocks}` : '';
  return `${ex.name}${lvl}${tags}${blocksPart}`;
};

const formatGymEx = (ex: Record<string, unknown>): string => {
  const tags = Array.isArray(ex.tags) && ex.tags.length > 0 ? ` #${(ex.tags as string[]).join(',')}` : '';
  const lvl = ex.level && ex.level !== 'todos' ? ` [${ex.level}]` : '';
  const body = Array.isArray(ex.body_region) && ex.body_region.length > 0 ? ` (${(ex.body_region as string[]).join(',')})` : '';
  return `${ex.name}${lvl}${body}${tags}`;
};

// Agrupa por categoria y devuelve un bloque legible para el prompt
const groupByCategory = <T extends Record<string, unknown>>(
  exs: T[],
  formatter: (ex: T) => string,
): string => {
  const groups: Record<string, string[]> = {};
  for (const ex of exs) {
    const cat = (ex.category as string) || 'otros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(formatter(ex));
  }
  return Object.entries(groups)
    .map(([cat, items]) => `  ${cat}: ${items.join('; ')}`)
    .join('\n');
};

const buildSystemPrompt = (
  tier: DataTier,
  profile: Record<string, unknown>,
  weeklySummaries: WeeklySummary[],
  trainingLoad: Record<string, unknown> | null,
  recentSessions: Array<Record<string, unknown>>,
  competitions: Array<Record<string, unknown>>,
  runningBank: Array<Record<string, unknown>>,
  gymBank: Array<Record<string, unknown>>,
): string => {
  // ── Role definition ──
  const role = `Eres un entrenador de atletismo experto en medio fondo (800m-1500m) y fondo (5K, 10K, media maraton, maraton, trail). Generas planes de entrenamiento personalizados de 4 semanas basados en datos reales del atleta.`;

  // ── Output format specification (compact to reduce tokens) ──
  const outputFormat = `
FORMATO DE SALIDA:
Responde UNICAMENTE con JSON valido. Sin explicaciones ni markdown.
Estructura: {"n":"nombre plan","w":[semana1,semana2,semana3,semana4]}
Cada semana es un array de 7 sesiones (lunes a domingo): [[titulo,desc,tipo,km,min,intensidad],...]
tipo: "c"=carrera, "g"=gimnasio, "x"=cross_training, "d"=descanso
intensidad: "l"=low, "m"=moderate, "h"=high, "r"=recovery
Descanso: ["Descanso","Recuperacion completa","d",0,0,"r"]
DEBE haber 4 semanas con 7 sesiones cada una (28 total).
IMPORTANTE: En titulos y descripciones, SIEMPRE separa el numero de la unidad con un espacio: "8 km" (NO "8km"), "400 m" (NO "400m"), "6x1000 m" (NO "6x1000m").`;

  // ── Periodization rules ──
  const periodization = `
REGLAS DE PERIODIZACION (OBLIGATORIAS):
- Mesociclo de 4 semanas: semanas 1-3 carga progresiva, semana 4 descarga/recuperacion.
- Semana 1: volumen base (referencia).
- Semana 2: +5-8% de volumen sobre semana 1.
- Semana 3: +5-8% de volumen sobre semana 2 (pico de carga).
- Semana 4: -30-40% de volumen respecto a semana 3 (descarga).
- Incremento maximo absoluto: 10% por semana. NUNCA superar esta regla.
- Alternancia duro/facil: NUNCA programar 2 dias consecutivos de alta intensidad.
- Minimo 1 dia de descanso completo por semana.
- Tirada larga en fin de semana (sabado o domingo).
- Si hay competicion proxima, ajustar la semana 4 como taper hacia esa fecha.`;

  // ── Exercise sourcing rules ──
  // Formato compacto del catalogo. Cada ejercicio: "Nombre [level] #tag1,tag2 => bloques".
  // Los bloques (=> ...) solo aparecen en fartleks/ritmos y describen la estructura interna.
  const runningCatalog = groupByCategory(runningBank, formatRunningEx);
  const gymCatalog = profile.acceso_gimnasio ? groupByCategory(gymBank, formatGymEx) : '';
  const accesoGym = !!profile.acceso_gimnasio;

  const exerciseRules = `
BANCO DE EJERCICIOS DE CARRERA (formato: "Nombre [nivel] #tags => estructura_interna"):
${runningCatalog}
${accesoGym ? `\nBANCO DE EJERCICIOS DE GIMNASIO (formato: "Nombre [nivel] (zona_corporal) #tags"):\n${gymCatalog}\n` : ''}
REGLAS DE EJERCICIOS (CRITICAS):
- SOLO referencia ejercicios del banco proporcionado arriba. NO inventes nombres nuevos. En titulos y descripciones, usa los nombres tal como aparecen.
- Respeta el NIVEL del atleta: si el ejercicio tiene [avanzado] y el atleta es principiante, NO lo uses. Si tiene [todos], es valido para cualquier nivel. Sin marca de nivel = neutro/todos.
- Usa los TAGS (#vo2max, #umbral, #aerobico, #recuperacion, #maraton, #pliometria, #core, #prevencion...) para elegir el ejercicio segun el proposito de cada sesion.
- Para fartleks y ritmos (categoria 'fartlek_time', 'fartlek_distance', 'pace_blocks'), la "estructura_interna" indica los cambios exactos (ej: "10x (60s 85% rápido / 60s 55% trote)"). USA ESTA ESTRUCTURA en la descripcion para que el atleta sepa que hacer minuto a minuto.
${accesoGym
  ? `- SESIONES DE GIMNASIO: combina el calentamiento (banco running, categoria warmup_run) + 4-6 ejercicios del banco de gym + vuelta a la calma. En el titulo pon "Rodaje + Fuerza". El campo km DEBE reflejar los km totales de carrera (calentamiento + vuelta a la calma; 4-8 segun nivel). Elige ejercicios de gym usando #tags y zona_corporal acordes al objetivo (#prevencion + tobillos para shin splints, #core para tronco, #fuerza-maxima para potencia, etc.). Para principiantes evita [avanzado] (cargada, jerck, depth-jump, nordic-curl).`
  : '- No hay acceso a gimnasio: no incluyas sesiones de gym.'}
- En la descripcion de la sesion, incluye SIEMPRE: 1) el nombre del ejercicio principal del banco, 2) la estructura interna si es fartlek/ritmo, 3) ritmo objetivo en %FCmax o min/km cuando aplique.`;

  // ── Constraint enforcement from profile ──
  const diasDisponibles = profile.dias_disponibles as Record<string, boolean> | null ?? {};
  const diasActivosEng = Object.entries(diasDisponibles)
    .filter(([_, v]) => v === true)
    .map(([k]) => DAY_ABBR_TO_ENGLISH[k] ?? k);
  const diasInactivos = DAYS_OF_WEEK.filter(d => !diasActivosEng.includes(d));

  const horasPorDia = profile.horas_por_dia as Record<string, number> | null;

  const constraints = `
RESTRICCIONES DEL ATLETA (OBLIGATORIAS):
- Dias disponibles para entrenar: ${diasActivosEng.length > 0 ? diasActivosEng.join(', ') : 'no especificados (asume 4-5 dias)'}
- Dias que DEBEN ser descanso: ${diasInactivos.length > 0 ? diasInactivos.join(', ') : 'ninguno especificado'}
- El atleta SOLO puede entrenar los dias marcados como disponibles. Los demas dias DEBEN tener training_type="descanso".
${horasPorDia ? `- Tiempo maximo por sesion por dia: ${JSON.stringify(horasPorDia)}` : '- Tiempo maximo por sesion: respetar un maximo razonable segun el nivel.'}
- Acceso a gimnasio: ${profile.acceso_gimnasio ? 'SI - incluir 1-2 sesiones de fuerza por semana en dias de entrenamiento' : 'NO - no incluir sesiones de gimnasio'}
- Acceso a pista: ${profile.acceso_pista ? 'SI - incluir sesiones de series/intervalos en pista' : 'NO - adaptar intervalos a parque/calle con referencias de distancia'}
${profile.lesiones ? `- LESIONES/PRECAUCIONES: ${profile.lesiones}. Evitar ejercicios que puedan agravar estas lesiones y mencionar precauciones en las descripciones.` : '- Sin lesiones reportadas.'}`;

  // ── Athlete profile block ──
  const profileBlock = `
PERFIL DEL ATLETA:
- Nombre: ${profile.nombre ?? 'No proporcionado'}
- Sexo: ${profile.sexo === 'M' ? 'Masculino' : 'Femenino'}
- Fecha nacimiento: ${profile.fecha_nacimiento ?? 'No proporcionada'}
- Peso: ${profile.peso_kg ? `${profile.peso_kg} kg` : 'No proporcionado'}
- Altura: ${profile.altura_cm ? `${profile.altura_cm} cm` : 'No proporcionada'}
- Modalidad principal: ${profile.modalidad ?? 'No especificada'}
- Objetivo: ${profile.objetivo ?? 'No especificado'}
- Marca actual: ${profile.marca_actual ?? 'No proporcionada'}
- Competicion objetivo: ${profile.competicion_objetivo ?? 'Ninguna'}
- Fecha competicion: ${profile.competicion_fecha ?? 'No definida'}
- Km semanales actuales: ${profile.km_semanales ?? 0}
- Ritmo comodo: ${profile.ritmo_comodo ?? 'No proporcionado'}
- FC maxima: ${profile.fc_max ?? 'No proporcionada'}
- VO2max: ${profile.vo2max ?? 'No proporcionado'}`;

  // ── Training data blocks (conditional on tier) ──
  let dataBlock = '';

  if (weeklySummaries.length > 0) {
    dataBlock += `
RESUMEN SEMANAL DE STRAVA (ultimos 90 dias):
${weeklySummaries.map(w => `  Semana ${w.week_start}: ${w.total_km}km, ${w.session_count} sesiones${w.avg_pace_min_km ? `, ritmo medio ${w.avg_pace_min_km} min/km` : ''}`).join('\n')}`;
  }

  if (trainingLoad) {
    dataBlock += `

CARGA DE ENTRENAMIENTO ACTUAL:
- CTL (fitness cronico): ${trainingLoad.ctl ?? 'N/A'}
- ATL (fatiga aguda): ${trainingLoad.atl ?? 'N/A'}
- TSB (forma): ${trainingLoad.tsb ?? 'N/A'} (positivo=fresco, negativo=fatigado)`;
  }

  if (recentSessions.length > 0) {
    const sessionsSummary = recentSessions.slice(0, 20).map(s =>
      `  [${s.scheduled_date}] "${s.title}" - ${s.training_type ?? 'carrera'}${s.status ? ` (${s.status})` : ''}`
    ).join('\n');
    dataBlock += `

SESIONES RECIENTES (ultimos 90 dias, muestra):
${sessionsSummary}`;
  }

  if (competitions.length > 0) {
    const compBlock = competitions.map(c => {
      const days = Math.ceil((new Date(c.event_date as string).getTime() - Date.now()) / 86400000);
      return `  ${c.name} | ${c.event_date}${c.distance_km ? ` | ${c.distance_km}km` : ''} | en ${days} dias`;
    }).join('\n');
    dataBlock += `

COMPETICIONES PROXIMAS:
${compBlock}
- Si hay competicion en las proximas 4-6 semanas, ajustar la periodizacion para llegar en optimas condiciones.`;
  }

  // ── Tier-specific instructions ──
  const tierInstructions: Record<DataTier, string> = {
    profile_only: `
NIVEL DE DATOS: Solo perfil (sin datos historicos de Strava).
- Genera un plan MUY conservador.
- Volumen semanal de semana 1 NO superior al 100% de los km_semanales actuales del perfil (${profile.km_semanales ?? 0} km).
- Si el atleta reporta 0 km semanales (principiante), empezar con 3-4 sesiones cortas de 3-5 km.
- Priorizar adaptacion y prevencion de lesiones.
- Incluir mas dias de descanso de lo habitual.`,

    minimal_data: `
NIVEL DE DATOS: Datos minimos (menos de 30 actividades en 90 dias).
- Hay pocos datos de Strava. Usalos como referencia pero manten el plan conservador.
- No asumir que el atleta puede manejar mas volumen del que muestran los datos.
- Si los datos muestran inconsistencia en el entrenamiento, programar progresion suave.`,

    partial_data: `
NIVEL DE DATOS: Datos parciales (30-90 actividades en 90 dias).
- Basa la progresion en el volumen y ritmo real observado en los resumenes semanales.
- El volumen de semana 1 debe estar cerca del promedio semanal reciente del atleta.
- Ajustar intensidades segun los ritmos reales observados.`,

    full_data: `
NIVEL DE DATOS: Datos completos (90+ actividades en 90 dias).
- Analiza tendencias en los datos: progresion de volumen, evolucion de ritmos, consistencia.
- Identifica fortalezas (dias con mejor rendimiento) y debilidades (falta de variedad, exceso de intensidad).
- Genera un plan optimizado que construya sobre los patrones positivos y corrija deficiencias.
- Usa los datos de carga (CTL/ATL/TSB) para calibrar el punto de partida.`,
  };

  // ── Few-shot example ──
  const fewShot = `
EJEMPLO semana 1 (formato compacto):
{"n":"Plan 10K Intermedio","w":[[["Rodaje suave","5km R1",c",5,35,"l"],["Descanso","Recuperacion","d",0,0,"r"],["Fartlek","6x30s rapido/1min trote","c",6,40,"m"],["Descanso","Recuperacion","d",0,0,"r"],["Rodaje","4km facil","c",4,28,"l"],["Tirada larga","8km R1-R2","c",8,55,"l"],["Descanso","Recuperacion","d",0,0,"r"]],[semana2...],[semana3...],[semana4...]]}
Usa EXACTAMENTE este formato. 4 arrays de 7 arrays cada uno.`;

  // ── Assemble final prompt ──
  return [
    role,
    outputFormat,
    periodization,
    exerciseRules,
    constraints,
    profileBlock,
    dataBlock,
    tierInstructions[tier],
    fewShot,
    `\nAhora genera el plan completo de 4 semanas. Responde UNICAMENTE con el JSON.`,
  ].join('\n');
};

// ─── Response validation ─────────────────────────────────────────────────────

interface PlanSession {
  day_of_week: string;
  title: string;
  description: string;
  training_type: string;
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  intensity: string;
}

interface PlanWeek {
  week_number: number;
  sessions: PlanSession[];
}

interface PlanResponse {
  plan_name: string;
  duration_weeks: number;
  weeks: PlanWeek[];
}

const TYPE_MAP: Record<string, string> = { c: 'carrera', g: 'gimnasio', x: 'cross_training', d: 'descanso' };
const INTENSITY_MAP: Record<string, string> = { l: 'low', m: 'moderate', h: 'high', r: 'recovery' };

const validatePlanResponse = (parsed: unknown): PlanResponse | null => {
  if (!parsed || typeof parsed !== 'object') return null;
  const plan = parsed as Record<string, unknown>;

  // Support compact format: { n: "name", w: [[[title,desc,type,km,min,intensity],...7],...4] }
  if (Array.isArray(plan.w)) {
    const weeks = plan.w as unknown[][];
    if (weeks.length !== 4) return null;

    return {
      plan_name: typeof plan.n === 'string' ? plan.n : 'Plan generado por IA',
      duration_weeks: 4,
      weeks: weeks.map((weekSessions, wi) => {
        if (!Array.isArray(weekSessions) || weekSessions.length !== 7) return null;
        return {
          week_number: wi + 1,
          sessions: weekSessions.map((s, di) => {
            const arr = s as unknown[];
            if (!Array.isArray(arr) || arr.length < 6) return null;
            const rawType = String(arr[2]);
            const rawIntensity = String(arr[5]);
            return {
              day_of_week: DAYS_OF_WEEK[di],
              title: String(arr[0]),
              description: String(arr[1]),
              training_type: TYPE_MAP[rawType] ?? rawType,
              estimated_distance_km: Number(arr[3]) || 0,
              estimated_duration_minutes: Number(arr[4]) || 0,
              intensity: INTENSITY_MAP[rawIntensity] ?? rawIntensity,
            };
          }),
        };
      }).filter(Boolean) as PlanWeek[],
    };
  }

  // Support verbose format: { plan_name, weeks: [{ week_number, sessions: [{...}] }] }
  if (Array.isArray(plan.weeks)) {
    const weeks = plan.weeks as Array<Record<string, unknown>>;
    if (weeks.length !== 4) return null;

    for (const week of weeks) {
      if (!week || typeof week !== 'object') return null;
      if (!Array.isArray(week.sessions)) return null;
      if ((week.sessions as unknown[]).length !== 7) return null;
    }

    return {
      plan_name: typeof plan.plan_name === 'string' ? plan.plan_name : 'Plan generado por IA',
      duration_weeks: 4,
      weeks: weeks.map((w, i) => ({
        week_number: typeof w.week_number === 'number' ? w.week_number : i + 1,
        sessions: (w.sessions as Array<Record<string, unknown>>).map((s, di) => ({
          day_of_week: String(s.day_of_week ?? DAYS_OF_WEEK[di]),
          title: String(s.title),
          description: String(s.description ?? ''),
          training_type: TYPE_MAP[String(s.training_type)] ?? String(s.training_type),
          estimated_distance_km: Number(s.estimated_distance_km ?? 0),
          estimated_duration_minutes: Number(s.estimated_duration_minutes ?? 0),
          intensity: INTENSITY_MAP[String(s.intensity)] ?? String(s.intensity ?? 'low'),
        })),
      })),
    };
  }

  return null;
};

// ─── Clean AI response (strip markdown fences, etc.) ────────────────────────

const cleanJsonResponse = (raw: string): string => {
  let s = raw.trim();
  // Remove ```json ... ``` or ``` ... ```
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return s.trim();
};

// ─── Gemma 4 API call ────────────────────────────────────────────────────────

const callGemma = async (
  systemPrompt: string,
  temperature: number,
  timeoutMs: number,
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMMA_URL}${gemmaApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: 'Genera el plan compacto de 4 semanas. Responde UNICAMENTE con JSON valido sin markdown. Formato: {"n":"nombre","w":[[7 arrays de 6 elementos],[7],[7],[7]]}. Cada sesion: [titulo,descripcion,tipo,km,minutos,intensidad].' }] }],
        generationConfig: { temperature, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemma error ${response.status}: ${err}`);
    }

    const result = await response.json();
    // Debug: if no candidates, throw the full response
    if (!result.candidates?.length) {
      throw new Error('No candidates: ' + JSON.stringify(result).slice(0, 300));
    }
    const parts = result.candidates[0].content?.parts ?? [];
    // Get non-thought text, fallback to all text
    const nonThought = parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text: string }) => p.text).join('');
    const allText = parts.map((p: { text: string }) => p.text).join('');
    const content = nonThought || allText;
    if (!content) throw new Error('Empty parts: ' + JSON.stringify(parts).slice(0, 300));
    return content;
  } finally {
    clearTimeout(timeout);
  }
};

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Auth: verify JWT (coach OR independent athlete) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Decode JWT payload directly (verify_jwt is disabled at gateway level)
    const token = authHeader.replace('Bearer ', '');
    let callerId: string;
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      callerId = payload.sub;
      if (!callerId) throw new Error('No sub in JWT');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request body ──
    const body = await req.json();
    const { athlete_id: athleteId } = body as { athlete_id: string };

    if (!athleteId) {
      return new Response(JSON.stringify({ error: 'athlete_id is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Dual-auth: coach path OR independent athlete self-generation ──
    // Fetch the caller's user row to determine their role and independence flag
    const { data: callerUser } = await supabase
      .from('users')
      .select('role, is_independent')
      .eq('id', callerId)
      .maybeSingle();

    const isIndependentSelf =
      callerUser?.is_independent === true && callerId === athleteId;

    if (isIndependentSelf) {
      // ── Independent athlete generating their own plan ──
      // Security: athlete_id must match the JWT sub (already checked above via callerId === athleteId)
      // Rate limit: max 2 self-generated plans per 7-day window
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: recentPlans } = await supabase
        .from('training_plans')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', callerId)
        .is('coach_id', null)
        .gte('created_at', sevenDaysAgo);

      if ((recentPlans ?? 0) >= 2) {
        return new Response(JSON.stringify({ error: 'rate_limit_exceeded', message: 'Máximo 2 generaciones por semana.' }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // coachId stays undefined — used later only for response metadata
    } else {
      // ── Coach path: verify active coach-athlete relationship ──
      // Reject if an independent athlete tries to generate for a different athlete_id
      if (callerUser?.is_independent === true && callerId !== athleteId) {
        return new Response(JSON.stringify({ error: 'Forbidden: independent athletes can only generate plans for themselves.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const { data: rel } = await supabase
        .from('coach_athlete_relationship')
        .select('id')
        .eq('coach_id', callerId)
        .eq('athlete_id', athleteId)
        .eq('status', 'active')
        .maybeSingle();

      if (!rel) {
        return new Response(JSON.stringify({ error: 'No active relationship with this athlete' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Check DeepSeek API key ──
    if (!gemmaApiKey) {
      return new Response(JSON.stringify({ error: 'GEMMA4_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Gather data in parallel ──
    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const [
      profileRes,
      stravaRes,
      loadRes,
      sessionsRes,
      competitionsRes,
      runningExercisesRes,
      gymExercisesRes,
    ] = await Promise.all([
      // 1. Athlete profile
      supabase
        .from('athlete_profile')
        .select('*')
        .eq('user_id', athleteId)
        .maybeSingle(),

      // 2. Strava activities (last 90 days)
      supabase
        .from('strava_activities')
        .select('activity_date, distance_meters, average_speed, sport_type, elapsed_time')
        .eq('user_id', athleteId)
        .gte('activity_date', ninetyDaysAgo)
        .order('activity_date', { ascending: false }),

      // 3. Daily training load (latest for CTL/ATL/TSB)
      supabase
        .from('daily_training_load')
        .select('ctl, atl, tsb, date')
        .eq('athlete_id', athleteId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 4. Training sessions (last 90 days)
      supabase
        .from('training_sessions')
        .select('scheduled_date, title, training_type, status, description')
        .eq('athlete_id', athleteId)
        .gte('scheduled_date', ninetyDaysAgo)
        .order('scheduled_date', { ascending: false })
        .limit(50),

      // 5. Upcoming competitions
      supabase
        .from('competitions')
        .select('name, event_date, distance_km, location')
        .eq('athlete_id', athleteId)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(5),

      // 6. Running exercises bank (globales + customs del coach del atleta si aplica)
      supabase
        .from('running_exercises_bank')
        .select('slug, name, category, level, tags, body_region, kpi, distance_meters, duration_seconds, default_sets, default_rest_seconds, pace_description')
        .is('coach_id', null)
        .order('category')
        .order('name'),

      // 7. Gym exercises bank
      supabase
        .from('gym_exercises_bank')
        .select('slug, name, category, level, tags, body_region, default_sets, default_reps, default_rest_seconds, equipment')
        .is('coach_id', null)
        .order('category')
        .order('name'),
    ]);

    const profile = profileRes.data;
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Athlete profile not found. The athlete must complete onboarding first.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const stravaActivities = stravaRes.data ?? [];
    const trainingLoad = loadRes.data;
    const recentSessions = sessionsRes.data ?? [];
    const competitions = competitionsRes.data ?? [];
    const runningBank = runningExercisesRes.data ?? [];
    const gymBank = gymExercisesRes.data ?? [];

    // ── Compute tier ──
    const stravaCount = stravaActivities.length;
    const dataTier = computeDataTier(stravaCount);

    // ── Aggregate Strava data to weekly summaries ──
    const weeklySummaries = aggregateStravaWeekly(stravaActivities);

    // ── Build system prompt ──
    const systemPrompt = buildSystemPrompt(
      dataTier,
      profile as Record<string, unknown>,
      weeklySummaries,
      trainingLoad as Record<string, unknown> | null,
      recentSessions as Array<Record<string, unknown>>,
      competitions as Array<Record<string, unknown>>,
      runningBank as Array<Record<string, unknown>>,
      gymBank as Array<Record<string, unknown>>,
    );

    // ── Call Gemma 4 (single attempt, 55s timeout to fit Supabase 60s limit) ──
    let planResponse: PlanResponse | null = null;

    let rawContent = '';
    try {
      rawContent = await callGemma(systemPrompt, 0.3, 58000);
      const cleaned = cleanJsonResponse(rawContent);
      const parsed = JSON.parse(cleaned);
      planResponse = validatePlanResponse(parsed);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'timeout' }), {
          status: 504,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // Generation failed — fall through to error response with debug info
    }

    if (!planResponse) {
      return new Response(JSON.stringify({ error: 'ai_generation_failed', debug: rawContent.slice(0, 500) }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Return successful response ──
    return new Response(JSON.stringify({
      ...planResponse,
      tier: tierLabels[dataTier],
      athlete_id: athleteId,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
