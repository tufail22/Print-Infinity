using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.UI.Dispatching;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services;

namespace PrintInfinity.Agent.ViewModels;

public partial class PrinterSetupViewModel : ObservableObject, IDisposable
{
    private readonly ISupabaseAuthService _authService;
    private readonly IWindowsPrinterService _windowsPrinterService;
    private readonly IPrinterSyncService _printerSyncService;
    private readonly DispatcherQueue? _dispatcherQueue;
    private Timer? _pollingTimer;
    private bool _isDisposed;

    public event Action? LoggedOut;

    public ObservableCollection<PrinterItem> Printers { get; } = new();

    public bool HasNoPrinters => Printers.Count == 0;

    [ObservableProperty]
    private string _storeName = "Print Infinity — Flagship Store #1";

    [ObservableProperty]
    private string _storekeeperEmail = string.Empty;

    [ObservableProperty]
    private Guid _storeId;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private bool _isSavingAll;

    [ObservableProperty]
    private string _statusMessage = "Ready";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasNotification))]
    private string _notificationMessage = string.Empty;

    public bool HasNotification => !string.IsNullOrWhiteSpace(NotificationMessage);

    public PrinterSetupViewModel(
        ISupabaseAuthService authService,
        IWindowsPrinterService windowsPrinterService,
        IPrinterSyncService printerSyncService)
    {
        _authService = authService;
        _windowsPrinterService = windowsPrinterService;
        _printerSyncService = printerSyncService;
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();

        StoreId = _authService.CurrentStoreId;
        StorekeeperEmail = _authService.CurrentUser?.Email ?? "storekeeper@printinfinity.in";

        Printers.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasNoPrinters));

        StartPeriodicQueuePing();
    }

    public async Task InitializeAsync()
    {
        await LoadPrintersAsync();
    }

    [RelayCommand]
    public async Task LoadPrintersAsync()
    {
        IsLoading = true;
        StatusMessage = "Scanning Windows print queues...";
        NotificationMessage = string.Empty;

        try
        {
            var installed = await _windowsPrinterService.GetInstalledPrintersAsync();
            await _printerSyncService.MergeWithInstalledPrintersAsync(installed, StoreId);

            Printers.Clear();
            foreach (var item in installed)
            {
                Printers.Add(item);
            }

            Program.Log($"PrinterSetupViewModel: Detected {installed.Count} Windows printers; {Printers.Count(p => p.IsOnline)} online; synced with Store {StoreId}");
            StatusMessage = $"Found {Printers.Count} installed printer(s). Status active.";
        }
        catch (Exception ex)
        {
            Program.Log($"PrinterSetupViewModel Error: {ex}");
            StatusMessage = $"Error detecting printers: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    public async Task SavePrinterAsync(PrinterItem? printer)
    {
        if (printer == null) return;

        NotificationMessage = string.Empty;
        var success = await _printerSyncService.SavePrinterMappingAsync(printer, StoreId);
        if (success)
        {
            NotificationMessage = $"✓ Successfully saved '{printer.DisplayName}' ({printer.Type.ToUpperInvariant()}, {printer.Connection.ToUpperInvariant()}) to Supabase!";
            StatusMessage = $"Printer {printer.DisplayName} synchronized with cloud database.";
        }
        else
        {
            NotificationMessage = $"Failed to save '{printer.DisplayName}' to Supabase. Check network/permissions.";
        }
    }

    [RelayCommand]
    public async Task SaveAllAsync()
    {
        if (Printers.Count == 0) return;

        IsSavingAll = true;
        NotificationMessage = string.Empty;
        int savedCount = 0;

        try
        {
            foreach (var printer in Printers)
            {
                var ok = await _printerSyncService.SavePrinterMappingAsync(printer, StoreId);
                if (ok) savedCount++;
            }

            NotificationMessage = $"✓ All {savedCount} of {Printers.Count} printer mappings saved to Supabase!";
            StatusMessage = $"Cloud synchronization complete for Store {StoreId}.";
        }
        catch (Exception ex)
        {
            NotificationMessage = $"Save all failed: {ex.Message}";
        }
        finally
        {
            IsSavingAll = false;
        }
    }

    /// <summary>Removes a printer card from the local list (does not delete from Supabase).</summary>
    public void RemovePrinter(PrinterItem printer)
    {
        Printers.Remove(printer);
        StatusMessage = $"{Printers.Count} printer(s) in list.";
    }

    /// <summary>Manually adds a custom printer entry by name without a Windows scan.</summary>
    public void AddCustomPrinter(string printerName)
    {
        var item = new PrinterItem
        {
            WindowsPrinterName = printerName,
            DisplayName = printerName,
            PortName = "MANUAL",
            Type = "bw",
            Connection = "usb"
        };
        Printers.Add(item);
        NotificationMessage = $"Added '{printerName}'. Configure and click Save to Cloud.";
        StatusMessage = $"{Printers.Count} printer(s) in list.";
    }

    [RelayCommand]
    public async Task RefreshStatusAsync()
    {
        StatusMessage = "Pinging Windows print queues...";
        foreach (var printer in Printers)
        {
            await _windowsPrinterService.UpdatePrinterStatusAsync(printer);
        }
        StatusMessage = $"Printer statuses updated at {DateTime.Now:HH:mm:ss}.";
    }

    [RelayCommand]
    public async Task LogoutAsync()
    {
        StopPeriodicQueuePing();
        await _authService.LogoutAsync();
        LoggedOut?.Invoke();
    }

    private void StartPeriodicQueuePing()
    {
        _pollingTimer = new Timer(async _ =>
        {
            if (_isDisposed) return;
            try
            {
                foreach (var printer in Printers.ToList())
                {
                    await _windowsPrinterService.UpdatePrinterStatusAsync(printer);
                }

                _dispatcherQueue?.TryEnqueue(() =>
                {
                    OnPropertyChanged(nameof(Printers));
                });
            }
            catch
            {
                // Ignore transient polling exceptions
            }
        }, null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
    }

    private void StopPeriodicQueuePing()
    {
        _pollingTimer?.Dispose();
        _pollingTimer = null;
    }

    public void Dispose()
    {
        _isDisposed = true;
        StopPeriodicQueuePing();
    }
}
