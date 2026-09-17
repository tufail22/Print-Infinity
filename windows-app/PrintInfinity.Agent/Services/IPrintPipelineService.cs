using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public class PrintPipelineEvent
{
    public Guid JobId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsError { get; set; }
}

public interface IPrintPipelineService : IDisposable
{
    event EventHandler<PrintPipelineEvent>? PipelineEventOccurred;
    event EventHandler<AuditLogEntry>? AuditLogGenerated;

    /// <summary>
    /// Enqueues a job for background processing: printer matching -> in-memory download -> silent print -> spooler monitoring -> storage cleanup.
    /// Non-blocking, returns immediately while background channel processes jobs sequentially.
    /// </summary>
    Task EnqueueJobAsync(
        QueueItem job,
        Func<List<PrinterItem>, Task<PrinterItem?>> selectPrinterCallback
    );
}
