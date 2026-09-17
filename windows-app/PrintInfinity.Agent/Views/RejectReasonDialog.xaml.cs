using Microsoft.UI.Xaml.Controls;

namespace PrintInfinity.Agent.Views;

public sealed partial class RejectReasonDialog : ContentDialog
{
    public string RejectionReason => ReasonInput.Text.Trim();

    public RejectReasonDialog()
    {
        this.InitializeComponent();
    }

    private void OnPrimaryButtonClick(ContentDialog sender, ContentDialogButtonClickEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(ReasonInput.Text))
        {
            ErrorText.Visibility = Microsoft.UI.Xaml.Visibility.Visible;
            args.Cancel = true;
        }
    }
}
