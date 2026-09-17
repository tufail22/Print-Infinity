using System.Threading;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services.Printing;

public interface IPrintEngine
{
    /// <summary>
    /// Silently renders and dispatches a document from an in-memory byte buffer to the specified printer.
    /// Never creates or writes temporary files to disk.
    /// </summary>
    /// <returns>The unique DocumentName passed to the Windows Print Spooler for tracking.</returns>
    Task<string> PrintAsync(
        byte[] fileBytes,
        string fileExtension,
        PrinterItem targetPrinter,
        PrintJobRecord job,
        CancellationToken cancellationToken = default
    );
}
