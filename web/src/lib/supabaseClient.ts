import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateCustomerToken } from "./tokenManager";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ynfjuqqkrqgimttpgumx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

// Standard client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get client with current customer token header attached
export function getCustomerSupabaseClient(explicitToken?: string): SupabaseClient {
  const token = explicitToken || getOrCreateCustomerToken();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-customer-token": token,
      },
    },
  });
}
