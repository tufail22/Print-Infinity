using System;
using Microsoft.UI.Xaml;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.ViewModels;
using PrintInfinity.Agent.Views;

namespace PrintInfinity.Agent;

/// <summary>
/// Main window orchestrating Login and Printer Setup for the Storekeeper Agent.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly ICredentialStorageService _credentialStorage;
    private readonly ISupabaseAuthService _authService;
    private readonly IWindowsPrinterService _windowsPrinterService;
    private readonly IPrinterSyncService _printerSyncService;

    public MainWindow()
    {
        this.InitializeComponent();

        _credentialStorage = new CredentialStorageService();
        _authService = new SupabaseAuthService(_credentialStorage);
        _windowsPrinterService = new WindowsPrinterService();
        _printerSyncService = new PrinterSyncService(_authService);

        NavigateToLogin();
    }

    private void NavigateToLogin()
    {
        var loginVm = new LoginViewModel(_authService);
        var loginView = new LoginView { ViewModel = loginVm };

        loginVm.LoginSucceeded += () =>
        {
            NavigateToPrinterSetup();
        };

        MainContentContainer.Content = loginView;

        // Attempt silent session restore via Windows Credential Locker / DPAPI
        _ = loginVm.CheckAutoLoginAsync();
    }

    private void NavigateToPrinterSetup()
    {
        var setupVm = new PrinterSetupViewModel(_authService, _windowsPrinterService, _printerSyncService);
        var setupView = new PrinterSetupView { ViewModel = setupVm };

        setupVm.LoggedOut += () =>
        {
            NavigateToLogin();
        };

        MainContentContainer.Content = setupView;

        // Scan installed Windows printers and merge with Supabase cloud records
        _ = setupVm.InitializeAsync();
    }
}
