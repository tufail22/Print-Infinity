using System;
using System.Linq;
using Microsoft.UI.Xaml;

namespace PrintInfinity.Agent;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : Application
{
    private MainWindow? _mainWindow;

    public App()
    {
        this.InitializeComponent();
        this.UnhandledException += App_UnhandledException;
    }

    private void App_UnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        e.Handled = true;
        Program.Log($"[FATAL] App.UnhandledException: {e.Exception}");
        Program.ShowFatalDialog("XAML Runtime Exception", e.Exception);
    }

    /// <summary>
    /// Invoked when the application is launched normally by the end user or automatically at Windows startup.
    /// </summary>
    /// <param name="args">Details about the launch request and process.</param>
    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        try
        {
            Program.Log("App.OnLaunched invoked. Creating MainWindow...");
            _mainWindow = new MainWindow();
            Program.Log("MainWindow instance created successfully.");

            string[] cmdArgs = Environment.GetCommandLineArgs();
            bool startInTray = cmdArgs.Any(a =>
                a.Equals("--tray", StringComparison.OrdinalIgnoreCase) ||
                a.Equals("-tray", StringComparison.OrdinalIgnoreCase) ||
                a.Equals("--minimized", StringComparison.OrdinalIgnoreCase) ||
                a.Equals("-minimized", StringComparison.OrdinalIgnoreCase));

            if (startInTray)
            {
                Program.Log("Starting minimized to system tray...");
                _mainWindow.StartMinimizedToTray();
            }
            else
            {
                Program.Log("Activating MainWindow...");
                _mainWindow.Activate();
                Program.Log("MainWindow.Activate() succeeded.");
            }
        }
        catch (Exception ex)
        {
            Program.Log($"[FATAL] Exception in OnLaunched: {ex}");
            Program.ShowFatalDialog("Window Launch Error", ex);
        }
    }
}

