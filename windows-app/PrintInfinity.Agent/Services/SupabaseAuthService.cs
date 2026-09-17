using System;
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
    Task<bool> RegisterAsync(string email, string password, Guid? storeId = null);
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

    public async Task<bool> RegisterAsync(string email, string password, Guid? storeId = null)
    {
        await InitializeAsync();
        var targetStoreId = storeId ?? AppConfig.StoreId;

        // Step 1: Sign up in Supabase Auth
        var session = await Client.Auth.SignUp(email, password);
        if (session?.User == null)
        {
            throw new Exception("Supabase Auth sign-up did not return a user. Check if email confirmation is required.");
        }

        var userId = Guid.Parse(session.User.Id!);

        // Step 2: Ensure storekeeper record exists linked to auth.users and stores
        try
        {
            var storekeeper = new StorekeeperRecord
            {
                Id = userId,
                StoreId = targetStoreId,
                Role = "storekeeper"
            };
            await Client.From<StorekeeperRecord>().Insert(storekeeper);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Storekeeper profile insert note: {ex.Message}");
        }

        CurrentStoreId = targetStoreId;
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
            if (record != null)
            {
                CurrentStoreId = record.StoreId;
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
            System.Diagnostics.Debug.WriteLine($"Could not load storekeeper profile: {ex.Message}");
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
            System.Diagnostics.Debug.WriteLine($"Failed to restore saved session: {ex.Message}");
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
