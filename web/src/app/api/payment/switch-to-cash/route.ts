import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export async function POST(req: NextRequest) {
  try {
    const { print_job_id, customer_token } = await req.json();

    if (!print_job_id || !customer_token) {
      return NextResponse.json(
        { error: "Missing required parameters: print_job_id and customer_token" },
        { status: 400 }
      );
    }

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { "x-customer-token": customer_token },
      },
    });

    // 1. Verify job ownership and current state
    const { data: job, error: jobErr } = await supabase
      .from("print_jobs")
      .select("id, store_id, status, customer_token")
      .eq("id", print_job_id)
      .eq("customer_token", customer_token)
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Print job not found or unauthorized token" },
        { status: 404 }
      );
    }

    if (job.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Job is already in status '${job.status}', cannot switch payment mode.` },
        { status: 400 }
      );
    }

    // 2. Update job status to pending_approval for counter cash verification
    const { data: updatedJob, error: updateErr } = await supabase
      .from("print_jobs")
      .update({
        status: "pending_approval",
      })
      .eq("id", print_job_id)
      .select()
      .single();

    if (updateErr || !updatedJob) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update job status" },
        { status: 500 }
      );
    }

    // 3. Update payment record to cash
    await supabase
      .from("payments")
      .update({
        method: "cash",
        gateway_ref: "CASH_COUNTER",
      })
      .eq("print_job_id", print_job_id);

    return NextResponse.json({
      success: true,
      job: updatedJob,
    });
  } catch (err: any) {
    console.error("[switch-to-cash] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to switch payment method" },
      { status: 500 }
    );
  }
}
