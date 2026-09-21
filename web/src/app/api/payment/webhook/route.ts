import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";

export async function POST(req: NextRequest) {
  try {
    const RAZORPAY_WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET not configured on server");
      return NextResponse.json(
        { error: "Webhook secret not configured on server. Set RAZORPAY_WEBHOOK_SECRET." },
        { status: 500 }
      );
    }

    const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[webhook] SUPABASE_SERVICE_ROLE_KEY not configured on server");
      return NextResponse.json(
        { error: "Database service key not configured on server. Set SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // 1. Strict HMAC-SHA256 signature verification
    if (!signature) {
      console.warn("[webhook] Missing x-razorpay-signature header");
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      console.error("[webhook] Signature mismatch");
      return NextResponse.json({ error: "Invalid signature verification failed" }, { status: 401 });
    }

    console.log("[webhook] Signature verified successfully via HMAC-SHA256.");

    // 2. Parse payload & extract entities
    const payload = JSON.parse(rawBody);
    const event = payload.event || "payment.captured";
    const paymentEntity = payload.payload?.payment?.entity || payload.payment || {};

    const razorpayPaymentId = paymentEntity.id || payload.payment_id || null;
    const razorpayOrderId = paymentEntity.order_id || payload.order_id || null;
    const printJobId =
      paymentEntity.notes?.print_job_id ||
      payload.notes?.print_job_id ||
      payload.print_job_id ||
      null;

    const validEvents = ["payment.captured", "order.paid", "payment_link.paid"];
    if (payload.event && !validEvents.includes(payload.event)) {
      return NextResponse.json({ message: "Event ignored", event: payload.event }, { status: 200 });
    }

    // 3. Update database using admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let paymentQuery = supabaseAdmin.from("payments").select("id, print_job_id, status, gateway_ref");

    if (razorpayOrderId) {
      paymentQuery = paymentQuery.eq("gateway_ref", razorpayOrderId);
    } else if (printJobId) {
      paymentQuery = paymentQuery.eq("print_job_id", printJobId);
    } else if (razorpayPaymentId) {
      paymentQuery = paymentQuery.eq("gateway_ref", razorpayPaymentId);
    }

    const { data: payments, error: paymentLookupError } = await paymentQuery;

    if (paymentLookupError || !payments || payments.length === 0) {
      return NextResponse.json({ error: "Payment record not found for webhook" }, { status: 404 });
    }

    const payment = payments[0];
    const targetJobId = payment.print_job_id;

    // 4. Set payments.status = 'verified'
    await supabaseAdmin
      .from("payments")
      .update({
        status: "verified",
        gateway_ref: razorpayPaymentId || payment.gateway_ref,
      })
      .eq("id", payment.id);

    // 5. Set print_jobs.status = 'pending_approval' (ONLY if still awaiting payment)
    // Guard against race conditions where delayed webhooks arrive after storekeeper has already approved/printed
    const { data: updatedJob } = await supabaseAdmin
      .from("print_jobs")
      .update({
        status: "pending_approval",
      })
      .eq("id", targetJobId)
      .eq("status", "pending_payment")
      .select("id, status")
      .maybeSingle();

    console.log(
      `[webhook] SUCCESS: Verified payment ${payment.id}. Job ${targetJobId} status updated: ${updatedJob ? "pending_approval" : "retained existing progressive status"}.`
    );

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      paymentId: payment.id,
      printJobId: targetJobId,
      newJobStatus: "pending_approval",
    });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
