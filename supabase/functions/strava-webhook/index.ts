import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") || "";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") || "";
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || "trainingtrack_webhook_2025";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Structured log helper — JSON single-line for observability
function logEvent(event: string, payload: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...payload }));
  } catch {
    // no-op
  }
}

// Map Strava activity type to our training_type enum
function mapStravaType(stravaType: string): string {
  const running = ["Run", "TrailRun", "VirtualRun"];
  const gym = ["WeightTraining", "Workout", "CrossFit", "Yoga"];
  if (running.includes(stravaType)) return "running";
  if (gym.includes(stravaType)) return "gym";
  return "cross_training";
}

// Map Strava API activity to our strava_activities row
function mapActivityToRow(athleteId: string, activity: Record<string, unknown>) {
  const map = activity.map as Record<string, unknown> | undefined;
  return {
    athlete_id: athleteId,
    strava_id: activity.id,
    name: activity.name,
    sport_type: activity.sport_type,
    type: activity.type,
    start_date: activity.start_date,
    start_date_local: activity.start_date_local,
    distance: (activity.distance as number) || 0,
    moving_time: (activity.moving_time as number) || 0,
    elapsed_time: (activity.elapsed_time as number) || 0,
    total_elevation_gain: (activity.total_elevation_gain as number) || 0,
    average_speed: activity.average_speed ?? null,
    max_speed: activity.max_speed ?? null,
    average_heartrate: activity.average_heartrate ?? null,
    max_heartrate: activity.max_heartrate ?? null,
    average_cadence: activity.average_cadence ?? null,
    calories: activity.calories ?? null,
    suffer_score: activity.suffer_score ?? null,
    has_heartrate: (activity.has_heartrate as boolean) || false,
    map_summary_polyline: map?.summary_polyline ?? null,
    kudos_count: (activity.kudos_count as number) || 0,
    achievement_count: (activity.achievement_count as number) || 0,
    best_efforts: activity.best_efforts || [],
    has_details: Array.isArray(activity.best_efforts) && (activity.best_efforts as unknown[]).length > 0,
    // Extended columns (strava-deep-ingestion)
    splits_metric: activity.splits_metric ?? null,
    laps: activity.laps ?? null,
    weighted_average_watts: activity.weighted_average_watts ?? null,
    workout_type: activity.workout_type ?? null,
    gear_id: activity.gear_id ?? null,
    device_name: activity.device_name ?? null,
    updated_at: new Date().toISOString(),
  };
}

// Refresh Strava token if expired
async function refreshTokenIfNeeded(
  supabase: SupabaseAdmin,
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

  await supabase.from("devices").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(data.expires_at * 1000).toISOString(),
  }).eq("id", device.id);

  return data.access_token as string;
}

// Send push notification via send-push Edge Function
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url: string,
  tag: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_ids: [userId], title, body, url, tag }),
    });
  } catch {
    // Push notification failed silently
  }
}

// Trigger async streams fetch after activity create — fire-and-forget
function triggerStreamsFetch(activityInternalId: string, athleteId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const task = fetch(`${supabaseUrl}/functions/v1/strava-fetch-streams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ activity_id: activityInternalId, athlete_id: athleteId }),
  }).then(() => {
    logEvent("strava.streams.background_dispatched", { activity_id: activityInternalId });
  }).catch((err) => {
    logEvent("strava.streams.background_dispatch_failed", {
      activity_id: activityInternalId,
      error: String(err),
    });
  });

  try {
    // @ts-ignore EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(task);
  } catch {
    // Fall-through: promise still runs in background
  }
}

// Trigger async training-load recompute after an activity create/update/
// delete — fire-and-forget, mirroring triggerStreamsFetch exactly.
// Satisfies training-load-agent-runtime "Reactive Trigger from
// strava-webhook": zero awaits on the request path, a pre-attached
// .then/.catch prevents an unhandled rejection from tearing down the
// isolate, and a monitor failure/timeout must never affect this
// function's already-sent HTTP response.
function triggerLoadRecalc(athleteId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const task = fetch(`${supabaseUrl}/functions/v1/training-load-monitor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ mode: "athlete", athlete_id: athleteId }),
  }).then(() => {
    logEvent("strava.load_recalc.background_dispatched", { athlete_id: athleteId });
  }).catch((err) => {
    logEvent("strava.load_recalc.background_dispatch_failed", {
      athlete_id: athleteId,
      error: String(err),
    });
  });

  try {
    // @ts-ignore EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(task);
  } catch {
    // Fall-through: promise still runs in background
  }
}

// Locate athlete via devices table by Strava owner_id
async function resolveAthleteByOwnerId(
  supabase: SupabaseAdmin,
  ownerId: number
) {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("strava_athlete_id", ownerId)
    .eq("device_type", "strava")
    .maybeSingle();
  if (error) return null;
  return data;
}

// Fetch + upsert Strava activity detail. Returns the upserted internal row.
async function fetchAndUpsertActivity(
  supabase: SupabaseAdmin,
  device: Record<string, unknown>,
  stravaId: number
): Promise<{ internalId: string | null; activity: Record<string, unknown> | null }> {
  const athleteId = device.athlete_id as string;
  const accessToken = await refreshTokenIfNeeded(supabase, device);
  if (!accessToken) return { internalId: null, activity: null };

  const activityRes = await fetch(`${STRAVA_API_BASE}/activities/${stravaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!activityRes.ok) {
    logEvent("strava.webhook.fetch_activity_failed", { strava_id: stravaId, status: activityRes.status });
    return { internalId: null, activity: null };
  }

  const activity = await activityRes.json();
  const row = mapActivityToRow(athleteId, activity);

  const { data: upserted, error: upsertErr } = await supabase
    .from("strava_activities")
    .upsert(row, { onConflict: "athlete_id,strava_id" })
    .select("id")
    .maybeSingle();

  if (upsertErr || !upserted) {
    logEvent("strava.webhook.upsert_failed", { strava_id: stravaId, error: upsertErr?.message });
    return { internalId: null, activity };
  }

  return { internalId: upserted.id as string, activity };
}

// Process a new Strava activity (create)
async function processNewActivity(objectId: number, ownerId: number) {
  const supabase = getSupabaseAdmin();

  const device = await resolveAthleteByOwnerId(supabase, ownerId);
  if (!device) {
    logEvent("strava.webhook.device_not_found", { owner_id: ownerId });
    return;
  }

  const athleteId = device.athlete_id as string;
  const { internalId, activity } = await fetchAndUpsertActivity(supabase, device, objectId);
  if (!internalId || !activity) return;

  logEvent("strava.webhook.activity_upserted", {
    athlete_id: athleteId,
    strava_id: objectId,
    action: "created",
  });

  // Kick off streams fetch in background (non-blocking)
  triggerStreamsFetch(internalId, athleteId);

  // Kick off training-load recompute in background (non-blocking)
  triggerLoadRecalc(athleteId);

  // Match to planned training session
  const trainingType = mapStravaType(activity.type as string);
  const activityDate = (activity.start_date_local as string).split("T")[0];

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, status, strava_activity_id")
    .eq("athlete_id", athleteId)
    .eq("scheduled_date", activityDate)
    .eq("training_type", trainingType)
    .eq("status", "planned")
    .is("strava_activity_id", null)
    .limit(1);

  const distanceKm = ((activity.distance as number) / 1000);
  const durationMinutes = Math.round((activity.moving_time as number) / 60);

  if (sessions && sessions.length > 0) {
    const session = sessions[0];

    const { error: updateErr } = await supabase
      .from("training_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        actual_duration_minutes: durationMinutes,
        actual_distance_km: Math.round(distanceKm * 10) / 10,
        strava_activity_id: objectId,
      })
      .eq("id", session.id);

    if (!updateErr) {
      const { data: user } = await supabase
        .from("users")
        .select("is_independent")
        .eq("id", athleteId)
        .single();

      const pushUrl = user?.is_independent ? "/athlete/my-plan" : "/athlete/training";

      await sendPushNotification(
        athleteId,
        "Actividad registrada",
        `Tu actividad de ${distanceKm.toFixed(1)} km se ha registrado. ¡Indica tu RPE!`,
        pushUrl,
        "tt-strava"
      );
    }
  }
}

// Process an updated Strava activity. Compare event_time to stored updated_at.
async function processActivityUpdate(objectId: number, ownerId: number, eventTime: number | undefined) {
  const supabase = getSupabaseAdmin();

  const device = await resolveAthleteByOwnerId(supabase, ownerId);
  if (!device) {
    logEvent("strava.webhook.device_not_found", { owner_id: ownerId });
    return;
  }

  const athleteId = device.athlete_id as string;

  const { data: existing } = await supabase
    .from("strava_activities")
    .select("id, updated_at")
    .eq("athlete_id", athleteId)
    .eq("strava_id", objectId)
    .maybeSingle();

  if (existing && eventTime) {
    const storedMs = new Date(existing.updated_at as string).getTime();
    const eventMs = eventTime * 1000;
    if (eventMs <= storedMs) {
      logEvent("strava.webhook.stale_event", {
        strava_id: objectId,
        event_time: eventTime,
        stored_updated_at: existing.updated_at,
      });
      return;
    }
  }

  if (!existing) {
    // Treat as create
    await processNewActivity(objectId, ownerId);
    return;
  }

  const { internalId } = await fetchAndUpsertActivity(supabase, device, objectId);
  if (internalId) {
    logEvent("strava.webhook.activity_upserted", {
      athlete_id: athleteId,
      strava_id: objectId,
      action: "updated",
    });
    triggerLoadRecalc(athleteId);
  }
}

// Process a deleted Strava activity (soft-delete).
async function processActivityDelete(objectId: number, ownerId: number) {
  const supabase = getSupabaseAdmin();

  const device = await resolveAthleteByOwnerId(supabase, ownerId);
  if (!device) {
    logEvent("strava.webhook.device_not_found", { owner_id: ownerId });
    return;
  }

  const athleteId = device.athlete_id as string;

  const { data: existing } = await supabase
    .from("strava_activities")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("strava_id", objectId)
    .maybeSingle();

  if (!existing) {
    logEvent("strava.webhook.delete_no_row", { strava_id: objectId });
    return;
  }

  const internalId = existing.id as string;

  await supabase
    .from("strava_activities")
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", internalId);

  // Null out training_sessions.strava_activity_id pointing at this activity
  await supabase
    .from("training_sessions")
    .update({ strava_activity_id: null })
    .eq("strava_activity_id", objectId);

  // A deletion changes the load series too — kick off a recompute
  triggerLoadRecalc(athleteId);

  logEvent("strava.webhook.activity_softdeleted", {
    athlete_id: athleteId,
    strava_id: objectId,
  });
}

// Process deauthorize: clear tokens in devices rows for this strava athlete.
async function processDeauthorize(ownerId: number) {
  const supabase = getSupabaseAdmin();

  const { data: clearedRows, error } = await supabase
    .from("devices")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    })
    .eq("strava_athlete_id", ownerId)
    .eq("device_type", "strava")
    .select("id");

  if (error) {
    logEvent("strava.webhook.deauth_failed", { owner_id: ownerId, error: error.message });
    return;
  }

  logEvent("strava.webhook.deauthorized", {
    owner_id: ownerId,
    devices_cleared: clearedRows?.length ?? 0,
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // GET: Strava subscription validation
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && challenge) {
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // POST: Strava event
  if (req.method === "POST") {
    try {
      const event = await req.json();

      const {
        aspect_type,
        object_type,
        object_id,
        owner_id,
        event_time,
        updates,
      } = event as {
        aspect_type?: string;
        object_type?: string;
        object_id?: number;
        owner_id?: number;
        event_time?: number;
        updates?: Record<string, string>;
      };

      logEvent("strava.webhook.received", {
        aspect_type,
        object_type,
        object_id,
        owner_id,
      });

      const dispatchKey = `${object_type}:${aspect_type}`;

      switch (dispatchKey) {
        case "activity:create":
          // @ts-ignore EdgeRuntime.waitUntil
          EdgeRuntime.waitUntil(processNewActivity(object_id!, owner_id!));
          break;

        case "activity:update":
          // @ts-ignore EdgeRuntime.waitUntil
          EdgeRuntime.waitUntil(processActivityUpdate(object_id!, owner_id!, event_time));
          break;

        case "activity:delete":
          // @ts-ignore EdgeRuntime.waitUntil
          EdgeRuntime.waitUntil(processActivityDelete(object_id!, owner_id!));
          break;

        case "athlete:update":
          if (updates?.authorized === "false") {
            // @ts-ignore EdgeRuntime.waitUntil
            EdgeRuntime.waitUntil(processDeauthorize(owner_id!));
          } else {
            logEvent("strava.webhook.athlete_update_ignored", { owner_id, updates });
          }
          break;

        default:
          logEvent("strava.webhook.unknown_event", { dispatch_key: dispatchKey });
          break;
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      logEvent("strava.webhook.parse_error", { error: String(err) });
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
