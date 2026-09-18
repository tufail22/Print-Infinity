import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

export async function GET(req: NextRequest) {
  try {
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, supabaseKey, {
      auth: { persistSession: false },
    });

    const searchParams = req.nextUrl.searchParams;
    let storeId = searchParams.get("store_id");
    const userId = searchParams.get("user_id");

    if (!storeId && userId) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("get_storekeeper_store", {
        p_user_id: userId,
      });
      if (!rpcErr && rpcRes?.success && rpcRes.store) {
        storeId = rpcRes.store.id;
      }
    }

    if (!storeId) {
      storeId = "a0000000-0000-0000-0000-000000000001";
    }

    // 1. Fetch store info
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, address, active, logo_url, bw_price_per_page, color_price_per_page")
      .eq("id", storeId)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // 2. Fetch configured printers for this store
    const { data: printers, error: printerErr } = await supabase
      .from("printers")
      .select("id, store_id, name, type, connection, windows_printer_name, is_online")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      store,
      printers: printers || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      store_id,
      name,
      address,
      logo_url,
      bw_price_per_page,
      color_price_per_page,
      printers,
    } = body;

    if (!store_id) {
      return NextResponse.json({ error: "store_id is required" }, { status: 400 });
    }

    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, supabaseKey, {
      auth: { persistSession: false },
    });

    // 1. Update store details & pricing
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updatePayload.name = String(name).trim();
    if (address !== undefined) updatePayload.address = String(address).trim();
    if (logo_url !== undefined) updatePayload.logo_url = logo_url ? String(logo_url).trim() : null;

    if (bw_price_per_page !== undefined) {
      const bw = Number(bw_price_per_page);
      if (!isNaN(bw) && bw >= 0.5 && bw <= 100) {
        updatePayload.bw_price_per_page = bw;
      }
    }

    if (color_price_per_page !== undefined) {
      const col = Number(color_price_per_page);
      if (!isNaN(col) && col >= 0.5 && col <= 500) {
        updatePayload.color_price_per_page = col;
      }
    }

    const { data: updatedStore, error: storeUpdateErr } = await supabase
      .from("stores")
      .update(updatePayload)
      .eq("id", store_id)
      .select()
      .single();

    if (storeUpdateErr) {
      return NextResponse.json({ error: storeUpdateErr.message }, { status: 500 });
    }

    // 2. Update printers mapping if provided
    if (Array.isArray(printers)) {
      for (const p of printers) {
        if (p.id) {
          const printerUpdate: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (p.type === "bw" || p.type === "color") printerUpdate.type = p.type;
          if (typeof p.is_online === "boolean") printerUpdate.is_online = p.is_online;
          if (p.name) printerUpdate.name = String(p.name).trim();

          await supabase.from("printers").update(printerUpdate).eq("id", p.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Store configuration and printer mappings saved successfully.",
      store: updatedStore,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
