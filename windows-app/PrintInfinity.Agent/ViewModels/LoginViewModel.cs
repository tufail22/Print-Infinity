using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using PrintInfinity.Agent.Services;

namespace PrintInfinity.Agent.ViewModels;

public partial class LoginViewModel : ObservableObject
{
    private readonly ISupabaseAuthService _authService;

    public event Action? LoginSucceeded;

    [ObservableProperty]
    private string _storeName = string.Empty;

    [ObservableProperty]
    private string _email = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private string _confirmPassword = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(RegisterFieldsVisibility))]
    [NotifyPropertyChangedFor(nameof(SubmitButtonText))]
    [NotifyPropertyChangedFor(nameof(ModeToggleText))]
    [NotifyPropertyChangedFor(nameof(TitleText))]
    private bool _isRegisterMode;

    [ObservableProperty]
    private bool _rememberMe = true;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsNotBusy))]
    [NotifyPropertyChangedFor(nameof(BusyVisibility))]
    [NotifyPropertyChangedFor(nameof(NotBusyVisibility))]
    private bool _isBusy;

    public bool IsNotBusy => !IsBusy;
    public Microsoft.UI.Xaml.Visibility RegisterFieldsVisibility =>
        IsRegisterMode ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility BusyVisibility =>
        IsBusy ? Microsoft.UI.Xaml.Visibility.Visible : Microsoft.UI.Xaml.Visibility.Collapsed;
    public Microsoft.UI.Xaml.Visibility NotBusyVisibility =>
        IsBusy ? Microsoft.UI.Xaml.Visibility.Collapsed : Microsoft.UI.Xaml.Visibility.Visible;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasSuccess))]
    private string _successMessage = string.Empty;

    public bool HasError => !string.IsNullOrWhiteSpace(ErrorMessage);
    public bool HasSuccess => !string.IsNullOrWhiteSpace(SuccessMessage);

    public string TitleText => IsRegisterMode ? "Register New Shop & Storekeeper" : "Storekeeper Login";
    public string SubmitButtonText => IsRegisterMode ? "Create Account & Register Shop" : "Sign In to Shop PC";
    public string ModeToggleText => IsRegisterMode
        ? "Already registered? Sign In to Existing Shop"
        : "First time launching? Register this Shop's PC";

    public LoginViewModel(ISupabaseAuthService authService)
    {
        _authService = authService;
    }

    [RelayCommand]
    private void ToggleMode()
    {
        IsRegisterMode = !IsRegisterMode;
        ErrorMessage = string.Empty;
        SuccessMessage = string.Empty;
    }

    [RelayCommand]
    private async Task SubmitAsync()
    {
        ErrorMessage = string.Empty;
        SuccessMessage = string.Empty;

        if (IsRegisterMode && string.IsNullOrWhiteSpace(StoreName))
        {
            ErrorMessage = "Please enter your Shop / Store Name.";
            return;
        }

        if (string.IsNullOrWhiteSpace(Email))
        {
            ErrorMessage = "Please enter storekeeper email address.";
            return;
        }

        if (string.IsNullOrWhiteSpace(Password) || Password.Length < 6)
        {
            ErrorMessage = "Password must be at least 6 characters.";
            return;
        }

        if (IsRegisterMode && Password != ConfirmPassword)
        {
            ErrorMessage = "Passwords do not match.";
            return;
        }

        IsBusy = true;
        try
        {
            if (IsRegisterMode)
            {
                var registered = await _authService.RegisterAsync(Email.Trim(), Password, StoreName.Trim());
                if (registered)
                {
                    SuccessMessage = "Storekeeper registered successfully! Connecting to store...";
                    LoginSucceeded?.Invoke();
                }
            }
            else
            {
                var loggedIn = await _authService.LoginAsync(Email.Trim(), Password, RememberMe);
                if (loggedIn)
                {
                    SuccessMessage = "Signed in successfully!";
                    LoginSucceeded?.Invoke();
                }
                else
                {
                    ErrorMessage = "Invalid email or password.";
                }
            }
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message.Contains("Invalid login credentials")
                ? "Invalid email or password."
                : ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<bool> CheckAutoLoginAsync()
    {
        IsBusy = true;
        try
        {
            Program.Log("LoginViewModel: Verifying stored Supabase session with cloud server...");
            var restored = await _authService.TryRestoreSessionAsync();
            if (restored)
            {
                Program.Log("LoginViewModel: Verified valid session with Supabase! Navigating to dashboard...");
                LoginSucceeded?.Invoke();
                return true;
            }
            Program.Log("LoginViewModel: No valid verified Supabase session found. Displaying login screen.");
        }
        catch (Exception ex)
        {
            Program.Log($"LoginViewModel: Session check exception: {ex.Message}. Displaying login screen.");
        }
        finally
        {
            IsBusy = false;
        }
        return false;
    }
}
