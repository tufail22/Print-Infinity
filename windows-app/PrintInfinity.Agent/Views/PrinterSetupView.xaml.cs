using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent.Views;

public sealed partial class PrinterSetupView : UserControl
{
    public PrinterSetupViewModel? ViewModel { get; set; }

    public PrinterSetupView()
    {
        this.InitializeComponent();
    }

    private async void OnSaveSinglePrinterClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: PrinterItem item } && ViewModel != null)
        {
            await ViewModel.SavePrinterAsync(item);
        }
    }
}
