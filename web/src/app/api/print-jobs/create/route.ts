import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

// In-memory sliding-window IP rate limiter
// Max 5 job creations per 60 seconds per IP
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_PATH_REGEX = /^[a-f0-9\-]{36}\/[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp",
  "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "rtf"
]);

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting Guard
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      console.warn(`[print-jobs/create] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json(
        { error: "Too many print job requests. Please wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const body = await req.json();
    const {
      store_id,
      color_mode,
      copies,
      paper_size,
      duplex,
      storage_path,
      customer_token,
      page_count = 1,
      method = "upi",
      amount,
      gateway_ref,
    } = body;

    // 2. Strict Input Validation & Sanitization
    if (!store_id || !UUID_REGEX.test(store_id)) {
      return NextResponse.json({ error: "Invalid store_id format (UUID expected)" }, { status: 400 });
    }

    if (!customer_token || typeof customer_token !== "string" || customer_token.length < 16 || customer_token.length > 128) {
      return NextResponse.json({ error: "Invalid customer_token length (16-128 characters required)" }, { status: 400 });
    }

    if (color_mode !== "bw" && color_mode !== "color") {
      return NextResponse.json({ error: "Invalid color_mode. Must be 'bw' or 'color'" }, { status: 400 });
    }

    const numCopies = Number(copies);
    if (!Number.isInteger(numCopies) || numCopies < 1 || numCopies > 100) {
      return NextResponse.json({ error: "Copies must be an integer between 1 and 100" }, { status: 400 });
    }

    const numPages = Number(page_count);
    if (!Number.isInteger(numPages) || numPages < 1 || numPages > 2000) {
      return NextResponse.json({ error: "Page count must be an integer between 1 and 2000" }, { status: 400 });
    }

    if (typeof duplex !== "boolean") {
      return NextResponse.json({ error: "Duplex must be a boolean" }, { status: 400 });
    }

    const sanitizedPaperSize = String(paper_size || "A4").trim().slice(0, 32);
    if (!sanitizedPaperSize) {
      return NextResponse.json({ error: "Invalid paper_size" }, { status: 400 });
    }

    if (!storage_path || typeof storage_path !== "string" || !STORAGE_PATH_REGEX.test(storage_path)) {
      return NextResponse.json({ error: "Invalid storage_path format" }, { status: 400 });
    }

    const ext = storage_path.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `File extension .${ext} is not allowed` }, { status: 400 });
    }

    if (method !== "cash" && method !== "upi") {
      return NextResponse.json({ error: "Payment method must be 'cash' or 'upi'" }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0.01 || numAmount > 10000) {
      return NextResponse.json({ error: "Amount must be between 0.01 and 10,000" }, { status: 400 });
    }

    // 3. Database Operations with Supabase Client
    // Use service role if available for reliable server execution, fallback to anon
    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify store exists and is active
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, active")
      .eq("id", store_id)
      .eq("active", true)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Store not found or currently inactive" }, { status: 404 });
    }

    const storageExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // 4. Create print job (always pending_payment initially)
    const { data: job, error: jobErr } = await supabase
      .from("print_jobs")
      .insert({
        store_id,
        status: "pending_payment",
        color_mode,
        copies: numCopies,
        paper_size: sanitizedPaperSize,
        duplex,
        storage_path,
        storage_expires_at: storageExpiresAt,
        customer_token,
      })
      .select()
      .single();

    if (jobErr || !job) {
      console.error("[print-jobs/create] Job insert error:", jobErr);
      return NextResponse.json({ error: jobErr?.message || "Failed to create print job" }, { status: 500 });
    }

    // 5. Create pending payment record
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        print_job_id: job.id,
        method,
        amount: numAmount,
        status: "pending",
        gateway_ref: gateway_ref || (method === "cash" ? "CASH_COUNTER" : "RAZORPAY_INIT"),
      })
      .select()
      .single();

    if (payErr) {
      console.warn("[print-jobs/create] Payment insert notice:", payErr);
    }

    return NextResponse.json({
      success: true,
      job,
      payment,
    });
  } catch (err: any) {
    console.error("[print-jobs/create] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
