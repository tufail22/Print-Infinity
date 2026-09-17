using System;
using System.Threading;
using System.Threading.Tasks;

namespace PrintInfinity.Agent.Services.Printing;

public class SpoolerResult
{
    public bool Success { get; set; }
    public string? ErrorReason { get; set; }
    public int PagesPrinted { get; set; }
    public int TotalPages { get; set; }
}

public interface IPrintSpoolerMonitor
{
    Task<SpoolerResult> WaitForJobCompletionAsync(
        string printerName,
        string documentName,
        TimeSpan timeout,
        Action<string>? onStatusUpdate = null,
        CancellationToken cancellationToken = default
    );
}
