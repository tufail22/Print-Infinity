using System;
using Microsoft.UI.Xaml;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.Services.Printing;
using PrintInfinity.Agent.ViewModels;
using PrintInfinity.Agent.Views;

namespace PrintInfinity.Agent;

/// <summary>
/// Main window orchestrating Login, Live Queue, and Printer Setup with System Tray background persistence.
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

        _credentialStorage = new CredentialStorageService();
        _authService = new SupabaseAuthService(_credentialStorage);
        _windowsPrinterService = new WindowsPrinterService();
        _printerSyncService = new PrinterSyncService(_authService);
        _systemTrayService = new SystemTrayService();
        _jobQueueService = new JobQueueService(_authService);
        _printEngine = new Services.Printing.WindowsPrintEngine();
        _spoolerMonitor = new Services.Printing.PrintSpoolerMonitor();
        _printPipelineService = new PrintPipelineService(_authService, _printEngine, _spoolerMonitor, _systemTrayService);

        // Initialize native system tray icon and background persistence
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

        // Minimize / Close to Tray behavior: keep running in background
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

    private void NavigateToLogin()
    {
        var loginVm = new LoginViewModel(_authService);
        var loginView = new LoginView { ViewModel = loginVm };

        loginVm.LoginSucceeded += () =>
        {
            NavigateToDashboard();
        };

        MainContentContainer.Content = loginView;

        // Attempt silent session restore via Windows Credential Locker / DPAPI
        _ = loginVm.CheckAutoLoginAsync();
    }

    private void NavigateToDashboard()
    {
        var queueVm = new LiveQueueViewModel(_jobQueueService, _printPipelineService, _systemTrayService);
        var setupVm = new PrinterSetupViewModel(_authService, _windowsPrinterService, _printerSyncService);
        var dashboardView = new DashboardView(queueVm, setupVm, _systemTrayService);

        dashboardView.LoggedOut += () =>
        {
            queueVm.Dispose();
            setupVm.Dispose();
            NavigateToLogin();
        };

        MainContentContainer.Content = dashboardView;

        // Launch Realtime Queue listener and Printer scanner concurrently
        _ = queueVm.StartAsync(_authService.CurrentStoreId);
        _ = setupVm.InitializeAsync();
    }
}
