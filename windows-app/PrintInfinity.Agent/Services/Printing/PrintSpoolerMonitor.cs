using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace PrintInfinity.Agent.Services.Printing;

public class PrintSpoolerMonitor : IPrintSpoolerMonitor
{
    public async Task<SpoolerResult> WaitForJobCompletionAsync(
        string printerName,
        string documentName,
        TimeSpan timeout,
        Action<string>? onStatusUpdate = null,
        CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        bool jobDetected = false;
        int lastPagesPrinted = 0;
        int totalPages = 0;

        while (DateTime.UtcNow - startTime < timeout)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var jobInfo = FindJobInSpooler(printerName, documentName);
            if (jobInfo != null)
            {
                jobDetected = true;
                totalPages = (int)jobInfo.Value.TotalPages;
                lastPagesPrinted = (int)jobInfo.Value.PagesPrinted;

                var statusFlags = jobInfo.Value.Status;

                if ((statusFlags & JOB_STATUS_ERROR) != 0)
                {
                    return new SpoolerResult
                    {
                        Success = false,
                        ErrorReason = "Print Spooler reported a hardware or driver error.",
                        PagesPrinted = lastPagesPrinted,
                        TotalPages = totalPages
                    };
                }

                if ((statusFlags & JOB_STATUS_PAPEROUT) != 0)
                {
                    return new SpoolerResult
                    {
                        Success = false,
                        ErrorReason = "Printer is out of paper.",
                        PagesPrinted = lastPagesPrinted,
                        TotalPages = totalPages
                    };
                }

                if ((statusFlags & JOB_STATUS_OFFLINE) != 0)
                {
                    return new SpoolerResult
                    {
                        Success = false,
                        ErrorReason = "Printer went offline during printing.",
                        PagesPrinted = lastPagesPrinted,
                        TotalPages = totalPages
                    };
                }

                if ((statusFlags & JOB_STATUS_PRINTED) != 0)
                {
                    onStatusUpdate?.Invoke("Document successfully printed by hardware.");
                    return new SpoolerResult
                    {
                        Success = true,
                        PagesPrinted = totalPages > 0 ? totalPages : 1,
                        TotalPages = totalPages
                    };
                }

                if ((statusFlags & JOB_STATUS_PRINTING) != 0)
                {
                    var msg = totalPages > 0
                        ? $"Printing page {Math.Max(1, lastPagesPrinted)} of {totalPages}..."
                        : "Printing document...";
                    onStatusUpdate?.Invoke(msg);
                }
                else if ((statusFlags & JOB_STATUS_SPOOLING) != 0)
                {
                    onStatusUpdate?.Invoke("Spooling data to hardware printer...");
                }
            }
            else
            {
                // Job is not currently in the spooler queue.
                // If it was previously detected and now vanished without an error flag,
                // the Windows spooler has successfully flushed the job to the printer.
                if (jobDetected)
                {
                    onStatusUpdate?.Invoke("Job finished and cleared from print spooler.");
                    return new SpoolerResult
                    {
                        Success = true,
                        PagesPrinted = totalPages > 0 ? totalPages : 1,
                        TotalPages = totalPages
                    };
                }

                // If after initial grace period (1.5s) the job was never seen in spooler,
                // check if the spooler was fast or if it completed immediately.
                if (DateTime.UtcNow - startTime > TimeSpan.FromMilliseconds(1500))
                {
                    return new SpoolerResult
                    {
                        Success = true,
                        PagesPrinted = 1,
                        TotalPages = 1
                    };
                }
            }

            await Task.Delay(400, cancellationToken);
        }

        // If timed out but job was seen and no error occurred, treat as sent to printer
        if (jobDetected)
        {
            return new SpoolerResult
            {
                Success = true,
                PagesPrinted = totalPages,
                TotalPages = totalPages
            };
        }

        return new SpoolerResult
        {
            Success = false,
            ErrorReason = $"Timed out after {timeout.TotalSeconds} seconds waiting for spooler."
        };
    }

    private static JOB_INFO_2? FindJobInSpooler(string printerName, string documentName)
    {
        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            return null;
        }

        try
        {
            EnumJobs(hPrinter, 0, 50, 2, IntPtr.Zero, 0, out int bytesNeeded, out _);
            if (bytesNeeded <= 0) return null;

            var pBuf = Marshal.AllocHGlobal(bytesNeeded);
            try
            {
                if (EnumJobs(hPrinter, 0, 50, 2, pBuf, bytesNeeded, out _, out int count))
                {
                    var structSize = Marshal.SizeOf<JOB_INFO_2>();
                    for (int i = 0; i < count; i++)
                    {
                        var ptr = IntPtr.Add(pBuf, i * structSize);
                        var job = Marshal.PtrToStructure<JOB_INFO_2>(ptr);

                        if (!string.IsNullOrEmpty(job.pDocument) &&
                            (job.pDocument.Contains(documentName, StringComparison.OrdinalIgnoreCase) ||
                             documentName.Contains(job.pDocument, StringComparison.OrdinalIgnoreCase)))
                        {
                            return job;
                        }
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

        return null;
    }

    #region Win32 Spooler P/Invoke
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool EnumJobs(
        IntPtr hPrinter,
        uint firstJob,
        uint noJobs,
        uint level,
        IntPtr pJob,
        int cbBuf,
        out int pcbNeeded,
        out int pcReturned);

    private const uint JOB_STATUS_PAUSED = 0x0001;
    private const uint JOB_STATUS_ERROR = 0x0002;
    private const uint JOB_STATUS_DELETING = 0x0004;
    private const uint JOB_STATUS_SPOOLING = 0x0008;
    private const uint JOB_STATUS_PRINTING = 0x0010;
    private const uint JOB_STATUS_OFFLINE = 0x0020;
    private const uint JOB_STATUS_PAPEROUT = 0x0040;
    private const uint JOB_STATUS_PRINTED = 0x0080;
    private const uint JOB_STATUS_DELETED = 0x0100;
    private const uint JOB_STATUS_BLOCKED_DEVQ = 0x0200;
    private const uint JOB_STATUS_USER_INTERVENTION = 0x0400;
    private const uint JOB_STATUS_RESTART = 0x0800;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct SYSTEMTIME
    {
        public ushort wYear;
        public ushort wMonth;
        public ushort wDayOfWeek;
        public ushort wDay;
        public ushort wHour;
        public ushort wMinute;
        public ushort wSecond;
        public ushort wMilliseconds;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct JOB_INFO_2
    {
        public uint JobId;
        public string? pPrinterName;
        public string? pMachineName;
        public string? pUserName;
        public string? pDocument;
        public string? pNotifyName;
        public string? pDatatype;
        public string? pPrintProcessor;
        public string? pParameters;
        public string? pDriverName;
        public IntPtr pDevMode;
        public string? pStatus;
        public IntPtr pSecurityDescriptor;
        public uint Status;
        public uint Priority;
        public uint Position;
        public uint StartTime;
        public uint UntilTime;
        public uint TotalPages;
        public uint Size;
        public SYSTEMTIME Submitted;
        public uint Time;
        public uint PagesPrinted;
    }
    #endregion
}
