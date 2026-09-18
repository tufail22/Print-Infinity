import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      print_job_id,
      customer_token,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = body;

    if (!print_job_id) {
      return NextResponse.json({ error: "Missing print_job_id" }, { status: 400 });
    }

    // 1. Cryptographic HMAC-SHA256 signature verification if signature is provided
    if (razorpay_signature && razorpay_order_id && razorpay_payment_id) {
      if (RAZORPAY_KEY_SECRET) {
        const expectedSig = crypto
          .createHmac("sha256", RAZORPAY_KEY_SECRET)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest("hex");

        const sigBuf = Buffer.from(razorpay_signature);
        const expBuf = Buffer.from(expectedSig);

        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          console.error("[payment/verify] Invalid signature provided");
          return NextResponse.json(
            { error: "Invalid payment signature verification failed" },
            { status: 400 }
          );
        }
      }
    }

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabaseAdmin = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: customer_token ? { "x-customer-token": customer_token } : {},
      },
    });

    // 2. Verify job exists
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("print_jobs")
      .select("id, status, customer_token")
      .eq("id", print_job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Print job not found" }, { status: 404 });
    }

    // Check token if provided
    if (customer_token && job.customer_token && job.customer_token !== customer_token) {
      return NextResponse.json({ error: "Invalid customer token" }, { status: 403 });
    }

    // 3. Use security definer RPC to safely verify payment and advance job status to pending_approval
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      "verify_payment_and_advance_job",
      {
        p_print_job_id: print_job_id,
        p_customer_token: customer_token || null,
        p_gateway_ref: razorpay_payment_id || razorpay_order_id || "VERIFIED_CLIENT",
      }
    );

    if (rpcErr || !rpcResult?.success) {
      console.error("[payment/verify] RPC error:", rpcErr || rpcResult?.error);
      return NextResponse.json(
        { error: rpcErr?.message || rpcResult?.error || "Failed to advance job status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: rpcResult.job,
      message: "Payment verified successfully. Job queued for storekeeper.",
    });
  } catch (err: any) {
    console.error("[payment/verify] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
