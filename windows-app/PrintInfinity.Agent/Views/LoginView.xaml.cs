using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent.Views;

public sealed partial class LoginView : UserControl
{
    public LoginViewModel? ViewModel { get; set; }

    public LoginView()
    {
        this.InitializeComponent();
    }
}
