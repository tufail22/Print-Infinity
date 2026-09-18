using Microsoft.UI.Xaml.Controls;
using PrintInfinity.Agent.ViewModels;

namespace PrintInfinity.Agent.Views;

public sealed partial class LoginView : UserControl
{
    private LoginViewModel? _viewModel;
    public LoginViewModel? ViewModel
    {
        get => _viewModel;
        set
        {
            _viewModel = value;
            this.Bindings.Update();
        }
    }

    public LoginView()
    {
        this.InitializeComponent();
    }

    private void PasswordInput_PasswordChanged(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (ViewModel != null)
        {
            ViewModel.Password = PasswordInput.Password;
        }
    }

    private void ConfirmPasswordInput_PasswordChanged(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (ViewModel != null)
        {
            ViewModel.ConfirmPassword = ConfirmPasswordInput.Password;
        }
    }
}
