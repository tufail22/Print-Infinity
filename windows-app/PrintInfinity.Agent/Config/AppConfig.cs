using System;

namespace PrintInfinity.Agent.Config;

/// <summary>
/// Application and Supabase configuration settings for Print Infinity Agent.
/// </summary>
public static class AppConfig
{
    public const string DefaultSupabaseUrl = "https://ynfjuqqkrqgimttpgumx.supabase.co";
    public const string DefaultSupabaseAnonKey = "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";
    public const string DefaultStoreId = "a0000000-0000-0000-0000-000000000001";

    public static string SupabaseUrl =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
        ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
        ?? DefaultSupabaseUrl;

    public static string SupabaseAnonKey =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY")
        ?? DefaultSupabaseAnonKey;

    public static Guid StoreId
    {
        get
        {
            var raw = Environment.GetEnvironmentVariable("PRINT_INFINITY_STORE_ID");
            if (!string.IsNullOrWhiteSpace(raw) && Guid.TryParse(raw, out var parsed))
            {
                return parsed;
            }
            return Guid.Parse(DefaultStoreId);
        }
    }
}
