using System;
using CommunityToolkit.Mvvm.ComponentModel;

namespace PrintInfinity.Agent.Models;

public partial class PrinterItem : ObservableObject
{
    public Guid? Id { get; set; }

    [ObservableProperty]
    private string _windowsPrinterName = string.Empty;

    [ObservableProperty]
    private string _displayName = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsColor))]
    [NotifyPropertyChangedFor(nameof(IsBw))]
    private string _type = "bw"; // 'color' or 'bw'

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsUsb))]
    [NotifyPropertyChangedFor(nameof(IsWifi))]
    private string _connection = "usb"; // 'usb' or 'wifi'

    [ObservableProperty]
    private string _portName = string.Empty;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(StatusBadgeColor))]
    [NotifyPropertyChangedFor(nameof(StatusBadgeIcon))]
    private bool _isOnline;

    [ObservableProperty]
    private string _statusText = "Checking...";

    [ObservableProperty]
    private bool _isCloudSynced;

    [ObservableProperty]
    private bool _isSaving;

    [ObservableProperty]
    private string _lastSavedAtText = string.Empty;

    public bool IsColor
    {
        get => string.Equals(Type, "color", StringComparison.OrdinalIgnoreCase);
        set
        {
            if (value) Type = "color";
        }
    }

    public bool IsBw
    {
        get => string.Equals(Type, "bw", StringComparison.OrdinalIgnoreCase);
        set
        {
            if (value) Type = "bw";
        }
    }

    public bool IsUsb
    {
        get => string.Equals(Connection, "usb", StringComparison.OrdinalIgnoreCase);
        set
        {
            if (value) Connection = "usb";
        }
    }

    public bool IsWifi
    {
        get => string.Equals(Connection, "wifi", StringComparison.OrdinalIgnoreCase);
        set
        {
            if (value) Connection = "wifi";
        }
    }

    public string StatusBadgeColor => IsOnline ? "#10B981" : "#EF4444";
    public string StatusBadgeIcon => IsOnline ? "\uE73E" : "\uE711"; // Checkmark vs Warning/Error in Segoe Fluent Icons
}
