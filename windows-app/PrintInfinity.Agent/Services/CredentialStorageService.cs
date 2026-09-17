using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Windows.Security.Credentials;

namespace PrintInfinity.Agent.Services;

public interface ICredentialStorageService
{
    void SaveCredentials(string email, string sessionJsonOrPassword);
    (string Email, string SessionOrPassword)? RetrieveCredentials();
    void ClearCredentials();
}

public class CredentialStorageService : ICredentialStorageService
{
    private const string ResourceName = "PrintInfinity.Agent.Storekeeper";
    private static readonly string FallbackStorageDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PrintInfinity.Agent"
    );
    private static readonly string FallbackFilePath = Path.Combine(FallbackStorageDir, "session.dpapi");
    private static readonly byte[] Entropy = "PrintInfinity_Agent_Salt_v1"u8.ToArray();

    public void SaveCredentials(string email, string sessionJsonOrPassword)
    {
        try
        {
            // Primary: Windows Credential Locker (PasswordVault)
            var vault = new PasswordVault();

            // Remove any existing credentials for this resource
            try
            {
                var existing = vault.FindAllByResource(ResourceName);
                foreach (var cred in existing)
                {
                    vault.Remove(cred);
                }
            }
            catch
            {
                // FindAllByResource throws if no matching credentials found
            }

            var credential = new PasswordCredential(ResourceName, email, sessionJsonOrPassword);
            vault.Add(credential);
            return;
        }
        catch
        {
            // Fallback: DPAPI (ProtectedData) encrypted with CurrentUser DPAPI key
            SaveViaDpapi(email, sessionJsonOrPassword);
        }
    }

    public (string Email, string SessionOrPassword)? RetrieveCredentials()
    {
        try
        {
            var vault = new PasswordVault();
            var list = vault.FindAllByResource(ResourceName);
            foreach (var item in list)
            {
                item.RetrievePassword();
                if (!string.IsNullOrEmpty(item.UserName) && !string.IsNullOrEmpty(item.Password))
                {
                    return (item.UserName, item.Password);
                }
            }
        }
        catch
        {
            // Fallback to DPAPI
            return RetrieveViaDpapi();
        }

        return RetrieveViaDpapi();
    }

    public void ClearCredentials()
    {
        try
        {
            var vault = new PasswordVault();
            var list = vault.FindAllByResource(ResourceName);
            foreach (var item in list)
            {
                vault.Remove(item);
            }
        }
        catch
        {
            // Ignore if not present
        }

        try
        {
            if (File.Exists(FallbackFilePath))
            {
                File.Delete(FallbackFilePath);
            }
        }
        catch
        {
            // Ignore
        }
    }

    private static void SaveViaDpapi(string email, string secret)
    {
        try
        {
            Directory.CreateDirectory(FallbackStorageDir);
            var payload = $"{email}\n{secret}";
            var plainBytes = Encoding.UTF8.GetBytes(payload);
            var cipherBytes = ProtectedData.Protect(plainBytes, Entropy, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(FallbackFilePath, cipherBytes);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"DPAPI save failed: {ex.Message}");
        }
    }

    private static (string Email, string SessionOrPassword)? RetrieveViaDpapi()
    {
        try
        {
            if (!File.Exists(FallbackFilePath)) return null;
            var cipherBytes = File.ReadAllBytes(FallbackFilePath);
            var plainBytes = ProtectedData.Unprotect(cipherBytes, Entropy, DataProtectionScope.CurrentUser);
            var payload = Encoding.UTF8.GetString(plainBytes);
            var parts = payload.Split('\n', 2);
            if (parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]))
            {
                return (parts[0], parts[1]);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"DPAPI retrieve failed: {ex.Message}");
        }
        return null;
    }
}
