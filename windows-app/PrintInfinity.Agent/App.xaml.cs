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
    }

    /// <summary>
    /// Invoked when the application is launched normally by the end user or automatically at Windows startup.
    /// </summary>
    /// <param name="args">Details about the launch request and process.</param>
    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        _mainWindow = new MainWindow();

        string[] cmdArgs = Environment.GetCommandLineArgs();
        bool startInTray = cmdArgs.Any(a =>
            a.Equals("--tray", StringComparison.OrdinalIgnoreCase) ||
            a.Equals("-tray", StringComparison.OrdinalIgnoreCase) ||
            a.Equals("--minimized", StringComparison.OrdinalIgnoreCase) ||
            a.Equals("-minimized", StringComparison.OrdinalIgnoreCase));

        if (startInTray)
        {
            _mainWindow.StartMinimizedToTray();
        }
        else
        {
            _mainWindow.Activate();
        }
    }
}

