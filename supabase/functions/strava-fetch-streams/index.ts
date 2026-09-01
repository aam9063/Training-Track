import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") || "";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") || "";

const STREAM_KEYS = [
  "time",
  "distance",
  "heartrate",
  "cadence",
  "velocity_smooth",
  "altitude",
  "grade_smooth",
  "temp",
  "moving",
];

const TARGET_SAMPLES = 720;
const DURATION_DOWNSAMPLE_THRESHOLD_SECONDS = 3600;
const MAX_SERIALIZED_BYTES = 500_000;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function getAnonClient(jwt: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

type Admin = ReturnType<typeof getAdminClient>;

function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
  } catch {
    // no-op
  }
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function downsampleArray<T>(arr: T[] | undefined | null, target: number): T[] | null {
  if (!arr || arr.length === 0) return arr ?? null;
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) {
    out.push(arr[i]);
  }
  return out;
}

async function refreshTokenIfNeeded(
  admin: Admin,
  device: Record<string, unknown>
): Promise<string | null> {
  const expiresAt = new Date(device.token_expires_at as string).getTime();
  const now = Date.now();

  if (expiresAt > now + 5 * 60 * 1000) {
    return device.access_token as string;
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: device.refresh_token,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();

  await admin.from("devices").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(data.expires_at * 1000).toISOString(),
  }).eq("id", device.id);

  return data.access_token as string;
}

interface ParsedBody {
  activity_id: string;  // uuid (internal PK in strava_activities)
  athlete_id: string;   // uuid
}

function parseBody(raw: unknown): ParsedBody | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const activity_id = typeof obj.activity_id === "string" ? obj.activity_id : null;
  const athlete_id = typeof obj.athlete_id === "string" ? obj.athlete_id : null;
  if (!activity_id || !athlete_id) return null;
  return { activity_id, athlete_id };
}

// Auth resolution:
// - If service_role key is provided in Authorization, bypass user check.
// - Else validate user JWT and ensure athlete_id matches the caller.
async function authorize(req: Request, athleteIdFromBody: string): Promise<{ ok: true; isServiceRole: boolean } | { ok: false; status: number; code: string; message: string }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, status: 401, code: "unauthorized", message: "Missing Authorization header" };
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) {
    return { ok: true, isServiceRole: true };
  }

  const client = getAnonClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, code: "unauthorized", message: "Invalid JWT" };
  }
  if (data.user.id !== athleteIdFromBody) {
    return { ok: false, status: 403, code: "forbidden", message: "athlete_id mismatch with caller" };
  }
  return { ok: true, isServiceRole: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, code: "method_not_allowed", message: "Use POST" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return respond(400, { ok: false, code: "bad_request", message: "Invalid JSON body" });
  }

  const body = parseBody(raw);
  if (!body) {
    return respond(400, {
      ok: false,
      code: "bad_request",
      message: "Missing activity_id (number) or athlete_id (uuid)",
    });
  }

  const auth = await authorize(req, body.athlete_id);
  if (!auth.ok) {
    return respond(auth.status, { ok: false, code: auth.code, message: auth.message });
  }

  const admin = getAdminClient();

  logEvent("strava.streams.fetch_started", {
    activity_id: body.activity_id,
    athlete_id: body.athlete_id,
  });

  // 1. Check if already cached
  const { data: existingStream } = await admin
    .from("strava_activity_streams")
    .select("activity_id, source")
    .eq("activity_id", body.activity_id)
    .maybeSingle();

  if (existingStream) {
    return respond(200, { ok: true, cached: true });
  }

  // Also short-circuit if the activity is marked has_streams=true but row is somehow missing (unlikely)
  const { data: activityRow } = await admin
    .from("strava_activities")
    .select("id, athlete_id, strava_id, moving_time, has_streams")
    .eq("id", body.activity_id)
    .maybeSingle();

  if (!activityRow) {
    return respond(404, { ok: false, code: "activity_not_found", message: "Activity not in database" });
  }

  if (activityRow.athlete_id !== body.athlete_id) {
    return respond(403, { ok: false, code: "forbidden", message: "Activity does not belong to athlete" });
  }

  if (activityRow.has_streams) {
    return respond(200, { ok: true, cached: true });
  }

  const stravaId = activityRow.strava_id as number | null;
  if (!stravaId) {
    return respond(400, { ok: false, code: "missing_strava_id", message: "Activity has no strava_id" });
  }

  // 2. Get athlete tokens from devices
  const { data: device } = await admin
    .from("devices")
    .select("*")
    .eq("athlete_id", body.athlete_id)
    .eq("device_type", "strava")
    .maybeSingle();

  if (!device || !device.access_token) {
    return respond(401, { ok: false, code: "unauthorized", message: "Strava not connected" });
  }

  const accessToken = await refreshTokenIfNeeded(admin, device);
  if (!accessToken) {
    return respond(401, { ok: false, code: "unauthorized", message: "Token refresh failed" });
  }

  // 3. Fetch the streams
  const stravaStreamsUrl =
    `${STRAVA_API_BASE}/activities/${stravaId}/streams?keys=${STREAM_KEYS.join(",")}&key_by_type=true`;

  const res = await fetch(stravaStreamsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Rate-limit back-off
  const usageHeader = res.headers.get("X-RateLimit-Usage");
  const limitHeader = res.headers.get("X-RateLimit-Limit");
  if (usageHeader && limitHeader) {
    const [shortUsage] = usageHeader.split(",").map((n) => parseInt(n.trim(), 10));
    const [shortLimit] = limitHeader.split(",").map((n) => parseInt(n.trim(), 10));
    if (shortLimit && shortUsage / shortLimit > 0.8) {
      logEvent("strava.streams.rate_limit_warning", {
        usage: shortUsage,
        limit: shortLimit,
      });
    }
  }

  if (res.status === 404) {
    await admin
      .from("strava_activities")
      .update({ has_streams: false })
      .eq("id", body.activity_id);
    logEvent("strava.streams.fetch_failed", {
      activity_id: body.activity_id,
      reason: "no_streams",
      status: 404,
    });
    return respond(200, { ok: false, reason: "no_streams" });
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    logEvent("strava.streams.fetch_failed", {
      activity_id: body.activity_id,
      reason: "rate_limited",
      retry_after: retryAfter,
    });
    return respond(429, { ok: false, reason: "rate_limited", retry_after: retryAfter });
  }

  if (res.status === 401) {
    logEvent("strava.streams.fetch_failed", {
      activity_id: body.activity_id,
      reason: "unauthorized",
      status: 401,
    });
    return respond(401, { ok: false, reason: "unauthorized" });
  }

  if (!res.ok) {
    logEvent("strava.streams.fetch_failed", {
      activity_id: body.activity_id,
      reason: "upstream_error",
      status: res.status,
    });
    return respond(502, { ok: false, reason: "upstream_error", status: res.status });
  }

  type StreamPayload = Record<string, { data?: unknown[]; original_size?: number; resolution?: string }>;
  const payload = await res.json() as StreamPayload;

  // 4. Extract each stream's data (already key_by_type)
  const rawStreams: Record<string, unknown[] | null> = {};
  for (const key of STREAM_KEYS) {
    const entry = payload[key];
    rawStreams[key] = Array.isArray(entry?.data) ? entry!.data! : null;
  }

  // 5. Downsample when the activity is long (> 1h)
  const movingTime = (activityRow.moving_time as number) || 0;
  const shouldDownsample = movingTime > DURATION_DOWNSAMPLE_THRESHOLD_SECONDS;
  const finalStreams: Record<string, unknown[] | null> = {};
  for (const key of STREAM_KEYS) {
    const arr = rawStreams[key];
    finalStreams[key] = shouldDownsample ? downsampleArray(arr, TARGET_SAMPLES) : arr;
  }

  // 6. Sanity check — reject if serialized payload exceeds the row-size budget
  const serialized = JSON.stringify(finalStreams);
  if (serialized.length > MAX_SERIALIZED_BYTES) {
    // Force more aggressive downsampling
    for (const key of STREAM_KEYS) {
      finalStreams[key] = downsampleArray(finalStreams[key] ?? null, Math.floor(TARGET_SAMPLES / 2));
    }
  }

  // 7. Upsert streams row
  const upsertRow = {
    activity_id: body.activity_id,
    athlete_id: body.athlete_id,
    time: finalStreams.time ?? null,
    distance: finalStreams.distance ?? null,
    velocity_smooth: finalStreams.velocity_smooth ?? null,
    heartrate: finalStreams.heartrate ?? null,
    cadence: finalStreams.cadence ?? null,
    altitude: finalStreams.altitude ?? null,
    grade_smooth: finalStreams.grade_smooth ?? null,
    temp: finalStreams.temp ?? null,
    moving: finalStreams.moving ?? null,
    fetched_at: new Date().toISOString(),
    source: "strava",
  };

  const { error: upsertErr } = await admin
    .from("strava_activity_streams")
    .upsert(upsertRow, { onConflict: "activity_id" });

  if (upsertErr) {
    logEvent("strava.streams.upsert_failed", {
      activity_id: body.activity_id,
      error: upsertErr.message,
    });
    return respond(500, { ok: false, code: "upsert_failed", message: upsertErr.message });
  }

  // 8. Flip has_streams
  await admin
    .from("strava_activities")
    .update({ has_streams: true })
    .eq("id", body.activity_id);

  const sampleCount = (finalStreams.time as unknown[] | null)?.length ?? 0;
  logEvent("strava.streams.fetch_ok", {
    activity_id: body.activity_id,
    samples: sampleCount,
    downsampled: shouldDownsample,
  });

  return respond(200, { ok: true, cached: false, samples: sampleCount });
});
