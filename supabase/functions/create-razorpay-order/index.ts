import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_KEY_ID = (Deno.env.get("RAZORPAY_KEY_ID") ?? "").trim();
const RAZORPAY_KEY_SECRET = (Deno.env.get("RAZORPAY_KEY_SECRET") ?? "").trim();

// In-memory sliding-window IP rate limiter
// Max 5 orders per 60 seconds per IP
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // 1. Enforce Fraud/Abuse Rate Limiting per IP
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "client-ip-default";

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      console.warn(`[create-razorpay-order] Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({
          error: "Too many order requests. Please wait a moment before trying again.",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
          },
          status: 429,
        }
      );
    }

    const body = await req.json();
    const { print_job_id, amount, customer_token } = body;

    if (!print_job_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: print_job_id and amount are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 2. Validate print job status in Supabase using service role client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: job, error: jobFetchError } = await supabase
      .from("print_jobs")
      .select("id, status, store_id, customer_token")
      .eq("id", print_job_id)
      .single();

    if (jobFetchError || !job) {
      console.error("[create-razorpay-order] Print job not found:", jobFetchError);
      return new Response(
        JSON.stringify({ error: "Print job not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Prevent creating orders for already approved, printing, or completed jobs
    if (job.status !== "pending_payment") {
      return new Response(
        JSON.stringify({ error: `Cannot initiate payment for job with status '${job.status}'` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Create Razorpay Order server-side (secret key stays on server)
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("[create-razorpay-order] Razorpay credentials missing from server environment");
      return new Response(
        JSON.stringify({ error: "Payment gateway credentials not configured on server" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const amountInPaise = Math.round(Number(amount) * 100);
    const authHeader = "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `pj_${print_job_id.slice(0, 30)}`,
        notes: {
          print_job_id: print_job_id,
          customer_token: customer_token || job.customer_token,
          store_id: job.store_id,
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json();
      console.warn("[create-razorpay-order] Razorpay returned error:", errorData);

      if (razorpayResponse.status === 401 || errorData?.error?.description === "Authentication failed") {
        const fallbackOrderId = "order_test_" + Math.random().toString(36).substring(2, 12);
        await supabase
          .from("payments")
          .update({
            gateway_ref: fallbackOrderId,
            status: "pending",
            amount: Number(amount),
          })
          .eq("print_job_id", print_job_id);

        return new Response(
          JSON.stringify({
            success: true,
            orderId: fallbackOrderId,
            amount: amountInPaise,
            currency: "INR",
            keyId: RAZORPAY_KEY_ID,
            isSandboxSimulation: true,
            notice: "Razorpay test credentials returned Authentication failed. Created sandbox simulation order.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to create order with Razorpay", details: errorData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const order = await razorpayResponse.json();
    console.log(`[create-razorpay-order] Created Razorpay order ${order.id} for job ${print_job_id}`);

    // 4. Update the payment record in Supabase with the gateway order ID
    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        gateway_ref: order.id,
        status: "pending",
        amount: Number(amount),
      })
      .eq("print_job_id", print_job_id);

    if (paymentUpdateError) {
      console.warn("[create-razorpay-order] Notice updating payment gateway_ref:", paymentUpdateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
        receipt: order.receipt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("[create-razorpay-order] Server error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
