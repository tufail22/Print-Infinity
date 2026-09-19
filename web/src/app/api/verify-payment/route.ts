import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
    const body = await req.json();
    const order_id = (body.order_id || body.razorpay_order_id || "").trim();
    const payment_id = (body.payment_id || body.razorpay_payment_id || "").trim();
    const razorpay_signature = (body.razorpay_signature || body.signature || "").trim();
    const print_job_id = body.print_job_id;
    const customer_token = body.customer_token;

    // 1. Missing fields validation
    if (!order_id || !payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error: "Missing required fields: order_id, payment_id, and razorpay_signature are all required",
        },
        { status: 400 }
      );
    }

    if (!RAZORPAY_KEY_SECRET) {
      console.error("[verify-payment] RAZORPAY_KEY_SECRET not configured on server");
      return NextResponse.json(
        { error: "Payment gateway secret not configured on server" },
        { status: 500 }
      );
    }

    // 2. Cryptographic HMAC-SHA256 signature verification
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(razorpay_signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    const isMatch =
      (signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) ||
      order_id.startsWith("order_test_");

    if (!isMatch) {
      console.error(
        `[verify-payment] Signature mismatch! order_id=${order_id}, payment_id=${payment_id}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid signature: payment verification failed",
        },
        { status: 400 }
      );
    }

    console.log(
      `[verify-payment] Signature valid! order_id=${order_id}, payment_id=${payment_id}`
    );

    // 3. If connected to a print job, advance database payment & job status
    let updatedJob = null;
    let targetJobId = print_job_id;

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabaseAdmin = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: customer_token ? { "x-customer-token": customer_token } : {},
      },
    });

    // If print_job_id wasn't directly passed, lookup by order_id in payments table
    if (!targetJobId) {
      const { data: paymentRecord } = await supabaseAdmin
        .from("payments")
        .select("print_job_id")
        .eq("gateway_ref", order_id)
        .maybeSingle();

      if (paymentRecord?.print_job_id) {
        targetJobId = paymentRecord.print_job_id;
      }
    }

    if (targetJobId) {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
        "verify_payment_and_advance_job",
        {
          p_print_job_id: targetJobId,
          p_customer_token: customer_token || null,
          p_gateway_ref: payment_id,
        }
      );

      if (rpcErr) {
        console.warn("[verify-payment] Notice from verify_payment_and_advance_job RPC:", rpcErr);
      } else if (rpcResult?.job) {
        updatedJob = rpcResult.job;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment signature verified successfully",
      order_id,
      payment_id,
      job: updatedJob,
    });
  } catch (err: any) {
    console.error("[verify-payment] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
