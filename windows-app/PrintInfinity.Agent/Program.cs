using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Channels;
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

    // ── Async Log Writer ──────────────────────────────────────────────────
    // Log() enqueues immediately and returns — never blocks the caller.
    // A single dedicated background thread drains the channel and writes to disk.
    private static readonly Channel<string> _logChannel =
        Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

    private static readonly Thread _logThread = CreateLogThread();

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

    /// <summary>
    /// Enqueues a log message for async off-thread disk write. Never blocks the caller.
    /// </summary>
    public static void Log(string message)
    {
        var line = $"[{DateTime.Now:HH:mm:ss.fff}] {message}";
        Console.WriteLine(line);
        _logChannel.Writer.TryWrite(line);
    }

    /// <summary>Flush all pending log entries synchronously. Call before process exit.</summary>
    public static void FlushLog()
    {
        _logChannel.Writer.Complete();
        _logThread.Join(TimeSpan.FromSeconds(3));
    }

    private static Thread CreateLogThread()
    {
        var t = new Thread(DrainLogChannel)
        {
            Name = "PrintInfinity.LogWriter",
            IsBackground = true,
            Priority = ThreadPriority.BelowNormal
        };
        t.Start();
        return t;
    }

    private static void DrainLogChannel()
    {
        try
        {
            string? dir = Path.GetDirectoryName(LogFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            // Batch writes to amortize disk I/O cost
            var batch = new List<string>(16);
            while (_logChannel.Reader.WaitToReadAsync().AsTask().GetAwaiter().GetResult())
            {
                batch.Clear();
                while (_logChannel.Reader.TryRead(out var line))
                    batch.Add(line);

                if (batch.Count > 0)
                {
                    try
                    {
                        File.AppendAllLines(LogFilePath, batch);
                    }
                    catch
                    {
                        // Ignore transient disk errors
                    }
                }
            }
        }
        catch
        {
            // Log thread must not crash the process
        }
    }
}
