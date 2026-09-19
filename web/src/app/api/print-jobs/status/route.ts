import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { print_job_id, new_status, rejection_reason } = body;

    if (!print_job_id || !new_status) {
      return NextResponse.json(
        { error: "print_job_id and new_status are required" },
        { status: 400 }
      );
    }

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false },
    });

    if (new_status === "approved") {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("approve_print_job", {
        p_print_job_id: print_job_id,
        p_rejection_reason: rejection_reason || null,
      });

      if (rpcErr || (rpcRes && !rpcRes.success)) {
        return NextResponse.json(
          { error: rpcErr?.message || rpcRes?.error || "Failed to approve job" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        job: rpcRes.job,
      });
    }

    const updatePayload: Record<string, any> = {
      status: new_status,
      updated_at: new Date().toISOString(),
    };

    if (rejection_reason) {
      updatePayload.rejection_reason = rejection_reason;
    }

    const { data: job, error: jobErr } = await supabase
      .from("print_jobs")
      .update(updatePayload)
      .eq("id", print_job_id)
      .select()
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: jobErr?.message || "Failed to update print job status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
