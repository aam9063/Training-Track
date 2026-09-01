import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * cleanup-gym-files: Deletes expired gym files from storage and database.
 * Secured via CRON_SECRET header (called from pg_cron or external scheduler).
 * verify_jwt: false — but validates a shared secret instead.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate secret header to prevent unauthorized invocation
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find expired files
    const { data: expiredFiles, error: fetchError } = await adminClient
      .from("gym_files")
      .select("id, storage_path")
      .lt("expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired files to clean up", count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Delete from storage
    const storagePaths = expiredFiles.map((f) => f.storage_path);
    const { error: storageError } = await adminClient.storage
      .from("gym-files")
      .remove(storagePaths);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete from database
    const ids = expiredFiles.map((f) => f.id);
    const { error: dbError } = await adminClient
      .from("gym_files")
      .delete()
      .in("id", ids);

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({
        message: `Cleaned up ${expiredFiles.length} expired files`,
        count: expiredFiles.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
