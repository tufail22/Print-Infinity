using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Supabase.Gotrue;
using PrintInfinity.Agent.Config;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public interface ISupabaseAuthService
{
    Supabase.Client Client { get; }
    User? CurrentUser { get; }
    Guid CurrentStoreId { get; }
    bool IsAuthenticated { get; }

    Task InitializeAsync();
    Task<bool> RegisterAsync(string email, string password, string? storeName = null);
    Task<bool> LoginAsync(string email, string password, bool rememberMe = true);
    Task<bool> TryRestoreSessionAsync();
    Task LogoutAsync();
}

public class SupabaseAuthService : ISupabaseAuthService
{
    private readonly ICredentialStorageService _credentialStorage;
    private Supabase.Client? _client;
    private bool _isInitialized;

    public Supabase.Client Client => _client ?? throw new InvalidOperationException("Supabase client is not initialized.");
    public User? CurrentUser => _client?.Auth.CurrentUser;
    public Guid CurrentStoreId { get; private set; } = AppConfig.StoreId;
    public bool IsAuthenticated => _client?.Auth.CurrentUser != null;

    public SupabaseAuthService(ICredentialStorageService credentialStorage)
    {
        _credentialStorage = credentialStorage;
    }

    public async Task InitializeAsync()
    {
        if (_isInitialized && _client != null) return;

        var options = new Supabase.SupabaseOptions
        {
            AutoRefreshToken = true,
            AutoConnectRealtime = true
        };

        _client = new Supabase.Client(AppConfig.SupabaseUrl, AppConfig.SupabaseAnonKey, options);
        await _client.InitializeAsync();
        _isInitialized = true;
    }

    public async Task<bool> RegisterAsync(string email, string password, string? storeName = null)
    {
        await InitializeAsync();

        // Step 1: Sign up in Supabase Auth
        var session = await Client.Auth.SignUp(email, password);
        if (session?.User == null)
        {
            throw new Exception("Supabase Auth sign-up did not return a user. Please check your email format or credentials.");
        }

        var userId = Guid.Parse(session.User.Id!);
        var name = !string.IsNullOrWhiteSpace(storeName) ? storeName.Trim() : "Print Infinity Shop";

        // Step 2: Register store & storekeeper profile via RPC
        try
        {
            var rpcParams = new Dictionary<string, object>
            {
                { "p_user_id", userId },
                { "p_store_name", name },
                { "p_bw_price", 3.00 },
                { "p_color_price", 10.00 }
            };
            await Client.Rpc("register_new_store", rpcParams);
            Program.Log($"SupabaseAuthService: Successfully registered new store '{name}' for user {userId}");
        }
        catch (Exception ex)
        {
            Program.Log($"[WARN] register_new_store note: {ex.Message}");
        }

        // Step 3: Fetch assigned store record
        try
        {
            var response = await Client.From<StorekeeperRecord>()
                .Where(x => x.Id == userId)
                .Get();
            var record = response.Models.FirstOrDefault();
            if (record != null && record.StoreId != Guid.Empty)
            {
                CurrentStoreId = record.StoreId;
            }
            else
            {
                CurrentStoreId = AppConfig.StoreId;
            }
        }
        catch
        {
            CurrentStoreId = AppConfig.StoreId;
        }

        if (Client.Auth.CurrentSession != null && !string.IsNullOrEmpty(Client.Auth.CurrentSession.AccessToken))
        {
            var storedSession = new StoredSessionData
            {
                Email = email,
                AccessToken = Client.Auth.CurrentSession.AccessToken,
                RefreshToken = Client.Auth.CurrentSession.RefreshToken ?? string.Empty,
                ExpiresAtUtc = DateTime.UtcNow.AddSeconds(Client.Auth.CurrentSession.ExpiresIn > 0 ? Client.Auth.CurrentSession.ExpiresIn : 3600)
            };
            _credentialStorage.SaveCredentials(email, System.Text.Json.JsonSerializer.Serialize(storedSession));
        }
        return true;
    }

    public async Task<bool> LoginAsync(string email, string password, bool rememberMe = true)
    {
        await InitializeAsync();

        var session = await Client.Auth.SignIn(email, password);
        if (session?.User == null)
        {
            return false;
        }

        var userId = Guid.Parse(session.User.Id!);

        // Fetch assigned storekeeper record
        try
        {
            var response = await Client.From<StorekeeperRecord>()
                .Where(x => x.Id == userId)
                .Get();

            var record = response.Models.FirstOrDefault();
            if (record != null && record.StoreId != Guid.Empty)
            {
                CurrentStoreId = record.StoreId;
                Program.Log($"SupabaseAuthService: User {userId} logged into Store {CurrentStoreId}");
            }
            else
            {
                // Auto-provision storekeeper record for default store if missing
                var newRecord = new StorekeeperRecord
                {
                    Id = userId,
                    StoreId = AppConfig.StoreId,
                    Role = "storekeeper"
                };
                await Client.From<StorekeeperRecord>().Insert(newRecord);
                CurrentStoreId = AppConfig.StoreId;
            }
        }
        catch (Exception ex)
        {
            Program.Log($"[WARN] Could not load storekeeper profile: {ex.Message}");
            CurrentStoreId = AppConfig.StoreId;
        }

        if (rememberMe && session != null && !string.IsNullOrEmpty(session.AccessToken))
        {
            var storedSession = new StoredSessionData
            {
                Email = email,
                AccessToken = session.AccessToken,
                RefreshToken = session.RefreshToken ?? string.Empty,
                ExpiresAtUtc = DateTime.UtcNow.AddSeconds(session.ExpiresIn > 0 ? session.ExpiresIn : 3600)
            };
            var sessionJson = System.Text.Json.JsonSerializer.Serialize(storedSession);
            _credentialStorage.SaveCredentials(email, sessionJson);
        }

        return true;
    }

    public async Task<bool> TryRestoreSessionAsync()
    {
        await InitializeAsync();

        var stored = _credentialStorage.RetrieveCredentials();
        if (stored == null)
        {
            Program.Log("SupabaseAuthService: No stored session found.");
            return false;
        }

        try
        {
            // Parse stored session tokens (NOT plain passwords)
            if (string.IsNullOrWhiteSpace(stored.Value.SessionOrPassword) || !stored.Value.SessionOrPassword.TrimStart().StartsWith("{"))
            {
                Program.Log("SupabaseAuthService: Stored credential is not a valid session token payload. Clearing legacy credential...");
                _credentialStorage.ClearCredentials();
                return false;
            }

            var sessionData = System.Text.Json.JsonSerializer.Deserialize<StoredSessionData>(stored.Value.SessionOrPassword);
            if (sessionData == null || string.IsNullOrWhiteSpace(sessionData.AccessToken))
            {
                Program.Log("SupabaseAuthService: Empty session token in storage. Clearing...");
                _credentialStorage.ClearCredentials();
                return false;
            }

            Program.Log($"SupabaseAuthService: Validating stored session for {sessionData.Email} against Supabase...");

            // Restore tokens into Supabase Gotrue client
            if (!string.IsNullOrEmpty(sessionData.RefreshToken))
            {
                var refreshed = await Client.Auth.SetSession(sessionData.AccessToken, sessionData.RefreshToken, false);
                if (refreshed?.User == null)
                {
                    Program.Log("SupabaseAuthService: SetSession returned null user. Attempting refresh...");
                    refreshed = await Client.Auth.RefreshSession();
                }

                if (refreshed?.User == null)
                {
                    Program.Log("SupabaseAuthService: Session refresh failed. Requiring login.");
                    _credentialStorage.ClearCredentials();
                    return false;
                }
            }

            // Verify live user identity from Supabase server
            var liveUser = Client.Auth.CurrentUser ?? await Client.Auth.GetUser(sessionData.AccessToken);
            if (liveUser == null)
            {
                Program.Log("SupabaseAuthService: Token validation failed against Supabase. Requiring login.");
                _credentialStorage.ClearCredentials();
                return false;
            }

            var userId = Guid.Parse(liveUser.Id!);

            // Verify storekeeper assignment in Supabase database
            var storeResp = await Client.From<StorekeeperRecord>()
                .Where(x => x.Id == userId)
                .Get();

            var record = storeResp.Models.FirstOrDefault();
            if (record != null && record.StoreId != Guid.Empty)
            {
                CurrentStoreId = record.StoreId;
            }
            else
            {
                CurrentStoreId = AppConfig.StoreId;
            }

            // If session was refreshed, update stored tokens with fresh expiration
            if (Client.Auth.CurrentSession != null && !string.IsNullOrEmpty(Client.Auth.CurrentSession.AccessToken))
            {
                var updatedSession = new StoredSessionData
                {
                    Email = sessionData.Email,
                    AccessToken = Client.Auth.CurrentSession.AccessToken,
                    RefreshToken = Client.Auth.CurrentSession.RefreshToken ?? sessionData.RefreshToken,
                    ExpiresAtUtc = DateTime.UtcNow.AddSeconds(Client.Auth.CurrentSession.ExpiresIn > 0 ? Client.Auth.CurrentSession.ExpiresIn : 3600)
                };
                _credentialStorage.SaveCredentials(sessionData.Email, System.Text.Json.JsonSerializer.Serialize(updatedSession));
            }

            Program.Log($"SupabaseAuthService: Successfully validated Supabase session for user {liveUser.Email} (Store: {CurrentStoreId})");
            return true;
        }
        catch (Exception ex)
        {
            Program.Log($"SupabaseAuthService: Session validation rejected by Supabase: {ex.Message}. Requiring manual login.");
            _credentialStorage.ClearCredentials();
            return false;
        }
    }

    public class StoredSessionData
    {
        public string Email { get; set; } = string.Empty;
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime ExpiresAtUtc { get; set; }
    }

    public async Task LogoutAsync()
    {
        try
        {
            if (_client != null)
            {
                await _client.Auth.SignOut();
            }
        }
        catch
        {
            // Ignore sign-out errors
        }
        finally
        {
            _credentialStorage.ClearCredentials();
        }
    }
}
