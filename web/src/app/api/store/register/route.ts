import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, store_name, address, bw_price = 3.0, color_price = 10.0 } = body;

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!store_name || typeof store_name !== "string" || store_name.trim().length === 0) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }

    const clientKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, clientKey, {
      auth: { persistSession: false },
    });

    // Call security definer RPC
    const { data: result, error: rpcErr } = await supabase.rpc("register_new_store", {
      p_user_id: user_id,
      p_store_name: store_name.trim(),
      p_store_address: address ? address.trim() : null,
      p_bw_price: Number(bw_price) || 3.0,
      p_color_price: Number(color_price) || 10.0,
    });

    if (rpcErr || !result?.success) {
      console.error("[api/store/register] Error:", rpcErr || result?.error);
      return NextResponse.json(
        { error: rpcErr?.message || result?.error || "Failed to register store" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      store: result.store,
      store_id: result.store_id,
    });
  } catch (err: any) {
    console.error("[api/store/register] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
