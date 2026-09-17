using System;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using WinRT.Interop;

namespace PrintInfinity.Agent.Services;

public interface ISystemTrayService : IDisposable
{
    void Initialize(Window window);
    void ShowNotification(string title, string message);
    void HideToTray();
    void RestoreFromTray();
    event Action? RestoreRequested;
    event Action? ExitRequested;
}

public class SystemTrayService : ISystemTrayService
{
    private IntPtr _hwnd = IntPtr.Zero;
    private NOTIFYICONDATA _nid;
    private bool _isInitialized;
    private SubclassProc? _subclassDelegate;

    public event Action? RestoreRequested;
    public event Action? ExitRequested;

    public void Initialize(Window window)
    {
        if (_isInitialized) return;

        _hwnd = WindowNative.GetWindowHandle(window);
        _subclassDelegate = WindowSubclassProc;

        SetWindowSubclass(_hwnd, _subclassDelegate, SubclassId, IntPtr.Zero);

        _nid = new NOTIFYICONDATA
        {
            cbSize = (uint)Marshal.SizeOf<NOTIFYICONDATA>(),
            hWnd = _hwnd,
            uID = 1001,
            uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP,
            uCallbackMessage = WM_TRAYICON,
            hIcon = LoadIcon(IntPtr.Zero, (IntPtr)IDI_APPLICATION),
            szTip = "Print Infinity Agent — Always On"
        };

        Shell_NotifyIcon(NIM_ADD, ref _nid);
        _isInitialized = true;
    }

    public void ShowNotification(string title, string message)
    {
        if (!_isInitialized) return;

        var balloonNid = new NOTIFYICONDATA
        {
            cbSize = (uint)Marshal.SizeOf<NOTIFYICONDATA>(),
            hWnd = _hwnd,
            uID = 1001,
            uFlags = NIF_INFO,
            szInfo = message.Length > 255 ? message.Substring(0, 255) : message,
            szInfoTitle = title.Length > 63 ? title.Substring(0, 63) : title,
            dwInfoFlags = NIIF_INFO
        };

        Shell_NotifyIcon(NIM_MODIFY, ref balloonNid);
    }

    public void HideToTray()
    {
        if (_hwnd != IntPtr.Zero)
        {
            ShowWindow(_hwnd, SW_HIDE);
        }
    }

    public void RestoreFromTray()
    {
        if (_hwnd != IntPtr.Zero)
        {
            ShowWindow(_hwnd, SW_RESTORE);
            ShowWindow(_hwnd, SW_SHOW);
            SetForegroundWindow(_hwnd);
        }
        RestoreRequested?.Invoke();
    }

    private IntPtr WindowSubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, IntPtr uIdSubclass, IntPtr dwRefData)
    {
        if (uMsg == WM_TRAYICON)
        {
            var msg = (uint)lParam.ToInt64();
            if (msg == WM_LBUTTONUP || msg == WM_LBUTTONDBLCLK || msg == NIN_BALLOONUSERCLICK)
            {
                RestoreFromTray();
                return IntPtr.Zero;
            }
            else if (msg == WM_RBUTTONUP)
            {
                ExitRequested?.Invoke();
                return IntPtr.Zero;
            }
        }

        return DefSubclassProc(hWnd, uMsg, wParam, lParam);
    }

    public void Dispose()
    {
        if (_isInitialized)
        {
            Shell_NotifyIcon(NIM_DELETE, ref _nid);
            if (_hwnd != IntPtr.Zero && _subclassDelegate != null)
            {
                RemoveWindowSubclass(_hwnd, _subclassDelegate, SubclassId);
            }
            _isInitialized = false;
        }
    }

    #region Win32 P/Invoke
    private const uint WM_USER = 0x0400;
    private const uint WM_TRAYICON = WM_USER + 101;
    private const uint WM_LBUTTONUP = 0x0202;
    private const uint WM_LBUTTONDBLCLK = 0x0203;
    private const uint WM_RBUTTONUP = 0x0205;
    private const uint NIN_BALLOONUSERCLICK = WM_USER + 5;

    private const uint NIM_ADD = 0x00000000;
    private const uint NIM_MODIFY = 0x00000001;
    private const uint NIM_DELETE = 0x00000002;

    private const uint NIF_MESSAGE = 0x00000001;
    private const uint NIF_ICON = 0x00000002;
    private const uint NIF_TIP = 0x00000004;
    private const uint NIF_INFO = 0x00000010;

    private const uint NIIF_INFO = 0x00000001;

    private const int IDI_APPLICATION = 32512;
    private const int SW_HIDE = 0;
    private const int SW_SHOW = 5;
    private const int SW_RESTORE = 9;
    private const uint SubclassId = 1984;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NOTIFYICONDATA
    {
        public uint cbSize;
        public IntPtr hWnd;
        public uint uID;
        public uint uFlags;
        public uint uCallbackMessage;
        public IntPtr hIcon;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szTip;
        public uint dwState;
        public uint dwStateMask;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string szInfo;
        public uint uTimeoutOrVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string szInfoTitle;
        public uint dwInfoFlags;
        public Guid guidItem;
        public IntPtr hBalloonIcon;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern bool Shell_NotifyIcon(uint dwMessage, ref NOTIFYICONDATA lpData);

    [DllImport("user32.dll")]
    private static extern IntPtr LoadIcon(IntPtr hInstance, IntPtr lpIconName);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private delegate IntPtr SubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, IntPtr uIdSubclass, IntPtr dwRefData);

    [DllImport("comctl32.dll")]
    private static extern bool SetWindowSubclass(IntPtr hWnd, SubclassProc pfnSubclass, uint uIdSubclass, IntPtr dwRefData);

    [DllImport("comctl32.dll")]
    private static extern bool RemoveWindowSubclass(IntPtr hWnd, SubclassProc pfnSubclass, uint uIdSubclass);

    [DllImport("comctl32.dll")]
    private static extern IntPtr DefSubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam);
    #endregion
}
