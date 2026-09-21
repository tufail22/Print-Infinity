import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export async function POST(req: NextRequest) {
  try {
    // 1. Mandatory Storekeeper Authentication Guard
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Bearer token missing." },
        { status: 401 }
      );
    }

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Invalid or expired storekeeper session." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { print_job_id, new_status, rejection_reason } = body;

    if (!print_job_id || !new_status) {
      return NextResponse.json(
        { error: "print_job_id and new_status are required" },
        { status: 400 }
      );
    }

    // 2. Verify storekeeper ownership of the store matching this print job
    const { data: storekeeper, error: skErr } = await supabase
      .from("storekeepers")
      .select("store_id")
      .eq("id", user.id)
      .single();

    if (skErr || !storekeeper) {
      return NextResponse.json(
        { error: "Forbidden: Authenticated user is not registered as a storekeeper." },
        { status: 403 }
      );
    }

    const { data: jobRecord, error: jobFetchErr } = await supabase
      .from("print_jobs")
      .select("id, store_id, status")
      .eq("id", print_job_id)
      .single();

    if (jobFetchErr || !jobRecord) {
      return NextResponse.json({ error: "Print job not found." }, { status: 404 });
    }

    if (jobRecord.store_id !== storekeeper.store_id) {
      return NextResponse.json(
        { error: "Forbidden: This print job does not belong to your store." },
        { status: 403 }
      );
    }

    // 3. Status transition execution
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
