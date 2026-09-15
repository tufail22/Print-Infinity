import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const nowIso = new Date().toISOString();

    // 1. Fetch expired print jobs that still reference storage or have not completed
    const { data: expiredJobs, error: fetchError } = await supabase
      .from("print_jobs")
      .select("id, status, storage_path, storage_expires_at")
      .lt("storage_expires_at", nowIso)
      .or("status.neq.completed,storage_path.not.is.null");

    if (fetchError) {
      console.error("[cleanup-expired-uploads] Error fetching expired jobs:", fetchError);
      throw fetchError;
    }

    const filesToRemove: string[] = [];
    const jobsToMarkExpired: string[] = [];

    for (const job of expiredJobs ?? []) {
      if (job.storage_path) {
        filesToRemove.push(job.storage_path);
      }
      if (job.status !== "completed" && job.status !== "expired") {
        jobsToMarkExpired.push(job.id);
      }
    }

    // 2. Delete storage files from the private 'print-uploads' bucket
    let deletedFilesCount = 0;
    if (filesToRemove.length > 0) {
      const { data: removedFiles, error: storageError } = await supabase
        .storage
        .from("print-uploads")
        .remove(filesToRemove);

      if (storageError) {
        console.error("[cleanup-expired-uploads] Error deleting storage files:", storageError);
      } else {
        deletedFilesCount = removedFiles?.length ?? filesToRemove.length;
        console.log(`[cleanup-expired-uploads] Removed ${deletedFilesCount} files from print-uploads.`);
      }
    }

    // 3. Mark uncompleted jobs as 'expired'
    let updatedJobsCount = 0;
    if (jobsToMarkExpired.length > 0) {
      const { data: updatedJobs, error: updateError } = await supabase
        .from("print_jobs")
        .update({
          status: "expired",
          storage_path: null, // Wipe storage reference to uphold zero-disk/zero-retention
        })
        .in("id", jobsToMarkExpired)
        .select("id");

      if (updateError) {
        console.error("[cleanup-expired-uploads] Error updating job statuses:", updateError);
        throw updateError;
      }
      updatedJobsCount = updatedJobs?.length ?? jobsToMarkExpired.length;
    }

    const result = {
      success: true,
      timestamp: nowIso,
      expiredJobsFound: expiredJobs?.length ?? 0,
      filesDeleted: deletedFilesCount,
      jobsMarkedExpired: updatedJobsCount,
    };

    console.log("[cleanup-expired-uploads] Run complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[cleanup-expired-uploads] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
