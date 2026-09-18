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

        _credentialStorage.SaveCredentials(email, password);
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

        if (rememberMe)
        {
            _credentialStorage.SaveCredentials(email, password);
        }

        return true;
    }

    public async Task<bool> TryRestoreSessionAsync()
    {
        await InitializeAsync();

        var stored = _credentialStorage.RetrieveCredentials();
        if (stored == null) return false;

        try
        {
            return await LoginAsync(stored.Value.Email, stored.Value.SessionOrPassword, rememberMe: true);
        }
        catch (Exception ex)
        {
            Program.Log($"Failed to restore saved session: {ex.Message}");
            _credentialStorage.ClearCredentials();
            return false;
        }
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
