import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateCustomerToken } from "./tokenManager";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

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
