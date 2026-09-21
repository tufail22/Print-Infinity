using System;
using System.IO;
using System.Text.Json;

namespace PrintInfinity.Agent.Config;

/// <summary>
/// Application and Supabase configuration settings for Print Infinity Agent.
/// Priority hierarchy:
///   1. Environment variables (process overrides)
///   2. appsettings.json file (in application root directory)
///   3. Built-in defaults
/// </summary>
public static class AppConfig
{
    public const string DefaultSupabaseUrl = "https://ynfjuqqkrqgimttpgumx.supabase.co";
    public const string DefaultSupabaseAnonKey = "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";
    public const string DefaultStoreId = "a0000000-0000-0000-0000-000000000001";

    private static readonly Lazy<JsonDocument?> AppSettingsDocument = new(LoadAppSettings);

    private static JsonDocument? LoadAppSettings()
    {
        try
        {
            string[] candidatePaths = [
                Path.Combine(AppContext.BaseDirectory, "appsettings.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json")
            ];

            foreach (var path in candidatePaths)
            {
                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    return JsonDocument.Parse(json);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AppConfig] Warning loading appsettings.json: {ex.Message}");
        }

        return null;
    }

    private static string? GetJsonValue(string section, string propertyName)
    {
        var doc = AppSettingsDocument.Value;
        if (doc == null) return null;

        try
        {
            var root = doc.RootElement;
            // 1. Try Section:PropertyName (e.g. Supabase -> Url)
            if (root.TryGetProperty(section, out var sectionEl) &&
                sectionEl.TryGetProperty(propertyName, out var valEl) &&
                valEl.ValueKind == JsonValueKind.String)
            {
                return valEl.GetString();
            }

            // 2. Try combined key (e.g. SupabaseUrl or StoreId)
            var combinedKey = $"{section}{propertyName}";
            if (root.TryGetProperty(combinedKey, out var flatEl) &&
                flatEl.ValueKind == JsonValueKind.String)
            {
                return flatEl.GetString();
            }

            // 3. Try propertyName alone (e.g. StoreId)
            if (root.TryGetProperty(propertyName, out var singleEl) &&
                singleEl.ValueKind == JsonValueKind.String)
            {
                return singleEl.GetString();
            }
        }
        catch
        {
            // Ignore format parsing issues
        }

        return null;
    }

    public static string SupabaseUrl =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
        ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
        ?? GetJsonValue("Supabase", "Url")
        ?? DefaultSupabaseUrl;

    public static string SupabaseAnonKey =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY")
        ?? GetJsonValue("Supabase", "AnonKey")
        ?? DefaultSupabaseAnonKey;

    public static Guid StoreId
    {
        get
        {
            var raw = Environment.GetEnvironmentVariable("PRINT_INFINITY_STORE_ID")
                      ?? GetJsonValue("Store", "StoreId")
                      ?? GetJsonValue("Store", "Id");

            if (!string.IsNullOrWhiteSpace(raw) && Guid.TryParse(raw, out var parsed))
            {
                return parsed;
            }
            return Guid.Parse(DefaultStoreId);
        }
    }
}
