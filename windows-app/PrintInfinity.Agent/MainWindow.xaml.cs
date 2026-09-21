using System;
using System.Runtime.InteropServices;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.Services.Printing;
using PrintInfinity.Agent.ViewModels;
using PrintInfinity.Agent.Views;
using WinRT.Interop;

namespace PrintInfinity.Agent;

/// <summary>
/// Main window — orchestrates Login → Dashboard with System Tray background persistence.
/// Window controls: Minimize/Maximize work normally via the OS titlebar.
/// The ✕ (close) button is intercepted to hide to tray instead of exiting.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly ICredentialStorageService _credentialStorage;
    private readonly ISupabaseAuthService _authService;
    private readonly IWindowsPrinterService _windowsPrinterService;
    private readonly IPrinterSyncService _printerSyncService;
    private readonly IJobQueueService _jobQueueService;
    private readonly ISystemTrayService _systemTrayService;
    private readonly IPrintEngine _printEngine;
    private readonly IPrintSpoolerMonitor _spoolerMonitor;
    private readonly IPrintPipelineService _printPipelineService;

    public MainWindow()
    {
        this.InitializeComponent();

        // ── Window Title & Size ────────────────────────────────────────────
        this.Title = "Print Infinity Agent";

        if (this.AppWindow != null)
        {
            this.AppWindow.Title = "Print Infinity Agent";
            this.AppWindow.Resize(new Windows.Graphics.SizeInt32(1100, 740));
            SetWindowIcon();
        }

        var hwnd = WindowNative.GetWindowHandle(this);
        Program.Log($"MainWindow initialized. HWND=0x{hwnd:X}");

        // ── Service Wiring ────────────────────────────────────────────────
        _credentialStorage   = new CredentialStorageService();
        _authService         = new SupabaseAuthService(_credentialStorage);
        _windowsPrinterService = new WindowsPrinterService();
        _printerSyncService  = new PrinterSyncService(_authService);
        _systemTrayService   = new SystemTrayService();
        _jobQueueService     = new JobQueueService(_authService);
        _printEngine         = new Services.Printing.WindowsPrintEngine();
        _spoolerMonitor      = new Services.Printing.PrintSpoolerMonitor();
        _printPipelineService = new PrintPipelineService(
            _authService, _printEngine, _spoolerMonitor, _systemTrayService);

        // ── System Tray Setup ─────────────────────────────────────────────
        _systemTrayService.Initialize(this);

        _systemTrayService.RestoreRequested += () =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                _systemTrayService.RestoreFromTray();
                this.Activate();
            });
        };

        _systemTrayService.ExitRequested += () =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                _systemTrayService.Dispose();
                Environment.Exit(0);
            });
        };

        // ── Close → Hide to Tray (NOT exit) ─────────────────────────────
        // Only intercept the ✕ button; Minimize/Maximize are NOT affected.
        if (this.AppWindow != null)
        {
            this.AppWindow.Closing += (sender, args) =>
            {
                args.Cancel = true;
                _systemTrayService.HideToTray();
            };
        }

        NavigateToLogin();
    }

    /// <summary>
    /// Sets the window and taskbar icon from the bundled AppLogo.png asset.
    /// </summary>
    private void SetWindowIcon()
    {
        try
        {
            var iconPath = System.IO.Path.Combine(
                AppContext.BaseDirectory, "Assets", "AppLogo.png");

            if (System.IO.File.Exists(iconPath))
            {
                // Use the HWND-based icon loading for unpackaged-compatible apps
                var hwnd = WindowNative.GetWindowHandle(this);
                // WinUI 3 AppWindow.SetIcon supports a file path directly
                this.AppWindow.SetIcon(iconPath);
            }
        }
        catch (Exception ex)
        {
            Program.Log($"[WARN] Icon load failed: {ex.Message}");
        }
    }

    private void NavigateToLogin()
    {
        if (!DispatcherQueue.HasThreadAccess)
        {
            DispatcherQueue.TryEnqueue(NavigateToLogin);
            return;
        }

        var loginVm = new LoginViewModel(_authService);
        var loginView = new LoginView { ViewModel = loginVm };

        loginVm.LoginSucceeded += () =>
        {
            DispatcherQueue.TryEnqueue(NavigateToDashboard);
        };

        MainContentContainer.Content = loginView;

        // Attempt silent session restore via Windows Credential Locker / DPAPI
        _ = loginVm.CheckAutoLoginAsync();
    }

    private void NavigateToDashboard()
    {
        if (!DispatcherQueue.HasThreadAccess)
        {
            DispatcherQueue.TryEnqueue(NavigateToDashboard);
            return;
        }

        Program.Log("MainWindow: Navigating to Dashboard...");
        var queueVm = new LiveQueueViewModel(_jobQueueService, _printPipelineService, _systemTrayService);
        var setupVm = new PrinterSetupViewModel(_authService, _windowsPrinterService, _printerSyncService);
        var dashboardView = new DashboardView(queueVm, setupVm, _systemTrayService);

        dashboardView.LoggedOut += () =>
        {
            Program.Log("DashboardView: Logged out, navigating to Login...");
            queueVm.Dispose();
            setupVm.Dispose();
            NavigateToLogin();
        };

        // FIX 9: Pause WMI printer status polling when hidden to tray; resume on restore.
        // This eliminates background WMI queries when the UI is invisible.
        if (this.AppWindow != null)
        {
            this.AppWindow.Changed += (sender, args) =>
            {
                if (args.DidPresenterChange) return;
                // Detect minimize to tray vs restore.
                // When hidden via ShowWindow(SW_HIDE), IsVisible becomes false.
            };
        }

        _systemTrayService.RestoreRequested += () =>
        {
            DispatcherQueue.TryEnqueue(() => setupVm.ResumePolling());
        };

        // Override the existing close→tray handler to also pause polling.
        if (this.AppWindow != null)
        {
            // AppWindow.Closing is already set in the constructor; add pause here.
            this.AppWindow.Closing += (sender, args) =>
            {
                // args.Cancel = true is already set by the constructor handler.
                setupVm.PausePolling();
            };
        }

        MainContentContainer.Content = dashboardView;

        _ = queueVm.StartAsync(_authService.CurrentStoreId);
        _ = setupVm.InitializeAsync();
        Program.Log($"MainWindow: Dashboard active for store {_authService.CurrentStoreId}");
    }

    /// <summary>
    /// Starts the application minimized to tray (launch-at-startup mode).
    /// </summary>
    public void StartMinimizedToTray()
    {
        this.Activate();
        _systemTrayService.HideToTray();
        _systemTrayService.ShowNotification(
            "Print Infinity Agent",
            "Agent started and is monitoring the print queue in the background.");
    }
}
