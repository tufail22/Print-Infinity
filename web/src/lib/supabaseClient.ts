import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateCustomerToken } from "./tokenManager";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl;
  }
  return "https://ynfjuqqkrqgimttpgumx.supabase.co";
}

function getValidSupabaseAnonKey(): string {
  const envKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (envKey && envKey.length > 20 && !envKey.includes("[SENSITIVE]")) {
    return envKey;
  }
  return "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";
}

const supabaseUrl = getValidSupabaseUrl();
const supabaseAnonKey = getValidSupabaseAnonKey();

// Standard client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Client cache map to avoid repeated object and WebSocket instantiation on polling loops
const customerClients = new Map<string, SupabaseClient>();

// Helper to get client with current customer token header attached (cached by token)
export function getCustomerSupabaseClient(explicitToken?: string): SupabaseClient {
  const token = explicitToken || getOrCreateCustomerToken();
  let client = customerClients.get(token);
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          "x-customer-token": token,
        },
      },
    });
    customerClients.set(token, client);
  }
  return client;
}
