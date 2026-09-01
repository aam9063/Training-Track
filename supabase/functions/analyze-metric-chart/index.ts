import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const gemmaApiKey = Deno.env.get("GEMMA4_API_KEY")!;
const GEMMA_MODEL = "gemini-2.5-flash";
const GEMMA_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=`;
const ABORT_MS = 58_000;
const GEMMA_MAX_OUTPUT_TOKENS_DEFAULT = 2000;
const GEMMA_TEMPERATURE = 0.2;

const admin = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ChartType =
  | "tsb"
  | "time_in_zone"
  | "cardiac_drift"
  | "best_efforts"
  | "intensity_distribution"
  | "weekly_load"
  | "shoes"
  | "general"
  | "vdot_progression"
  | "gap_vs_pace"
  | "splits_comparison"
  | "pmc_curve"
  | "training_zones"
  | "acwr_load";

const CHART_MAX_TOKENS: Partial<Record<ChartType, number>> = {
  splits_comparison: 2500,
  pmc_curve: 2500,
  training_zones: 2500,
  acwr_load: 2500,
};

const DEFAULT_SECTIONS_RULE = "EXACTAMENTE 4 secciones";

function sectionsRule(_chartType: ChartType): string {
  return DEFAULT_SECTIONS_RULE;
}

const VALID_CHART_TYPES: ReadonlySet<ChartType> = new Set([
  "tsb",
  "time_in_zone",
  "cardiac_drift",
  "best_efforts",
  "intensity_distribution",
  "weekly_load",
  "shoes",
  "general",
  "vdot_progression",
  "gap_vs_pace",
  "splits_comparison",
  "pmc_curve",
  "training_zones",
  "acwr_load",
]);

const VALID_CHART_IDS: ReadonlySet<string> = new Set([
  "line_trend",
  "bar_comparison",
  "donut_distribution",
  "progress_gauge",
  "zone_bar",
]);

const VALID_SECTION_TYPES: ReadonlySet<string> = new Set([
  "heading",
  "text",
  "list",
  "kpi",
  "recommendation",
  "chart",
]);

const VALID_PRIORITIES: ReadonlySet<string> = new Set(["high", "medium", "low"]);

const CHART_TYPE_TITLES: Record<ChartType, string> = {
  tsb: "TSB",
  time_in_zone: "Tiempo en zonas",
  cardiac_drift: "Desacoplamiento cardíaco",
  best_efforts: "Mejores marcas",
  intensity_distribution: "Distribución de intensidad",
  weekly_load: "Carga semanal",
  shoes: "Zapatillas",
  general: "Análisis general",
  vdot_progression: "Progresión VDOT",
  gap_vs_pace: "GAP vs Pace real",
  splits_comparison: "Splits comparativos",
  pmc_curve: "Curva de Rendimiento (PMC)",
  training_zones: "Zonas de Entrenamiento",
  acwr_load: "Gestión de Carga (ACWR)",
};

const MONTHS_ES_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

interface AthleteContext {
  nivel?: string;
  objetivo?: string;
  vam?: number;
}

interface AnalyzeRequest {
  chart_type: ChartType;
  data: Record<string, unknown>;
  athlete_context?: AthleteContext;
}

interface Section {
  type: string;
  [key: string]: unknown;
}

interface Report {
  sections: Section[];
}

function normaliseForHash(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10) / 10;
  }
  if (Array.isArray(value)) return value.map(normaliseForHash);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normaliseForHash(v);
    }
    return out;
  }
  return value;
}

const HUMAN_RANGES = {
  vam_kmh: { min: 8, max: 25 },
  hr_bpm: { min: 40, max: 210 },
  vo2max_ml_kg_min: { min: 30, max: 85 },
  pace_min_km: { min: 2.5, max: 9 },
} as const;

function sanitizeVam(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return null;
  if (n < HUMAN_RANGES.vam_kmh.min || n > HUMAN_RANGES.vam_kmh.max) return null;
  return Math.round(n * 10) / 10;
}

function buildContextLine(ctx: AthleteContext | undefined): string {
  if (!ctx) return "";
  const nivel = ctx.nivel || "";
  const objetivo = ctx.objetivo || "";
  const safeVam = sanitizeVam(ctx.vam);
  const parts: string[] = [];
  if (nivel) parts.push(`nivel:${nivel}`);
  if (objetivo) parts.push(`obj:${objetivo}`);
  if (safeVam != null) parts.push(`vam:${safeVam}`);
  return parts.length ? parts.join(" ") : "";
}

function titleFor(chartType: ChartType, d: Date): string {
  const day = d.getDate();
  const mon = MONTHS_ES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const base = CHART_TYPE_TITLES[chartType] ?? chartType;
  return `${base} — ${day} ${mon} ${year}`;
}

const SYSTEM_PROMPT = `Eres entrenador de running. Devuelve SOLO JSON: {"sections":[{type,...}]}.
type: heading{content}|text{content}|list{items[]}|kpi{label,value,delta?}|recommendation{content,priority:"high"|"medium"|"low"}.
EXACTAMENTE 4 secciones. Español, sin markdown.
IMPORTANTE: Devuelve SOLO el JSON. No uses markdown. No añadas \`\`\`json ni \`\`\`. No añadas texto antes o después del JSON. Empieza directamente con { y termina con }.
Explica cada variable en 2 frases (qué es + valor del atleta). Recomendación CONCRETA: días/minutos/zonas (ej: "3 Z2 40min"). Prohibido "mantén la carga".
Rangos: FC 40-210, VAM 10-22, VO2 30-85, ritmo 3:00-8:00. Ignora fuera de rango. No inventes datos.`;

const PROMPT_TEMPLATES: Record<
  ChartType,
  (data: Record<string, unknown>, ctx: AthleteContext | undefined) => string
> = {
  tsb: (data, ctx) =>
    `TSB ${JSON.stringify(data)} ${buildContextLine(ctx)}. +15/+25 pico; -10/-30 productivo; <-30 sobrecarga. ${sectionsRule("tsb")}. Interpreta TSB y di qué hacer hoy.`,

  time_in_zone: (data, ctx) =>
    `Tiempo zonas FC ${JSON.stringify(data)} ${buildContextLine(ctx)}. ${sectionsRule("time_in_zone")}. Foco: distribución de tiempo en zonas FC y ajuste recomendado.`,

  cardiac_drift: (data, ctx) => {
    const driftPct = (data as { drift_pct?: number }).drift_pct ?? "?";
    const durationMin = (data as { duration_min?: number }).duration_min ?? "?";
    return `Drift Pa:HR=${driftPct}% en ${durationMin}min. ${buildContextLine(ctx)}. <5% ok, 5-8% medio, >8% fatiga. ${sectionsRule("cardiac_drift")}. Interpreta drift y acción (Z2, hidratación).`;
  },

  best_efforts: (data, ctx) =>
    `Mejores esfuerzos ${JSON.stringify(data)} ${buildContextLine(ctx)}. ${sectionsRule("best_efforts")}. Foco: progresión y en qué distancia está más fuerte.`,

  intensity_distribution: (data, ctx) => {
    const d = data as { z12_pct?: number; z3_pct?: number; z45_pct?: number };
    return `Intensidad Z1-2:${d.z12_pct ?? "?"}% Z3:${d.z3_pct ?? "?"}% Z4-5:${d.z45_pct ?? "?"}%. ${buildContextLine(ctx)}. Polarizada ~80/20. ${sectionsRule("intensity_distribution")}. Foco: polarización. Sugerencia concreta.`;
  },

  weekly_load: (data, ctx) => {
    const d = data as {
      series?: Array<{ week: string; total_suffer: number }>;
    };
    const full = Array.isArray(d?.series) ? d.series : [];
    const last6 = full.slice(-6).map((r) => Math.round(Number(r.total_suffer) || 0));
    const avgWeekly = last6.length
      ? Math.round(last6.reduce((a, b) => a + b, 0) / last6.length)
      : 0;
    let trendPct = 0;
    if (last6.length >= 2) {
      const prev = last6.slice(0, -1);
      const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
      const latest = last6[last6.length - 1];
      trendPct = prevAvg > 0 ? Math.round(((latest - prevAvg) / prevAvg) * 100) : 0;
    }
    const compact = { avg_weekly: avgWeekly, trend_pct: trendPct, weeks: last6 };
    return `Suffer semanal ${JSON.stringify(compact)} ${buildContextLine(ctx)}. <150 bajo, 150-400 mod, 400-700 alto, >700 muy alto. ${sectionsRule("weekly_load")}. Foco: tendencia y riesgo de sobreentrenamiento.`;
  },

  shoes: (data, ctx) =>
    `Zapatillas ${JSON.stringify(data)} ${buildContextLine(ctx)}. Vida 600-800km. ${sectionsRule("shoes")}. Foco: cuál cerca del límite y rotación.`,

  general: (data, ctx) => {
    const d = data as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    const intensity = d.intensity as
      | { z12_pct?: number; z3_pct?: number; z45_pct?: number; label?: string }
      | null;
    if (intensity) {
      summary.intensidad = `Z1-2:${intensity.z12_pct}% Z3:${intensity.z3_pct}% Z4-5:${intensity.z45_pct}% (${intensity.label})`;
    }

    const tiz = d.time_in_zone as
      | { zones?: Array<{ zone: number; pct: number }> }
      | null;
    if (tiz?.zones?.length) {
      const top = tiz.zones.reduce((a, b) => (a.pct > b.pct ? a : b));
      summary.zona_dominante = `Z${top.zone} (${top.pct}%)`;
    }

    const wl = d.weekly_load as
      | { series?: Array<{ week: string; total_suffer: number }> }
      | null;
    if (wl?.series?.length) {
      const last4 = wl.series.slice(-4).map((s) => Math.round(Number(s.total_suffer) || 0));
      summary.carga_4_semanas = last4.join(",");
    }

    const shoes = d.shoes as
      | { shoes?: Array<{ distance_km: number; active: boolean }> }
      | null;
    if (shoes?.shoes?.length) {
      const active = shoes.shoes.filter((s) => s.active).length;
      const maxKm = Math.max(...shoes.shoes.map((s) => s.distance_km));
      summary.zapatillas = `${active} activas, max ${Math.round(maxKm)}km`;
    }

    const pr = d.best_efforts_summary as
      | { personal_bests?: Array<{ distance: string; best_time_sec: number }> }
      | null;
    if (pr?.personal_bests?.length) {
      summary.records = pr.personal_bests
        .map((p) => `${p.distance}:${Math.round(p.best_time_sec)}s`)
        .join(" ");
    }

    return `General ${JSON.stringify(summary)} ${buildContextLine(ctx)}. ${sectionsRule("general")}. Foco: forma actual, fuerte/débil, foco próxima semana.`;
  },

  vdot_progression: (data, ctx) => {
    const d = data as { series?: Array<{ date: string; vdot: number }> };
    const full = Array.isArray(d?.series) ? d.series : [];
    const last = full.slice(-8).map((p) => ({
      d: p.date,
      v: Number.isFinite(p.vdot) ? Math.round(p.vdot * 10) / 10 : null,
    }));
    const first = last[0]?.v ?? null;
    const latest = last[last.length - 1]?.v ?? null;
    const delta = first != null && latest != null ? Math.round((latest - first) * 10) / 10 : 0;
    const compact = { points: last, delta };
    return `VDOT ${JSON.stringify(compact)} ${buildContextLine(ctx)}. <40 ppl, 40-50 amateur, 50-60 inter, 60-70 avz, >70 élite. ${sectionsRule("vdot_progression")}. Foco: VDOT actual, tendencia, bloque recomendado (velocidad/umbral/recuperación).`;
  },

  gap_vs_pace: (data, ctx) => {
    const d = data as {
      pace_real_avg_sec?: number;
      gap_avg_sec?: number;
      avg_delta_sec?: number;
      elevation_gain_m?: number;
      samples?: number;
    };
    const compact = {
      pace_real_avg_sec: d.pace_real_avg_sec ?? null,
      gap_avg_sec: d.gap_avg_sec ?? null,
      avg_delta_sec: d.avg_delta_sec ?? null,
      elevation_gain_m: d.elevation_gain_m ?? null,
      samples: d.samples ?? null,
    };
    return `GAP vs Pace ${JSON.stringify(compact)} ${buildContextLine(ctx)}. Δ>20s/km = mucho desnivel. ${sectionsRule("gap_vs_pace")}. Foco: impacto del desnivel en ritmo real y consistencia del esfuerzo.`;
  },

  splits_comparison: (data, ctx) => {
    const d = data as {
      km_count?: number;
      pace_avg_sec?: number | null;
      pace_min_sec?: number | null;
      pace_max_sec?: number | null;
      pace_cv_pct?: number | null;
      hr_avg_bpm?: number | null;
      hr_max_bpm?: number | null;
      is_positive_split?: boolean | null;
      samples?: Array<{ k: number; p: number; h: number | null; t?: string }>;
      splits?: Array<{ km: number; pace_sec_per_km: number; hr?: number }>;
    };

    let kmCount = typeof d?.km_count === "number" ? d.km_count : 0;
    let samples = Array.isArray(d?.samples) ? d.samples : null;
    let paceAvg = d?.pace_avg_sec ?? null;
    let paceMin = d?.pace_min_sec ?? null;
    let paceMax = d?.pace_max_sec ?? null;
    let paceCv = d?.pace_cv_pct ?? null;
    let hrAvg = d?.hr_avg_bpm ?? null;
    let hrMax = d?.hr_max_bpm ?? null;
    let isPositiveSplit = d?.is_positive_split ?? null;

    if (!samples && Array.isArray(d?.splits)) {
      const legacy = d.splits;
      kmCount = legacy.length;
      const paces = legacy
        .map((s) => Number(s.pace_sec_per_km))
        .filter((p) => Number.isFinite(p) && p > 0);
      const hrs = legacy
        .map((s) => Number(s.hr))
        .filter((h) => Number.isFinite(h) && h > 0);
      paceAvg = paces.length
        ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length)
        : null;
      paceMin = paces.length ? Math.round(Math.min(...paces)) : null;
      paceMax = paces.length ? Math.round(Math.max(...paces)) : null;
      hrAvg = hrs.length
        ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
        : null;
      hrMax = hrs.length ? Math.max(...hrs) : null;
      samples = legacy.slice(0, 12).map((s, i) => {
        let t = "middle";
        if (i < 3 && kmCount > 6) t = "first";
        else if (i >= kmCount - 3 && kmCount > 6) t = "last";
        return {
          k: s.km,
          p: Math.round(Number(s.pace_sec_per_km) || 0),
          h: Number.isFinite(s.hr) ? Math.round(Number(s.hr)) : null,
          t,
        };
      });
    }

    if (samples && samples.length > 12) samples = samples.slice(0, 12);

    const compact = {
      km_count: kmCount,
      pace_avg_sec: paceAvg,
      pace_min_sec: paceMin,
      pace_max_sec: paceMax,
      pace_cv_pct: paceCv,
      hr_avg_bpm: hrAvg,
      hr_max_bpm: hrMax,
      is_positive_split: isPositiveSplit,
      samples: samples ?? [],
    };

    return `Splits ${JSON.stringify(compact)} ${buildContextLine(ctx)}. NO recalcules. ${sectionsRule("splits_comparison")}. Foco: positive/negative split, estrategia y FC vs ritmo. Sugiere para próxima carrera.`;
  },

  pmc_curve: (data, ctx) => {
    const d = data as {
      ctl?: number;
      atl?: number;
      tsb?: number;
      acwr?: number;
      ctl_trend_pct?: number;
      tsb_state?: string;
      weeks?: number;
      tss_total?: number;
    };
    const compact = {
      ctl: d.ctl ?? null,
      atl: d.atl ?? null,
      tsb: d.tsb ?? null,
      acwr: d.acwr ?? null,
      ctl_trend_pct: d.ctl_trend_pct ?? null,
      tsb_state: d.tsb_state ?? null,
      weeks: d.weeks ?? 12,
      tss_total: d.tss_total ?? null,
    };
    return `PMC ${JSON.stringify(compact)} ${buildContextLine(ctx)}. Foco: interpreta CTL (fitness), ATL (fatiga), TSB (forma), ACWR. Di si puede competir o necesita descarga.`;
  },

  training_zones: (data, ctx) => {
    const d = data as {
      vdot?: number;
      max_hr?: number;
      rest_hr?: number;
      distribution?: { z1?: number; z2?: number; z3?: number; z4?: number; z5?: number };
      weeks?: number;
      sample?: string;
    };
    const dist = d.distribution ?? {};
    const compact = {
      vdot: d.vdot ?? null,
      max_hr: d.max_hr ?? null,
      rest_hr: d.rest_hr ?? null,
      dist_pct: {
        z1: dist.z1 ?? 0,
        z2: dist.z2 ?? 0,
        z3: dist.z3 ?? 0,
        z4: dist.z4 ?? 0,
        z5: dist.z5 ?? 0,
      },
      weeks: d.weeks ?? 8,
    };
    return `Zonas ${JSON.stringify(compact)} ${buildContextLine(ctx)}. Foco: polarización 80/20 en distribución Z1-Z5. Sugiere ajuste concreto.`;
  },

  acwr_load: (data, ctx) => {
    const d = data as {
      acute_km?: number;
      chronic_km?: number;
      acwr?: number;
      status?: string;
      weeks?: Array<{ wk?: string; km?: number; zone?: string }>;
    };
    const weeks = Array.isArray(d.weeks) ? d.weeks.slice(-6).map((w) => ({
      wk: w.wk ?? "",
      km: typeof w.km === "number" ? Math.round(w.km * 10) / 10 : 0,
    })) : [];
    const compact = {
      acute_km: d.acute_km ?? null,
      chronic_km: d.chronic_km ?? null,
      acwr: d.acwr ?? null,
      status: d.status ?? null,
      weeks,
    };
    return `ACWR ${JSON.stringify(compact)} ${buildContextLine(ctx)}. Foco: ACWR actual, riesgo de lesión (<0.8 bajo, 0.8-1.3 óptimo, 1.3-1.5 alto, >1.5 peligro). Recomienda descarga si aplica.`;
  },
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hashBuf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function trimStr(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  return "";
}

function validateSections(raw: unknown[]): Section[] {
  const valid: Section[] = [];
  let chartCount = 0;

  for (const s of raw) {
    if (valid.length >= 8) break;
    if (!s || typeof s !== "object") continue;
    const section = s as Record<string, unknown>;
    const type = typeof section.type === "string" ? section.type : "";
    if (!VALID_SECTION_TYPES.has(type)) continue;

    switch (type) {
      case "heading":
      case "text": {
        const content = trimStr(section.content);
        if (!content) continue;
        valid.push({ type, content });
        break;
      }
      case "list": {
        const items = Array.isArray(section.items)
          ? section.items
              .map((it) => trimStr(it))
              .filter((it) => it.length > 0)
          : [];
        if (items.length === 0) continue;
        valid.push({ type: "list", items });
        break;
      }
      case "kpi": {
        const label = trimStr(section.label);
        const value = trimStr(section.value);
        if (!label || !value) continue;
        const kpi: Section = { type: "kpi", label, value };
        if (typeof section.delta === "number" && Number.isFinite(section.delta)) {
          kpi.delta = section.delta;
        } else if (typeof section.delta === "string" && section.delta.trim()) {
          kpi.delta = section.delta.trim();
        }
        valid.push(kpi);
        break;
      }
      case "recommendation": {
        const content = trimStr(section.content);
        const priority = trimStr(section.priority).toLowerCase();
        if (!content) continue;
        const finalPriority = VALID_PRIORITIES.has(priority) ? priority : "medium";
        valid.push({ type: "recommendation", content, priority: finalPriority });
        break;
      }
      case "chart": {
        if (chartCount >= 5) continue;
        const chartId = trimStr(section.chart_id);
        const data = section.data;
        if (!VALID_CHART_IDS.has(chartId)) continue;
        if (!data || typeof data !== "object") continue;
        const caption = trimStr(section.caption);
        const chart: Section = { type: "chart", chart_id: chartId, data };
        if (caption) chart.caption = caption;
        valid.push(chart);
        chartCount += 1;
        break;
      }
    }
  }

  return valid;
}

function fallbackText(raw: string): Report {
  // Clean up fences/prefixes for display when everything else fails,
  // so the user never sees raw ```json markdown fences.
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();
  return { sections: [{ type: "text", content: cleaned.slice(0, 4000) }] };
}

function stripFences(input: string): string {
  let s = input.trim();
  // Strip opening fence: ```json or ``` (with optional newline).
  s = s.replace(/^```(?:json|JSON)?\s*\n?/i, "");
  // Strip closing fence: ``` at end of string (handles with or without newline).
  s = s.replace(/\n?```\s*$/i, "");
  return s.trim();
}

/**
 * Scan input and extract the first balanced JSON object (or array) substring.
 * Respects string literals and escapes. Returns null if no balanced block found.
 */
function extractBalancedJson(input: string): string | null {
  const openers: Record<string, string> = { "{": "}", "[": "]" };
  let start = -1;
  let openChar = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "{" || ch === "[") {
      start = i;
      openChar = ch;
      break;
    }
  }
  if (start === -1) return null;
  const closeChar = openers[openChar];

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseGemmaResponse(raw: string): { report: Report; hadFallback: boolean } {
  // Attempt 1: strip fences then parse.
  const stripped = stripFences(raw);
  let parsed: unknown | null = tryParseJson(stripped);

  // Attempt 2: extract a balanced JSON block (handles prefix/suffix text and
  // unclosed fences where the JSON itself is still balanced).
  if (!parsed) {
    const balanced = extractBalancedJson(stripped);
    if (balanced) parsed = tryParseJson(balanced);
  }

  // Attempt 3: same, but over the original raw (in case stripping removed too much).
  if (!parsed) {
    const balancedRaw = extractBalancedJson(raw);
    if (balancedRaw) parsed = tryParseJson(balancedRaw);
  }

  if (!parsed) {
    logEvent("analyze_metric_chart_parse_fallback", {
      reason: "json_parse_failed",
      raw_head: raw.slice(0, 200),
      raw_len: raw.length,
    });
    return { report: fallbackText(raw), hadFallback: true };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { sections?: unknown }).sections)
  ) {
    logEvent("analyze_metric_chart_parse_fallback", {
      reason: "missing_sections_array",
      raw_head: raw.slice(0, 200),
    });
    return { report: fallbackText(raw), hadFallback: true };
  }

  const sectionsRaw = (parsed as { sections: unknown[] }).sections;
  if (sectionsRaw.length === 0) {
    logEvent("analyze_metric_chart_parse_fallback", {
      reason: "empty_sections",
      raw_head: raw.slice(0, 200),
    });
    return { report: fallbackText(raw), hadFallback: true };
  }

  const valid = validateSections(sectionsRaw);
  if (valid.length === 0) {
    logEvent("analyze_metric_chart_parse_fallback", {
      reason: "no_valid_sections",
      raw_head: raw.slice(0, 200),
    });
    return { report: fallbackText(raw), hadFallback: true };
  }

  return { report: { sections: valid }, hadFallback: false };
}

async function callGemma(prompt: string, maxOutputTokens: number = GEMMA_MAX_OUTPUT_TOKENS_DEFAULT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);

  const fetchStart = Date.now();
  try {
    const res = await fetch(`${GEMMA_URL}${gemmaApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: {
          temperature: GEMMA_TEMPERATURE,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const fetchMs = Date.now() - fetchStart;

    if (!res.ok) {
      const errText = await res.text();
      logEvent("analyze_metric_chart_gemma_http", {
        status: res.status,
        fetch_ms: fetchMs,
        prompt_chars: prompt.length,
      });
      throw new Error(`Gemma error ${res.status}: ${errText}`);
    }

    const aiResult = await res.json();
    logEvent("analyze_metric_chart_gemma_ok", {
      fetch_ms: fetchMs,
      prompt_chars: prompt.length,
      max_tokens: maxOutputTokens,
      model: GEMMA_MODEL,
    });
    const parts = aiResult.candidates?.[0]?.content?.parts ?? [];
    let text = parts
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      text = parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
    }
    if (!text) throw new Error("Empty AI response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function logEvent(tag: string, payload: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag, ...payload }));
  } catch {
    // ignore
  }
}

function background(promise: Promise<unknown>, label: string) {
  const wrapped = promise.catch((err) => {
    logEvent("analyze_metric_chart_bg_error", {
      label,
      detail: String(err).slice(0, 300),
    });
  });
  // @ts-expect-error EdgeRuntime is injected by Supabase
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-expect-error — see above
    EdgeRuntime.waitUntil(wrapped);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, code: "method_not_allowed", message: "Use POST" });
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return respond(401, { ok: false, code: "unauthorized", message: "Missing Authorization header" });
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !userData?.user) {
    return respond(401, { ok: false, code: "unauthorized", message: "Invalid JWT" });
  }
  const athleteId = userData.user.id;

  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return respond(400, { ok: false, code: "bad_request", message: "Invalid JSON body" });
  }

  const chartType = body?.chart_type;
  if (!chartType || !VALID_CHART_TYPES.has(chartType)) {
    return respond(400, {
      ok: false,
      code: "invalid_chart_type",
      message: `chart_type inválido. Permitidos: ${Array.from(VALID_CHART_TYPES).join(", ")}`,
    });
  }
  const data = body.data ?? {};
  const athleteContext = body.athlete_context ?? undefined;

  const canonical = canonicalJson(
    normaliseForHash({ chart_type: chartType, data, athlete_id: athleteId }),
  );
  const inputHash = await sha256Hex(canonical);

  const { data: cachedRow } = await admin
    .from("ai_analysis_cache")
    .select("response, expires_at")
    .eq("input_hash", inputHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cachedRow?.response) {
    let cachedReport: Report;
    if (typeof cachedRow.response === "string") {
      cachedReport = { sections: [{ type: "text", content: cachedRow.response }] };
    } else if (
      cachedRow.response &&
      typeof cachedRow.response === "object" &&
      Array.isArray((cachedRow.response as { sections?: unknown }).sections)
    ) {
      cachedReport = cachedRow.response as Report;
    } else {
      cachedReport = { sections: [{ type: "text", content: "Sin datos" }] };
    }

    const title = titleFor(chartType, new Date());

    background(
      admin
        .from("ai_reports_history")
        .insert({
          athlete_id: athleteId,
          chart_type: chartType,
          title,
          report: cachedReport,
          athlete_context: athleteContext ?? null,
          source_data_hash: inputHash,
        })
        .then(() => undefined),
      "history_insert_cache",
    );

    logEvent("analyze_metric_chart", {
      chart_type: chartType,
      hash: inputHash,
      cached: true,
      had_fallback: false,
      report_sections: cachedReport.sections.length,
    });

    return respond(200, {
      ok: true,
      report: cachedReport,
      report_id: null,
      title,
      cached: true,
      source: "cache",
      remaining: null,
    });
  }

  const { data: limitData, error: limitError } = await admin.rpc("get_ai_analysis_limit", {
    p_athlete_id: athleteId,
  });

  if (limitError) {
    return respond(500, {
      ok: false,
      code: "quota_lookup_failed",
      message: limitError.message,
    });
  }

  const limit = (limitData?.limit ?? 1) as number;
  const source = (limitData?.source ?? "free") as string;
  const coachId = (limitData?.coach_id as string | undefined) ?? null;
  const targetUserId = source === "coach" && coachId ? coachId : athleteId;
  const ym = currentYearMonth();

  let usageCount = 0;
  if (limit !== -1) {
    const { data: usageRow } = await admin
      .from("ai_analysis_usage")
      .select("usage_count")
      .eq("athlete_id", targetUserId)
      .eq("year_month", ym)
      .maybeSingle();

    usageCount = (usageRow?.usage_count ?? 0) as number;

    if (usageCount >= limit) {
      const now = new Date();
      const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return respond(403, {
        ok: false,
        code: "quota_exhausted",
        message: "Has agotado tu cuota mensual de análisis IA",
        used: usageCount,
        limit,
        resets_at: resetDate.toISOString(),
        source,
      });
    }
  }

  if (chartType === "splits_comparison") {
    const kmCount =
      typeof (data as { km_count?: number })?.km_count === "number"
        ? (data as { km_count: number }).km_count
        : Array.isArray((data as { splits?: unknown[] })?.splits)
          ? ((data as { splits: unknown[] }).splits?.length ?? 0)
          : 0;
    if (kmCount > 30) {
      const title = titleFor(chartType, new Date());
      const unsupported: Report = {
        sections: [
          {
            type: "text",
            content:
              "Analizador no soportado para actividades >30 km por ahora.",
          },
        ],
      };
      return respond(200, {
        ok: true,
        report: unsupported,
        report_id: null,
        title,
        cached: false,
        source: "unsupported",
        remaining: null,
      });
    }
  }

  const prompt = PROMPT_TEMPLATES[chartType](data, athleteContext);
  const maxTokens = CHART_MAX_TOKENS[chartType] ?? GEMMA_MAX_OUTPUT_TOKENS_DEFAULT;

  const gemmaStart = Date.now();
  let responseText: string;
  try {
    responseText = await callGemma(prompt, maxTokens);
  } catch (err) {
    const elapsedMs = Date.now() - gemmaStart;
    const isAbort = err instanceof Error && err.name === "AbortError";
    logEvent("analyze_metric_chart_error", {
      chart_type: chartType,
      hash: inputHash,
      error: isAbort ? "ai_timeout" : "ai_error",
      elapsed_ms: elapsedMs,
      detail: String(err).slice(0, 500),
    });
    return respond(isAbort ? 504 : 502, {
      ok: false,
      code: isAbort ? "ai_timeout" : "ai_error",
      message: isAbort
        ? "La IA tardó demasiado en responder. Inténtalo de nuevo en unos segundos."
        : "El servicio de IA no pudo generar una respuesta. Inténtalo de nuevo.",
      elapsed_ms: elapsedMs,
    });
  }

  const { report, hadFallback } = parseGemmaResponse(responseText);
  const gemmaElapsedMs = Date.now() - gemmaStart;

  const remaining = limit === -1 ? null : Math.max(0, limit - usageCount - 1);
  const title = titleFor(chartType, new Date());

  background(
    admin
      .from("ai_analysis_cache")
      .insert({
        input_hash: inputHash,
        athlete_id: athleteId,
        chart_type: chartType,
        response: report,
      })
      .then(() => undefined),
    "cache_insert",
  );

  if (limit !== -1) {
    background(
      (async () => {
        const nowIso = new Date().toISOString();
        const { data: upd } = await admin
          .from("ai_analysis_usage")
          .update({
            usage_count: usageCount + 1,
            last_used_at: nowIso,
          })
          .eq("athlete_id", targetUserId)
          .eq("year_month", ym)
          .select("usage_count")
          .maybeSingle();

        if (!upd) {
          await admin.from("ai_analysis_usage").insert({
            athlete_id: targetUserId,
            year_month: ym,
            usage_count: 1,
            last_used_at: nowIso,
          });
        }
      })(),
      "usage_update",
    );
  }

  background(
    admin
      .from("ai_reports_history")
      .insert({
        athlete_id: athleteId,
        chart_type: chartType,
        title,
        report,
        athlete_context: athleteContext ?? null,
        source_data_hash: inputHash,
      })
      .then(() => undefined),
    "history_insert_fresh",
  );

  logEvent("analyze_metric_chart", {
    chart_type: chartType,
    hash: inputHash,
    cached: false,
    had_fallback: hadFallback,
    report_sections: report.sections.length,
    remaining_quota: remaining,
    gemma_elapsed_ms: gemmaElapsedMs,
  });

  return respond(200, {
    ok: true,
    report,
    report_id: null,
    title,
    cached: false,
    source,
    remaining,
  });
});
