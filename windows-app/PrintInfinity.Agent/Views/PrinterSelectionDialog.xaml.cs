using System.Collections.Generic;
using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Views;

public sealed partial class PrinterSelectionDialog : ContentDialog
{
    public PrinterItem? SelectedPrinter { get; private set; }

    public PrinterSelectionDialog(List<PrinterItem> candidatePrinters)
    {
        this.InitializeComponent();
        PrintersList.ItemsSource = candidatePrinters;
        if (candidatePrinters.Count > 0)
        {
            PrintersList.SelectedIndex = 0;
            SelectedPrinter = candidatePrinters[0];
            IsPrimaryButtonEnabled = true;
        }
    }

    private void OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        SelectedPrinter = PrintersList.SelectedItem as PrinterItem;
        IsPrimaryButtonEnabled = SelectedPrinter != null;
    }

    private void OnPrimaryButtonClick(ContentDialog sender, ContentDialogButtonClickEventArgs args)
    {
        SelectedPrinter = PrintersList.SelectedItem as PrinterItem;
        if (SelectedPrinter == null)
        {
            args.Cancel = true;
        }
    }
}
