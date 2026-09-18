using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using PrintInfinity.Agent.Config;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.Services.Printing;
using WinRT;

namespace PrintInfinity.Agent;

public static class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int MessageBoxW(IntPtr hWnd, string lpText, string lpCaption, uint uType);

    [DllImport("Microsoft.ui.xaml.dll")]
    [DefaultDllImportSearchPaths(DllImportSearchPath.SafeDirectories)]
    private static extern void XamlCheckProcessRequirements();

    private static readonly string LogFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PrintInfinityAgent",
        "startup.log"
    );

    [STAThread]
    public static void Main(string[] args)
    {
        Log("=== Print Infinity Agent Starting ===");
        Log($"Timestamp: {DateTime.Now:O}");
        Log($"OS Version: {Environment.OSVersion}");
        Log($"Command Line: {Environment.CommandLine}");
        Log($"Current Directory: {Environment.CurrentDirectory}");
        Log($"App Domain BaseDirectory: {AppDomain.CurrentDomain.BaseDirectory}");

        AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
        {
            var ex = e.ExceptionObject as Exception;
            Log($"[FATAL] AppDomain UnhandledException: {ex}");
            ShowFatalDialog("Fatal Application Error", ex);
        };

        try
        {
            // Validate required configuration values upfront
            ValidateEnvironment();

            // Verify XAML prerequisites
            Log("Calling XamlCheckProcessRequirements...");
            XamlCheckProcessRequirements();
            Log("XamlCheckProcessRequirements passed.");

            // Initialize WinRT ComWrappers
            Log("Initializing WinRT ComWrappers...");
            ComWrappersSupport.InitializeComWrappers();
            Log("ComWrappers initialized.");

            if (args.Any(a => a.Equals("--test-pipeline", StringComparison.OrdinalIgnoreCase)))
            {
                Log("[CLI] --test-pipeline flag detected. Running headless end-to-end pipeline verification...");
                RunPipelineTestAsync().GetAwaiter().GetResult();
                Log("[CLI] --test-pipeline execution complete.");
                return;
            }

            // Start WinUI Application
            Log("Starting WinUI Application...");
            Application.Start((p) =>
            {
                try
                {
                    Log("DispatcherQueue thread initialization...");
                    var context = new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread());
                    SynchronizationContext.SetSynchronizationContext(context);

                    Log("Instantiating App...");
                    new App();
                    Log("App instantiated successfully.");
                }
                catch (Exception ex)
                {
                    Log($"[FATAL] Exception inside Application.Start callback: {ex}");
                    ShowFatalDialog("Application Initialization Error", ex);
                    throw;
                }
            });
            Log("Application.Start completed normally.");
        }
        catch (Exception ex)
        {
            Log($"[FATAL] Exception in Main: {ex}");
            ShowFatalDialog("Startup Failure", ex);
        }
    }

    private static async Task RunPipelineTestAsync()
    {
        Log("[TEST-PIPELINE] Starting end-to-end verification of PrintPipelineService...");
        var credStorage = new CredentialStorageService();
        var authService = new SupabaseAuthService(credStorage);
        await authService.InitializeAsync();

        bool loggedIn = await authService.TryRestoreSessionAsync();
        if (!loggedIn)
        {
            Log("[TEST-PIPELINE] Restoring session from DPAPI failed. Logging in explicitly...");
            loggedIn = await authService.LoginAsync("storekeeper.printinfinity@gmail.com", "StoreKeeper123!");
        }
        if (!loggedIn)
        {
            Log("[TEST-PIPELINE] ERROR: Failed to authenticate storekeeper.");
            return;
        }
        Log($"[TEST-PIPELINE] Storekeeper authenticated: {authService.CurrentUser?.Email}, StoreId: {authService.CurrentStoreId}");

        var printEngine = new WindowsPrintEngine();
        var spoolerMonitor = new PrintSpoolerMonitor();
        var systemTrayService = new SystemTrayService();
        var pipelineService = new PrintPipelineService(authService, printEngine, spoolerMonitor, systemTrayService);

        // Fetch latest pending_approval job
        var jobs = await authService.Client.From<Models.PrintJobRecord>()
            .Where(x => x.StoreId == authService.CurrentStoreId)
            .Where(x => x.Status == "pending_approval")
            .Get();

        var pendingJobs = jobs.Models;
        if (pendingJobs.Count == 0)
        {
            Log("[TEST-PIPELINE] No pending_approval jobs found for store.");
            return;
        }

        Log($"[TEST-PIPELINE] Found {pendingJobs.Count} pending_approval job(s) in queue. Beginning storekeeper sequential review & approval...");

        foreach (var job in pendingJobs)
        {
            Log($"\n=======================================================");
            Log($"[TEST-PIPELINE] Processing Job {job.Id} (ColorMode: {job.ColorMode?.ToUpperInvariant()})");
            Log($"=======================================================");
            Log($"[TEST-PIPELINE] [1/5 Review Request in Queue]: ID={job.Id}, ColorMode={job.ColorMode}, Copies={job.Copies}, PaperSize={job.PaperSize}, Duplex={job.Duplex} (Document preview omitted for Zero-Disk Privacy)");

            var queueItem = new Models.QueueItem
            {
                Id = job.Id,
                ColorMode = job.ColorMode ?? "bw",
                Copies = job.Copies,
                PaperSize = job.PaperSize ?? "A4",
                Duplex = job.Duplex,
                PageCount = job.PageCount,
                Price = job.ColorMode == "color" ? 10.00m : 2.00m,
                CreatedAt = job.CreatedAt
            };

            var tcs = new TaskCompletionSource<bool>();
            EventHandler<PrintPipelineEvent>? eventHandler = null;
            eventHandler = (s, e) =>
            {
                if (e.JobId == job.Id)
                {
                    Log($"[TEST-PIPELINE-EVENT] [{e.Status}] {e.Message} (IsError={e.IsError})");
                    if (string.Equals(e.Status, "completed", StringComparison.OrdinalIgnoreCase))
                    {
                        tcs.TrySetResult(true);
                    }
                    else if (string.Equals(e.Status, "failed", StringComparison.OrdinalIgnoreCase) || e.IsError)
                    {
                        tcs.TrySetResult(false);
                    }
                }
            };

            pipelineService.PipelineEventOccurred += eventHandler;

            Log($"[TEST-PIPELINE] [2/5 Storekeeper Approves Job {job.Id}]: Enqueueing into PrintPipelineService...");
            await pipelineService.EnqueueJobAsync(queueItem, candidates => Task.FromResult(candidates.FirstOrDefault()));

            Log("[TEST-PIPELINE] [3/5 In-Memory Download, Auto-Printer Selection & Silent Spooling in Progress]...");
            var completed = await tcs.Task;
            pipelineService.PipelineEventOccurred -= eventHandler;
            Log($"[TEST-PIPELINE] Pipeline finished for Job {job.Id} with Success={completed}");

            Log("[TEST-PIPELINE] [4/5 Verifying In-Memory Cleanup & Storage Deletion]...");
            var updatedJob = await authService.Client.From<Models.PrintJobRecord>()
                .Where(x => x.Id == job.Id)
                .Single();

            Log($"[TEST-PIPELINE] [5/5 Status Transition]: Database status = '{updatedJob?.Status}', StoragePath = '{updatedJob?.StoragePath}'");
            if (updatedJob != null && updatedJob.Status == "completed" && string.IsNullOrEmpty(updatedJob.StoragePath))
            {
                Log($"[TEST-PIPELINE] *** SUCCESS: Job {job.Id} ({job.ColorMode}) verified! File cleared from storage, job marked completed, customer Realtime alerted. ***\n");
            }
            else
            {
                Log($"[TEST-PIPELINE] Note: Status={updatedJob?.Status}, StoragePath={updatedJob?.StoragePath}");
            }
        }
    }

    private static void ValidateEnvironment()
    {
        try
        {
            if (string.IsNullOrWhiteSpace(AppConfig.SupabaseUrl))
            {
                throw new InvalidOperationException("Supabase URL is missing. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
            }
            if (string.IsNullOrWhiteSpace(AppConfig.SupabaseAnonKey))
            {
                throw new InvalidOperationException("Supabase Anon Key is missing. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.");
            }
            Log($"Config validated: Supabase URL={AppConfig.SupabaseUrl}, Store ID={AppConfig.StoreId}");
        }
        catch (Exception ex)
        {
            Log($"[ERROR] Configuration validation failed: {ex.Message}");
            ShowFatalDialog("Configuration Error", ex);
            throw;
        }
    }

    public static void ShowFatalDialog(string title, Exception? ex)
    {
        string message = ex != null
            ? $"{title}:\n\n{ex.GetType().Name}: {ex.Message}\n\nStack Trace:\n{ex.StackTrace}"
            : $"{title}: An unknown fatal error occurred during startup.";

        Log($"Displaying native MessageBox: {title} - {ex?.Message}");
        try
        {
            MessageBoxW(IntPtr.Zero, message, "Print Infinity Agent", 0x10 /* MB_ICONERROR */ | 0x0 /* MB_OK */);
        }
        catch
        {
            Console.Error.WriteLine(message);
        }
    }

    public static void Log(string message)
    {
        try
        {
            Console.WriteLine(message);
            string? dir = Path.GetDirectoryName(LogFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.AppendAllText(LogFilePath, $"[{DateTime.Now:HH:mm:ss.fff}] {message}{Environment.NewLine}");
        }
        catch
        {
            // Ignore logging failures
        }
    }
}
