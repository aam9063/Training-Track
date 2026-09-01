import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * strava-proxy: Proxies Strava API requests for coaches.
 * Coaches can request athlete Strava data without seeing tokens.
 * Tokens stay server-side (service_role reads devices table).
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller's JWT and get their user ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const coachId = user.id;
    const { athlete_id, endpoint, params } = await req.json();

    if (!athlete_id || !endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing athlete_id or endpoint" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify active coach-athlete relationship
    const { data: rel, error: relError } = await adminClient
      .from("coach_athlete_relationship")
      .select("id")
      .eq("coach_id", coachId)
      .eq("athlete_id", athlete_id)
      .eq("status", "active")
      .single();

    if (relError || !rel) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this athlete" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get athlete's Strava tokens (service_role bypasses RLS)
    const { data: device, error: deviceError } = await adminClient
      .from("devices")
      .select("access_token, refresh_token, token_expires_at, strava_athlete_id")
      .eq("athlete_id", athlete_id)
      .eq("device_type", "strava")
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: "Athlete not connected to Strava" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refresh token if expired
    let accessToken = device.access_token;
    const tokenExpiresAt = new Date(device.token_expires_at).getTime();

    if (tokenExpiresAt <= Date.now() + 300000) {
      const clientId = Deno.env.get("STRAVA_CLIENT_ID")!;
      const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET")!;

      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: device.refresh_token,
        }),
      });

      if (!refreshRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Strava token" }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;

      // Update tokens in DB
      await adminClient
        .from("devices")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          token_expires_at: new Date(
            refreshData.expires_at * 1000
          ).toISOString(),
        })
        .eq("athlete_id", athlete_id)
        .eq("device_type", "strava");
    }

    // Allowed endpoints (whitelist to prevent abuse)
    const allowedEndpoints: Record<string, string> = {
      activities: "/athlete/activities",
      activity_detail: "/activities/", // needs activityId appended
    };

    let stravaUrl: string;

    if (endpoint === "activities") {
      const queryParams = new URLSearchParams();
      if (params?.before) queryParams.append("before", params.before);
      if (params?.after) queryParams.append("after", params.after);
      queryParams.append("page", params?.page || "1");
      queryParams.append("per_page", params?.per_page || "10");
      stravaUrl = `https://www.strava.com/api/v3/athlete/activities?${queryParams}`;
    } else if (endpoint === "activity_detail" && params?.activity_id) {
      stravaUrl = `https://www.strava.com/api/v3/activities/${params.activity_id}?include_all_efforts=true`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid endpoint" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Proxy the request to Strava
    const stravaRes = await fetch(stravaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const stravaData = await stravaRes.json();

    return new Response(JSON.stringify(stravaData), {
      status: stravaRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
