import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_WEBHOOK_SECRET =
  Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ||
  Deno.env.get("RAZORPAY_KEY_SECRET") ||
  "yC20q4MkWU01wF6H05gXN9Bq";

/**
 * Constant-time comparison between two hex strings to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Computes HMAC-SHA256 hex digest using native Web Crypto API
 */
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Webhooks must be POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // =========================================================================
    // 1. Strict HMAC-SHA256 Webhook Signature Verification
    // =========================================================================
    if (!signature) {
      console.warn("[verify-upi-payment] Missing x-razorpay-signature header");
      return new Response(
        JSON.stringify({ error: "Missing x-razorpay-signature header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const expectedSignature = await computeHmacSha256(RAZORPAY_WEBHOOK_SECRET, rawBody);

    if (!timingSafeEqual(signature.toLowerCase(), expectedSignature.toLowerCase())) {
      console.error(
        `[verify-upi-payment] Invalid webhook signature. Expected: ${expectedSignature}, Received: ${signature}`
      );
      return new Response(
        JSON.stringify({ error: "Invalid signature verification failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    console.log("[verify-upi-payment] Webhook signature verified successfully via HMAC-SHA256.");

    // =========================================================================
    // 2. Parse & Extract Verified Payment Event
    // =========================================================================
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const event = payload.event || "payment.captured";
    const paymentEntity = payload.payload?.payment?.entity || payload.payment || {};

    const razorpayPaymentId = paymentEntity.id || payload.payment_id || null;
    const razorpayOrderId = paymentEntity.order_id || payload.order_id || null;
    const printJobId =
      paymentEntity.notes?.print_job_id ||
      payload.notes?.print_job_id ||
      payload.print_job_id ||
      null;

    console.log(
      `[verify-upi-payment] Event: ${event} | PaymentId: ${razorpayPaymentId} | OrderId: ${razorpayOrderId} | JobId: ${printJobId}`
    );

    if (!razorpayOrderId && !razorpayPaymentId && !printJobId) {
      return new Response(
        JSON.stringify({ error: "Missing payment identifiers in payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Only process successful capture/paid events
    const validEvents = ["payment.captured", "order.paid", "payment_link.paid"];
    if (payload.event && !validEvents.includes(payload.event)) {
      console.log(`[verify-upi-payment] Ignoring non-payment event: ${payload.event}`);
      return new Response(
        JSON.stringify({ message: "Event ignored", event: payload.event }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // =========================================================================
    // 3. Locate and Transition Payment & Job State via Admin Client
    // =========================================================================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let paymentQuery = supabase.from("payments").select("id, print_job_id, status, gateway_ref");

    if (razorpayOrderId) {
      paymentQuery = paymentQuery.eq("gateway_ref", razorpayOrderId);
    } else if (printJobId) {
      paymentQuery = paymentQuery.eq("print_job_id", printJobId);
    } else if (razorpayPaymentId) {
      paymentQuery = paymentQuery.eq("gateway_ref", razorpayPaymentId);
    }

    const { data: payments, error: paymentLookupError } = await paymentQuery;

    if (paymentLookupError || !payments || payments.length === 0) {
      console.error("[verify-upi-payment] Matching payment record not found:", paymentLookupError);
      return new Response(
        JSON.stringify({ error: "Payment record not found for verified webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const payment = payments[0];
    const targetJobId = payment.print_job_id;

    // 4. Update payment row: status = 'verified'
    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "verified",
        gateway_ref: razorpayPaymentId || payment.gateway_ref,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      console.error("[verify-upi-payment] Failed to update payment status:", paymentUpdateError);
      throw paymentUpdateError;
    }

    // 5. Update print_job row: status = 'pending_approval' (ready for Storekeeper)
    const { error: jobUpdateError } = await supabase
      .from("print_jobs")
      .update({
        status: "pending_approval",
      })
      .eq("id", targetJobId);

    if (jobUpdateError) {
      console.error("[verify-upi-payment] Failed to update print_job status:", jobUpdateError);
      throw jobUpdateError;
    }

    console.log(
      `[verify-upi-payment] SUCCESS: Payment ${payment.id} verified. Job ${targetJobId} moved to 'pending_approval'.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully via webhook",
        paymentId: payment.id,
        printJobId: targetJobId,
        newJobStatus: "pending_approval",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("[verify-upi-payment] Unexpected webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
