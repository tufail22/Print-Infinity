using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent.Views;

public sealed partial class DashboardView : UserControl
{
    private readonly ISystemTrayService _systemTrayService;

    public LiveQueueViewModel QueueVm { get; }
    public PrinterSetupViewModel PrinterSetupVm { get; }

    public event Action? LoggedOut;

    public DashboardView(
        LiveQueueViewModel queueVm,
        PrinterSetupViewModel printerSetupVm,
        ISystemTrayService systemTrayService)
    {
        QueueVm = queueVm;
        PrinterSetupVm = printerSetupVm;
        _systemTrayService = systemTrayService;

        this.InitializeComponent();

        PrinterSetupControl.ViewModel = PrinterSetupVm;
        this.Loaded += (s, e) =>
        {
            QueueVm.XamlRoot = this.XamlRoot;
        };
    }

    // ── Tab Switching ─────────────────────────────────────────────────────

    private void SelectTab(string tab)
    {
        QueueSection.Visibility    = tab == "Queue"    ? Visibility.Visible : Visibility.Collapsed;
        PrintersSection.Visibility = tab == "Printers" ? Visibility.Visible : Visibility.Collapsed;
        AuditSection.Visibility    = tab == "Audit"    ? Visibility.Visible : Visibility.Collapsed;

        BtnTabQueue.IsChecked    = tab == "Queue";
        BtnTabPrinters.IsChecked = tab == "Printers";
        BtnTabAudit.IsChecked    = tab == "Audit";
    }

    private void OnTabQueueClick(object sender, RoutedEventArgs e)    => SelectTab("Queue");
    private async void OnTabPrintersClick(object sender, RoutedEventArgs e)
    {
        SelectTab("Printers");
        if (PrinterSetupVm.Printers.Count == 0)
        {
            await PrinterSetupVm.LoadPrintersAsync();
        }
    }
    private void OnTabAuditClick(object sender, RoutedEventArgs e)    => SelectTab("Audit");

    // ── Job Actions ───────────────────────────────────────────────────────

    private async void OnApproveJobClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: QueueItem job })
        {
            await QueueVm.ApproveJobAsync(job);
        }
    }

    private async void OnRejectJobClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: QueueItem job })
        {
            var dialog = new RejectReasonDialog
            {
                XamlRoot = this.XamlRoot
            };

            var result = await dialog.ShowAsync();
            if (result == ContentDialogResult.Primary && !string.IsNullOrWhiteSpace(dialog.RejectionReason))
            {
                await QueueVm.RejectJobWithReasonAsync(job, dialog.RejectionReason);
            }
        }
    }

    // ── Window Controls ───────────────────────────────────────────────────

    private void OnMinimizeToTrayClick(object sender, RoutedEventArgs e)
    {
        _systemTrayService.HideToTray();
    }

    private async void OnSignOutClick(object sender, RoutedEventArgs e)
    {
        await PrinterSetupVm.LogoutAsync();
        LoggedOut?.Invoke();
    }
}
