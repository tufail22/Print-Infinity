import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 10-minute payment timeout window in milliseconds
const PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

serve(async (req: Request) => {
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

    const now = new Date();
    const nowIso = now.toISOString();
    const tenMinutesAgoIso = new Date(now.getTime() - PAYMENT_TIMEOUT_MS).toISOString();

    // =========================================================================
    // 1. Fetch Expired Print Jobs:
    //    A) Any job whose storage_expires_at is in the past
    //    B) Any pending_payment job older than 10 minutes
    // =========================================================================
    const { data: expiredJobs, error: fetchError } = await supabase
      .from("print_jobs")
      .select("id, status, storage_path, storage_expires_at, created_at")
      .or(`storage_expires_at.lt.${nowIso},and(status.eq.pending_payment,created_at.lt.${tenMinutesAgoIso})`)
      .neq("status", "completed")
      .neq("status", "expired");

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
      jobsToMarkExpired.push(job.id);
    }

    // =========================================================================
    // 2. Permanently Delete Files from 'print-uploads' Bucket
    // =========================================================================
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

    // =========================================================================
    // 3. Mark Jobs as 'expired' & Wipe Storage References (Zero-Retention)
    // =========================================================================
    let updatedJobsCount = 0;
    if (jobsToMarkExpired.length > 0) {
      const { data: updatedJobs, error: updateError } = await supabase
        .from("print_jobs")
        .update({
          status: "expired",
          storage_path: null,
        })
        .in("id", jobsToMarkExpired)
        .select("id");

      if (updateError) {
        console.error("[cleanup-expired-uploads] Error updating job statuses:", updateError);
        throw updateError;
      }
      updatedJobsCount = updatedJobs?.length ?? jobsToMarkExpired.length;

      // Update associated pending payments to 'failed'
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .in("print_job_id", jobsToMarkExpired)
        .eq("status", "pending");
    }

    const result = {
      success: true,
      timestamp: nowIso,
      tenMinutesAgoThreshold: tenMinutesAgoIso,
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
