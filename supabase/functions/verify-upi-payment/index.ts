import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface UpiWebhookPayload {
  // Generic webhook payload contract supporting standard UPI gateway callbacks
  event?: string;
  payment_id?: string;
  gateway_ref?: string;
  print_job_id?: string;
  order_id?: string;
  amount?: number;
  status?: "success" | "captured" | "paid" | string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        notes?: {
          print_job_id?: string;
        };
      };
    };
  };
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
    const headers = req.headers;

    // =========================================================================
    // TODO [Phase 3]: Implement Gateway-Specific Signature Verification
    // -------------------------------------------------------------------------
    // Provide the gateway webhook secret in Phase 3 environment variables:
    // e.g., Deno.env.get("UPI_GATEWAY_WEBHOOK_SECRET")
    //
    // Razorpay example:
    // const signature = headers.get("x-razorpay-signature");
    // const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
    // if (signature !== expectedSignature) {
    //   return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    // }
    //
    // Cashfree / PhonePe / Paytm: verify respective HMAC/SHA256 signature header.
    // =========================================================================
    console.log("[verify-upi-payment] Webhook received. Signature verification deferred to Phase 3 credentials.");

    const payload: UpiWebhookPayload = rawBody ? JSON.parse(rawBody) : {};

    // Extract identifier fields from common gateway payload structures
    const gatewayRef =
      payload.gateway_ref ||
      payload.payment_id ||
      payload.payload?.payment?.entity?.id ||
      null;

    const printJobId =
      payload.print_job_id ||
      payload.payload?.payment?.entity?.notes?.print_job_id ||
      null;

    if (!gatewayRef && !printJobId) {
      return new Response(
        JSON.stringify({
          error: "Missing payment identifiers (gateway_ref or print_job_id required)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase admin client to bypass RLS for webhook updates
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Locate the payment record
    let paymentQuery = supabase.from("payments").select("id, print_job_id, status");
    if (gatewayRef) {
      paymentQuery = paymentQuery.eq("gateway_ref", gatewayRef);
    } else if (printJobId) {
      paymentQuery = paymentQuery.eq("print_job_id", printJobId);
    }

    const { data: payments, error: paymentLookupError } = await paymentQuery;

    if (paymentLookupError || !payments || payments.length === 0) {
      console.error("[verify-upi-payment] Matching payment row not found:", paymentLookupError);
      return new Response(
        JSON.stringify({ error: "Payment record not found for webhook payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const payment = payments[0];
    const targetJobId = payment.print_job_id;

    // 2. Update matching payments row to 'verified'
    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "verified",
        gateway_ref: gatewayRef ?? undefined,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      console.error("[verify-upi-payment] Failed to update payment status:", paymentUpdateError);
      throw paymentUpdateError;
    }

    // 3. Update matching print_job to 'pending_approval' (ready for Storekeeper)
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
      `[verify-upi-payment] Successfully verified payment ${payment.id}. Job ${targetJobId} moved to 'pending_approval'.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
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
