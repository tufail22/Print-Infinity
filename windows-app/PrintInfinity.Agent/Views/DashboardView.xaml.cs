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

        UpdateTabButton(BtnTabQueue, tab == "Queue");
        UpdateTabButton(BtnTabPrinters, tab == "Printers");
        UpdateTabButton(BtnTabAudit, tab == "Audit");
    }

    private static void UpdateTabButton(Button btn, bool isActive)
    {
        if (isActive)
        {
            btn.Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.White);
            btn.BorderBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(255, 226, 232, 240));
            btn.BorderThickness = new Thickness(1);
        }
        else
        {
            btn.Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.Colors.Transparent);
            btn.BorderThickness = new Thickness(0);
        }

        if (btn.Content is StackPanel sp)
        {
            var activeBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(255, 67, 56, 202));
            var inactiveBrush = new Microsoft.UI.Xaml.Media.SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(255, 100, 116, 139));

            foreach (var child in sp.Children)
            {
                if (child is FontIcon fi)
                    fi.Foreground = isActive ? activeBrush : inactiveBrush;
                else if (child is TextBlock tb)
                {
                    tb.Foreground = isActive ? activeBrush : inactiveBrush;
                    tb.FontWeight = isActive ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Medium;
                }
            }
        }
    }

    private void OnTabQueueClick(object sender, RoutedEventArgs e)
    {
        SelectTab("Queue");
        PrinterSetupVm.SetActiveTab(false);
    }

    private async void OnTabPrintersClick(object sender, RoutedEventArgs e)
    {
        SelectTab("Printers");
        PrinterSetupVm.SetActiveTab(true);
        if (PrinterSetupVm.Printers.Count == 0)
        {
            await PrinterSetupVm.LoadPrintersAsync();
        }
    }

    private void OnTabAuditClick(object sender, RoutedEventArgs e)
    {
        SelectTab("Audit");
        PrinterSetupVm.SetActiveTab(false);
    }

    // ── Job Actions ───────────────────────────────────────────────────────

    private async void OnApproveJobClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: QueueItem job })
        {
            if (job.IsApproving) return;
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
