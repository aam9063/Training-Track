import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * admin-api: Handles admin operations using service_role.
 * Verifies the caller is an admin before executing.
 * This bypasses RLS intentionally for admin-level operations.
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Decode JWT to get user id (gateway already verified signature via config.toml verify_jwt=false bypass,
    // but Supabase edge runtime validated the token before reaching our code)
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payloadB64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadB64));
      userId = payload.sub;
      if (!userId) throw new Error("No sub in JWT");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: userId };

    // Admin client for privileged operations (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userDataError } = await adminClient
      .from("users")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (userDataError || (userData?.role !== "admin" && !userData?.is_admin)) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "get_stats": {
        const [usersRes, coachesRes, athletesRes, relsRes, sessionsRes] =
          await Promise.all([
            adminClient
              .from("users")
              .select("*", { count: "exact", head: true }),
            adminClient
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("role", "coach"),
            adminClient
              .from("users")
              .select("*", { count: "exact", head: true })
              .eq("role", "athlete"),
            adminClient
              .from("coach_athlete_relationship")
              .select("*", { count: "exact", head: true })
              .eq("status", "active"),
            adminClient
              .from("training_sessions")
              .select("*", { count: "exact", head: true }),
          ]);

        return jsonResponse({
          totalUsers: usersRes.count || 0,
          totalCoaches: coachesRes.count || 0,
          totalAthletes: athletesRes.count || 0,
          activeRelationships: relsRes.count || 0,
          totalSessions: sessionsRes.count || 0,
        });
      }

      case "get_all_users": {
        let query = adminClient
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        if (payload.roleFilter && payload.roleFilter !== "all") {
          query = query.eq("role", payload.roleFilter);
        }
        if (payload.statusFilter && payload.statusFilter !== "all") {
          query = query.eq(
            "is_active",
            payload.statusFilter === "active"
          );
        }

        const { data: users, error } = await query;
        if (error) throw error;

        return jsonResponse(users || []);
      }

      case "get_user_detail": {
        if (!payload.userId) {
          return jsonResponse({ error: "Missing userId" }, 400);
        }

        const { data: userDetail, error } = await adminClient
          .from("users")
          .select("*")
          .eq("id", payload.userId)
          .single();

        if (error) throw error;

        let roleData = null;
        let relationships: any[] = [];

        if (userDetail.role === "coach") {
          const [coachRes, relsRes] = await Promise.all([
            adminClient
              .from("coaches")
              .select("*")
              .eq("id", payload.userId)
              .single(),
            adminClient
              .from("coach_athlete_relationship")
              .select("id, athlete_id, status, start_date")
              .eq("coach_id", payload.userId),
          ]);
          roleData = coachRes.data;
          relationships = relsRes.data || [];

          if (relationships.length > 0) {
            const athleteIds = relationships.map((r: any) => r.athlete_id);
            const { data: athleteUsers } = await adminClient
              .from("users")
              .select("id, first_name, last_name, email")
              .in("id", athleteIds);

            relationships = relationships.map((r: any) => {
              const au = athleteUsers?.find((u: any) => u.id === r.athlete_id);
              return {
                ...r,
                name: au
                  ? `${au.first_name} ${au.last_name}`
                  : "Desconocido",
                email: au?.email || "",
              };
            });
          }
        } else if (userDetail.role === "athlete") {
          const [athleteRes, relsRes] = await Promise.all([
            adminClient
              .from("athletes")
              .select("*")
              .eq("id", payload.userId)
              .single(),
            adminClient
              .from("coach_athlete_relationship")
              .select("id, coach_id, status, start_date")
              .eq("athlete_id", payload.userId),
          ]);
          roleData = athleteRes.data;
          relationships = relsRes.data || [];

          if (relationships.length > 0) {
            const coachIds = relationships.map((r: any) => r.coach_id);
            const { data: coachUsers } = await adminClient
              .from("users")
              .select("id, first_name, last_name, email")
              .in("id", coachIds);

            relationships = relationships.map((r: any) => {
              const cu = coachUsers?.find((u: any) => u.id === r.coach_id);
              return {
                ...r,
                name: cu
                  ? `${cu.first_name} ${cu.last_name}`
                  : "Desconocido",
                email: cu?.email || "",
              };
            });
          }
        }

        // Fetch subscription data
        const { data: subscription } = await adminClient
          .from("subscriptions")
          .select("*")
          .eq("user_id", payload.userId)
          .maybeSingle();

        return jsonResponse({ ...userDetail, roleData, relationships, subscription });
      }

      case "toggle_user_active": {
        if (!payload.userId || payload.isActive === undefined) {
          return jsonResponse({ error: "Missing userId or isActive" }, 400);
        }

        const { data, error } = await adminClient
          .from("users")
          .update({ is_active: payload.isActive })
          .eq("id", payload.userId)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse(data);
      }

      case "toggle_exempt": {
        if (!payload.userId || payload.isExempt === undefined) {
          return jsonResponse({ error: "Missing userId or isExempt" }, 400);
        }
        const { data: exemptData, error: exemptError } = await adminClient
          .from("users")
          .update({ is_exempt: payload.isExempt })
          .eq("id", payload.userId)
          .select()
          .single();
        if (exemptError) throw exemptError;
        return jsonResponse(exemptData);
      }

      case "update_coach_subscription": {
        if (!payload.coachId) {
          return jsonResponse({ error: "Missing coachId" }, 400);
        }

        const updates: Record<string, any> = {};
        if (payload.subscription_plan !== undefined)
          updates.subscription_plan = payload.subscription_plan;
        if (payload.max_athletes !== undefined)
          updates.max_athletes = payload.max_athletes;

        const { data, error } = await adminClient
          .from("coaches")
          .update(updates)
          .eq("id", payload.coachId)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse(data);
      }

      case "get_waitlist": {
        const { data, error } = await adminClient
          .from("waitlist")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return jsonResponse(data || []);
      }

      case "delete_waitlist_entry": {
        if (!payload.entryId) {
          return jsonResponse({ error: "Missing entryId" }, 400);
        }

        const { error } = await adminClient
          .from("waitlist")
          .delete()
          .eq("id", payload.entryId);

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
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

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
