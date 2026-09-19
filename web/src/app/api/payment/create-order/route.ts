import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export const dynamic = "force-dynamic";

function getRazorpayCredentials() {
  const keyId = (
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    ""
  ).trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  return { keyId, keySecret };
}

export async function POST(req: NextRequest) {
  try {
    const { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET } = getRazorpayCredentials();
    const body = await req.json();
    const { print_job_id, amount, customer_token } = body;

    if (!print_job_id || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Missing required fields: print_job_id and amount" },
        { status: 400 }
      );
    }

    // Determine paise: If amount < 100, treat as rupees and convert to paise; otherwise treat as paise
    let amountInPaise = Math.round(Number(amount));
    if (amountInPaise < 100) {
      amountInPaise = Math.round(Number(amount) * 100);
    }

    if (amountInPaise < 100) {
      return NextResponse.json(
        { error: "Minimum order amount must be at least 100 paise (₹1.00)" },
        { status: 400 }
      );
    }

    // Check credentials
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Payment gateway credentials not configured on server" },
        { status: 500 }
      );
    }

    // Initialize Razorpay SDK
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    // Helper to race promise against strict timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errMsg)), ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    // Create order via Razorpay SDK with 6s timeout
    let order;
    try {
      order = await withTimeout(
        razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `pj_${print_job_id.slice(0, 30)}`,
          notes: {
            print_job_id: print_job_id,
            customer_token: customer_token || "",
          },
        }),
        6000,
        "Payment gateway request timed out after 6 seconds"
      );
    } catch (rzpErr: any) {
      console.warn("[payment/create-order] Razorpay SDK warning:", rzpErr?.error || rzpErr?.message);
      const statusCode = rzpErr.statusCode || (rzpErr.error?.code === "BAD_REQUEST_ERROR" ? 400 : 500);

      if (RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
        console.log("[payment/create-order] Issuing graceful test sandbox order for development workflow");
        order = {
          id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          amount: amountInPaise,
          currency: "INR",
          receipt: `pj_${print_job_id.slice(0, 30)}`,
        };
      } else {
        if (statusCode === 401 || rzpErr.message?.includes("Authentication")) {
          return NextResponse.json(
            { error: "Razorpay authentication failed. Please check credentials." },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: rzpErr.error?.description || rzpErr.message || "Failed to create Razorpay order" },
          { status: statusCode }
        );
      }
    }

    // Update payments table with gateway_ref = order.id
    try {
      const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const supabaseAdmin = createClient(SUPABASE_URL, clientKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: customer_token ? { "x-customer-token": customer_token } : {},
        },
      });

      await supabaseAdmin
        .from("payments")
        .update({
          gateway_ref: order.id,
          status: "pending",
          amount: amountInPaise / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("print_job_id", print_job_id);
    } catch (dbErr) {
      console.warn("[payment/create-order] Notice updating payment record:", dbErr);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
      keyId: RAZORPAY_KEY_ID,
      receipt: order.receipt,
    });
  } catch (err: any) {
    console.error("[payment/create-order] Internal error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
