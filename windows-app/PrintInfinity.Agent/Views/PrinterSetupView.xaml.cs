using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent.Views;

public sealed partial class PrinterSetupView : UserControl
{
    private PrinterSetupViewModel? _viewModel;
    public PrinterSetupViewModel? ViewModel
    {
        get => _viewModel;
        set
        {
            _viewModel = value;
            this.Bindings.Update();
        }
    }

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

    private void OnDeletePrinterClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: PrinterItem item } && ViewModel != null)
        {
            ViewModel.RemovePrinter(item);
        }
    }

    private async void OnAddCustomPrinterClick(object sender, RoutedEventArgs e)
    {
        if (ViewModel == null) return;

        // Simple inline dialog: ask for friendly name
        var dialog = new ContentDialog
        {
            Title = "Add Custom Printer",
            PrimaryButtonText = "Add",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Primary,
            XamlRoot = this.XamlRoot
        };

        var nameBox = new TextBox
        {
            PlaceholderText = "Windows printer name (e.g. HP LaserJet Pro M404n)",
            Header = "Printer Name",
            Background = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.ColorHelper.FromArgb(255, 11, 11, 20)),
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.White)
        };

        dialog.Content = nameBox;
        var result = await dialog.ShowAsync();

        if (result == ContentDialogResult.Primary && !string.IsNullOrWhiteSpace(nameBox.Text))
        {
            ViewModel.AddCustomPrinter(nameBox.Text.Trim());
        }
    }
}
