using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
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

    private void OnViewSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (ViewSelector.SelectedIndex == 0)
        {
            QueueSection.Visibility = Visibility.Visible;
            PrintersSection.Visibility = Visibility.Collapsed;
            AuditSection.Visibility = Visibility.Collapsed;
        }
        else if (ViewSelector.SelectedIndex == 1)
        {
            QueueSection.Visibility = Visibility.Collapsed;
            PrintersSection.Visibility = Visibility.Visible;
            AuditSection.Visibility = Visibility.Collapsed;
        }
        else if (ViewSelector.SelectedIndex == 2)
        {
            QueueSection.Visibility = Visibility.Collapsed;
            PrintersSection.Visibility = Visibility.Collapsed;
            AuditSection.Visibility = Visibility.Visible;
        }
    }

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
