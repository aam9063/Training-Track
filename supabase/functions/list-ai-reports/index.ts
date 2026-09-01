import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const VALID_CHART_TYPES: ReadonlySet<string> = new Set([
  "tsb",
  "time_in_zone",
  "cardiac_drift",
  "best_efforts",
  "intensity_distribution",
  "weekly_load",
  "shoes",
  "general",
]);

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

interface ListBody {
  action?: "list" | "get" | "delete";
  id?: string;
  page?: number;
  limit?: number;
  chart_type?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, code: "method_not_allowed", message: "Usa POST" });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return respond(401, { ok: false, code: "unauthorized", message: "Falta cabecera Authorization" });
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !userData?.user) {
    return respond(401, { ok: false, code: "unauthorized", message: "JWT inválido" });
  }
  const athleteId = userData.user.id;

  let body: ListBody = {};
  try {
    body = (await req.json()) as ListBody;
  } catch {
    // allow empty body for default list
    body = {};
  }

  const action = body.action ?? "list";

  if (action === "get") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return respond(400, { ok: false, code: "bad_request", message: "Falta id" });
    }
    const { data: row, error } = await admin
      .from("ai_reports_history")
      .select("id, athlete_id, chart_type, title, report, athlete_context, source_data_hash, created_at")
      .eq("id", id)
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (error) {
      return respond(500, { ok: false, code: "db_error", message: error.message });
    }
    if (!row) {
      return respond(404, { ok: false, code: "not_found", message: "Informe no encontrado" });
    }
    return respond(200, { ok: true, report: row });
  }

  if (action === "delete") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return respond(400, { ok: false, code: "bad_request", message: "Falta id" });
    }
    const { error, count } = await admin
      .from("ai_reports_history")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("athlete_id", athleteId);

    if (error) {
      return respond(500, { ok: false, code: "db_error", message: error.message });
    }
    if (!count) {
      return respond(404, { ok: false, code: "not_found", message: "Informe no encontrado" });
    }
    return respond(200, { ok: true });
  }

  // default: list
  const page = Math.max(1, Number.isFinite(body.page) ? Number(body.page) : 1);
  const rawLimit = Number.isFinite(body.limit) ? Number(body.limit) : 10;
  const limit = Math.max(1, Math.min(50, rawLimit));
  const chartType =
    typeof body.chart_type === "string" && VALID_CHART_TYPES.has(body.chart_type)
      ? body.chart_type
      : null;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from("ai_reports_history")
    .select("id, chart_type, title, created_at", { count: "exact" })
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (chartType) {
    query = query.eq("chart_type", chartType);
  }

  const { data: rows, error, count } = await query;

  if (error) {
    return respond(500, { ok: false, code: "db_error", message: error.message });
  }

  const total = count ?? 0;
  return respond(200, {
    ok: true,
    reports: rows ?? [],
    total,
    page,
    limit,
    has_more: from + (rows?.length ?? 0) < total,
  });
});
