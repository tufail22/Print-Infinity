using System;
using System.Collections.Generic;
using System.Management;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public interface IWindowsPrinterService
{
    Task<List<PrinterItem>> GetInstalledPrintersAsync();
    Task UpdatePrinterStatusAsync(PrinterItem printer);
}

public class WindowsPrinterService : IWindowsPrinterService
{
    public Task<List<PrinterItem>> GetInstalledPrintersAsync()
    {
        return Task.Run(() =>
        {
            var printers = new List<PrinterItem>();

            try
            {
                using var searcher = new ManagementObjectSearcher(
                    "SELECT Name, WorkOffline, PrinterStatus, ExtendedPrinterStatus, PortName, DriverName FROM Win32_Printer"
                );

                using var collection = searcher.Get();
                foreach (ManagementObject mo in collection)
                {
                    var name = mo["Name"]?.ToString() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    var portName = mo["PortName"]?.ToString() ?? string.Empty;
                    var (isOnline, statusText) = EvaluateStatus(mo);

                    // Guess initial connection based on port (storekeeper can toggle)
                    var connection = IsLikelyUsbPort(portName) ? "usb" : "wifi";

                    // Guess initial color type based on printer name (storekeeper can toggle)
                    var type = IsLikelyColorPrinter(name) ? "color" : "bw";

                    printers.Add(new PrinterItem
                    {
                        WindowsPrinterName = name,
                        DisplayName = name,
                        Type = type,
                        Connection = connection,
                        PortName = portName,
                        IsOnline = isOnline,
                        StatusText = statusText
                    });
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"WMI query failed, using Win32 Spooler fallback: {ex.Message}");
                return GetPrintersViaSpoolerFallback();
            }

            return printers;
        });
    }

    public Task UpdatePrinterStatusAsync(PrinterItem printer)
    {
        return Task.Run(() =>
        {
            // Fast Win32 Spooler API: Microsecond latency, no WMI COM overhead or CPU spikes
            CheckSpoolerStatus(printer);
        });
    }

    private static (bool IsOnline, string StatusText) EvaluateStatus(ManagementBaseObject mo)
    {
        var workOffline = (bool?)mo["WorkOffline"] ?? false;
        if (workOffline)
        {
            return (false, "Offline (Spooler Work Offline)");
        }

        var extStatus = Convert.ToUInt32(mo["ExtendedPrinterStatus"] ?? 0);
        var status = Convert.ToUInt32(mo["PrinterStatus"] ?? 0);

        if (extStatus == 7 || status == 7)
        {
            return (false, "Offline / Disconnected");
        }
        if (extStatus == 8)
        {
            return (false, "Paused");
        }
        if (extStatus == 9)
        {
            return (false, "Printer Error");
        }
        if (extStatus == 11)
        {
            return (false, "Not Available");
        }

        return (true, "Online / Ready");
    }

    private static bool IsLikelyUsbPort(string portName)
    {
        if (string.IsNullOrWhiteSpace(portName)) return false;
        var lower = portName.ToLowerInvariant();
        return lower.StartsWith("usb") || lower.StartsWith("dot4") || lower.Contains("usb");
    }

    private static bool IsLikelyColorPrinter(string printerName)
    {
        if (string.IsNullOrWhiteSpace(printerName)) return false;
        var lower = printerName.ToLowerInvariant();
        return lower.Contains("color") || lower.Contains("cmyk") || lower.Contains("colour") || lower.Contains("ir c");
    }

    #region Win32 Spooler Fallback
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool GetPrinter(IntPtr hPrinter, int dwLevel, IntPtr pPrinter, int cbBuf, out int pcbNeeded);

    private const int PRINTER_STATUS_PAUSED = 0x00000001;
    private const int PRINTER_STATUS_ERROR = 0x00000002;
    private const int PRINTER_STATUS_PAPER_JAM = 0x00000008;
    private const int PRINTER_STATUS_OFFLINE = 0x00000080;
    private const int PRINTER_STATUS_USER_INTERVENTION = 0x00001000;
    private const int PRINTER_ATTRIBUTE_WORK_OFFLINE = 0x00000400;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct PRINTER_INFO_2
    {
        public string? pServerName;
        public string? pPrinterName;
        public string? pShareName;
        public string? pPortName;
        public string? pDriverName;
        public string? pComment;
        public string? pLocation;
        public IntPtr pDevMode;
        public string? pSepFile;
        public string? pPrintProcessor;
        public string? pDatatype;
        public string? pParameters;
        public IntPtr pSecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint cJobs;
        public uint AveragePPM;
    }

    private static List<PrinterItem> GetPrintersViaSpoolerFallback()
    {
        var list = new List<PrinterItem>();
        // Fallback using System.Drawing.Printing.PrinterSettings if available
        foreach (string printerName in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
        {
            var item = new PrinterItem
            {
                WindowsPrinterName = printerName,
                DisplayName = printerName,
                Type = IsLikelyColorPrinter(printerName) ? "color" : "bw",
                Connection = "usb",
                IsOnline = true,
                StatusText = "Online"
            };
            CheckSpoolerStatus(item);
            list.Add(item);
        }
        return list;
    }

    public static void CheckSpoolerStatus(PrinterItem item)
    {
        if (!OpenPrinter(item.WindowsPrinterName, out var hPrinter, IntPtr.Zero))
        {
            item.IsOnline = false;
            item.StatusText = "Cannot open spooler";
            return;
        }

        try
        {
            GetPrinter(hPrinter, 2, IntPtr.Zero, 0, out int bytesNeeded);
            if (bytesNeeded <= 0) return;

            var pBuf = Marshal.AllocHGlobal(bytesNeeded);
            try
            {
                if (GetPrinter(hPrinter, 2, pBuf, bytesNeeded, out _))
                {
                    var info = Marshal.PtrToStructure<PRINTER_INFO_2>(pBuf);
                    var isOffline = (info.Attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE) != 0 ||
                                    (info.Status & PRINTER_STATUS_OFFLINE) != 0;

                    if (isOffline)
                    {
                        item.IsOnline = false;
                        item.StatusText = "Offline";
                    }
                    else if ((info.Status & PRINTER_STATUS_PAUSED) != 0)
                    {
                        item.IsOnline = false;
                        item.StatusText = "Paused";
                    }
                    else if ((info.Status & PRINTER_STATUS_PAPER_JAM) != 0)
                    {
                        item.IsOnline = false;
                        item.StatusText = "Paper Jam";
                    }
                    else if ((info.Status & PRINTER_STATUS_ERROR) != 0)
                    {
                        item.IsOnline = false;
                        item.StatusText = "Error";
                    }
                    else
                    {
                        item.IsOnline = true;
                        item.StatusText = "Online / Ready";
                    }

                    if (!string.IsNullOrEmpty(info.pPortName))
                    {
                        item.PortName = info.pPortName;
                    }
                }
            }
            finally
            {
                Marshal.FreeHGlobal(pBuf);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }
    #endregion
}
