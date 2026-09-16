using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent;

/// <summary>
/// Main dashboard window for the Storekeeper Print Infinity Agent.
/// </summary>
public sealed partial class MainWindow : Window
{
    public MainViewModel ViewModel { get; }

    public MainWindow()
    {
        ViewModel = new MainViewModel(new SupabaseRealtimeService(), new PrintStreamService());
        this.InitializeComponent();
    }

    private async void OnConfirmCashClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: PrintJob job })
        {
            await ViewModel.ConfirmCashReceivedCommand.ExecuteAsync(job);
        }
    }

    private async void OnApproveClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: PrintJob job })
        {
            await ViewModel.ApproveJobCommand.ExecuteAsync(job);
        }
    }

    private async void OnRejectClick(object sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: PrintJob job })
        {
            await ViewModel.RejectJobCommand.ExecuteAsync(job);
        }
    }
}
