using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services.Printing;

namespace PrintInfinity.Agent.Services;

public class PrintPipelineService : IPrintPipelineService
{
    private readonly ISupabaseAuthService _authService;
    private readonly IPrintEngine _printEngine;
    private readonly IPrintSpoolerMonitor _spoolerMonitor;
    private readonly ISystemTrayService _systemTrayService;
    private readonly Channel<PipelineTask> _channel;
    private readonly CancellationTokenSource _cts;
    private readonly Task _workerTask;

    public event EventHandler<PrintPipelineEvent>? PipelineEventOccurred;
    public event EventHandler<AuditLogEntry>? AuditLogGenerated;

    private record PipelineTask(
        QueueItem Job,
        Func<List<PrinterItem>, Task<PrinterItem?>> SelectPrinterCallback
    );

    public PrintPipelineService(
        ISupabaseAuthService authService,
        IPrintEngine printEngine,
        IPrintSpoolerMonitor spoolerMonitor,
        ISystemTrayService systemTrayService)
    {
        _authService = authService;
        _printEngine = printEngine;
        _spoolerMonitor = spoolerMonitor;
        _systemTrayService = systemTrayService;

        _channel = Channel.CreateUnbounded<PipelineTask>(new UnboundedChannelOptions
        {
            SingleReader = true
        });

        _cts = new CancellationTokenSource();
        _workerTask = Task.Run(ProcessQueueLoopAsync);
    }

    public async Task EnqueueJobAsync(
        QueueItem job,
        Func<List<PrinterItem>, Task<PrinterItem?>> selectPrinterCallback)
    {
        await _channel.Writer.WriteAsync(new PipelineTask(job, selectPrinterCallback));
    }

    private async Task ProcessQueueLoopAsync()
    {
        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                var task = await _channel.Reader.ReadAsync(_cts.Token);
                await ExecutePipelineTaskAsync(task);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PrintPipeline] Unexpected worker error: {ex.Message}");
            }
        }
    }

    private async Task ExecutePipelineTaskAsync(PipelineTask task)
    {
        var jobId = task.Job.Id;
        byte[]? inMemoryBuffer = null;
        string? signedUrl = null;

        try
        {
            await _authService.InitializeAsync();

            // 1. Fetch fresh PrintJobRecord
            var jobResponse = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.Id == jobId)
                .Single();

            if (jobResponse == null)
            {
                NotifyEvent(jobId, "Failed", "Print job not found in database.", isError: true);
                return;
            }

            // 2. Auto-select printer based on color_mode and is_online
            var targetMode = (jobResponse.ColorMode ?? "bw").ToLowerInvariant();
            var printerResponse = await _authService.Client.From<PrinterRecord>()
                .Where(p => p.StoreId == _authService.CurrentStoreId)
                .Where(p => p.Type == targetMode)
                .Where(p => p.IsOnline == true)
                .Get();

            var matchingPrinters = printerResponse.Models;
            PrinterItem? selectedPrinter = null;

            if (matchingPrinters.Count == 0)
            {
                var modeTitle = targetMode == "color" ? "Color" : "Black & White";
                var friendlyError = $"No online {modeTitle} printer found. Please check that your printer is turned on, has paper, and is connected to this PC.";
                
                jobResponse.Status = "failed";
                jobResponse.RejectionReason = friendlyError;
                jobResponse.UpdatedAt = DateTime.UtcNow;
                await _authService.Client.From<PrintJobRecord>().Update(jobResponse);

                NotifyEvent(jobId, "Failed", friendlyError, isError: true);
                _systemTrayService.ShowNotification("Printer Offline", friendlyError);
                return;
            }
            else if (matchingPrinters.Count == 1)
            {
                var p = matchingPrinters[0];
                selectedPrinter = new PrinterItem
                {
                    WindowsPrinterName = p.WindowsPrinterName,
                    DisplayName = p.Name,
                    Type = p.Type,
                    Connection = p.Connection,
                    IsOnline = p.IsOnline
                };
            }
            else
            {
                // Multiple online printers match: prompt storekeeper from strictly this filtered list
                var candidates = matchingPrinters.Select(p => new PrinterItem
                {
                    WindowsPrinterName = p.WindowsPrinterName,
                    DisplayName = p.Name,
                    Type = p.Type,
                    Connection = p.Connection,
                    IsOnline = p.IsOnline
                }).ToList();

                selectedPrinter = await task.SelectPrinterCallback(candidates);
                if (selectedPrinter == null)
                {
                    NotifyEvent(jobId, "Pending", "Printer selection cancelled by storekeeper.", isError: false);
                    return;
                }
            }

            // 3. Mark job as approved before spooling
            jobResponse.Status = "approved";
            jobResponse.UpdatedAt = DateTime.UtcNow;
            await _authService.Client.From<PrintJobRecord>().Update(jobResponse);
            NotifyEvent(jobId, "Approved", $"Approved. Routing to {selectedPrinter.DisplayName}...");

            // 4. Request fresh short-lived signed URL (expires in 60s) from Supabase Storage
            var storagePath = jobResponse.StoragePath;
            if (string.IsNullOrWhiteSpace(storagePath))
            {
                jobResponse.Status = "failed";
                jobResponse.RejectionReason = "Document storage path is missing from job record.";
                jobResponse.UpdatedAt = DateTime.UtcNow;
                await _authService.Client.From<PrintJobRecord>().Update(jobResponse);

                NotifyEvent(jobId, "Failed", "Storage path missing from print job.", isError: true);
                return;
            }

            signedUrl = await _authService.Client.Storage.From("print-uploads").CreateSignedUrl(storagePath, 60);
            if (string.IsNullOrWhiteSpace(signedUrl))
            {
                throw new InvalidOperationException("Failed to generate short-lived signed URL from Supabase Storage.");
            }

            // 5. Download bytes into strictly in-memory buffer (Zero Disk I/O)
            using (var httpClient = new HttpClient())
            {
                inMemoryBuffer = await httpClient.GetByteArrayAsync(signedUrl);
            }

            if (inMemoryBuffer == null || inMemoryBuffer.Length == 0)
            {
                throw new InvalidOperationException("Downloaded document buffer is empty.");
            }

            // 6. Transition status to 'printing' so customer tracker updates in real-time
            jobResponse.Status = "printing";
            jobResponse.UpdatedAt = DateTime.UtcNow;
            await _authService.Client.From<PrintJobRecord>().Update(jobResponse);

            NotifyEvent(jobId, "Printing", $"Outputting on {selectedPrinter.DisplayName}...");
            _systemTrayService.ShowNotification(
                "Printing Document",
                $"{jobResponse.PageCount} pages ({targetMode.ToUpper()}) on {selectedPrinter.DisplayName}"
            );

            // 7. Silent print to spooler (respecting customer copies, paper size, duplex)
            var ext = Path.GetExtension(storagePath);
            var documentName = await _printEngine.PrintAsync(
                inMemoryBuffer,
                ext,
                selectedPrinter,
                jobResponse,
                _cts.Token
            );

            // 8. Monitor Windows Print Spooler for completion or errors
            var spoolerResult = await _spoolerMonitor.WaitForJobCompletionAsync(
                selectedPrinter.WindowsPrinterName,
                documentName,
                TimeSpan.FromSeconds(90),
                onStatusUpdate: statusMsg => NotifyEvent(jobId, "Printing", statusMsg),
                cancellationToken: _cts.Token
            );

            if (!spoolerResult.Success)
            {
                var friendlySpoolerError = "Could not finish printing. Please check that your printer has paper, is not jammed, and has sufficient ink.";
                jobResponse.Status = "failed";
                jobResponse.RejectionReason = friendlySpoolerError;
                jobResponse.UpdatedAt = DateTime.UtcNow;
                await _authService.Client.From<PrintJobRecord>().Update(jobResponse);

                NotifyEvent(jobId, "Failed", friendlySpoolerError, isError: true);
                _systemTrayService.ShowNotification("Print Stopped", friendlySpoolerError);
                return;
            }

            // 9. Mark status as 'completed'
            jobResponse.Status = "completed";
            jobResponse.UpdatedAt = DateTime.UtcNow;
            await _authService.Client.From<PrintJobRecord>().Update(jobResponse);

            // 10. Immediately clean up: overwrite in-memory buffer and delete from Supabase Storage
            Array.Clear(inMemoryBuffer, 0, inMemoryBuffer.Length);
            inMemoryBuffer = null;
            signedUrl = null;

            try
            {
                await _authService.Client.Storage.From("print-uploads").Remove(new List<string> { storagePath });
                jobResponse.StoragePath = null;
                await _authService.Client.From<PrintJobRecord>().Update(jobResponse);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PrintPipeline] Storage deletion notice: {ex.Message}");
            }

            // 11. Add text-only operational entry to Audit Log
            AuditLogGenerated?.Invoke(this, new AuditLogEntry
            {
                Timestamp = DateTime.UtcNow,
                Status = "Completed",
                PageCount = jobResponse.PageCount,
                Copies = jobResponse.Copies,
                ColorMode = jobResponse.ColorMode ?? "bw",
                Details = $"Printed on {selectedPrinter.DisplayName} • Buffer zeroed & cloud file deleted"
            });

            NotifyEvent(jobId, "Completed", $"Completed on {selectedPrinter.DisplayName}. Cloud file deleted.");
            _systemTrayService.ShowNotification("Print Completed", $"Job printed on {selectedPrinter.DisplayName}. Memory cleaned.");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PrintPipeline] Error processing job {jobId}: {ex.Message}");
            var friendlyExError = "Unable to process document for printing. Please check your internet connection and printer cable/Wi-Fi.";
            
            try
            {
                var failRecord = await _authService.Client.From<PrintJobRecord>().Where(x => x.Id == jobId).Single();
                if (failRecord != null)
                {
                    failRecord.Status = "failed";
                    failRecord.RejectionReason = friendlyExError;
                    failRecord.UpdatedAt = DateTime.UtcNow;
                    await _authService.Client.From<PrintJobRecord>().Update(failRecord);
                }
            }
            catch
            {
                // Suppress secondary update failure
            }

            NotifyEvent(jobId, "Failed", friendlyExError, isError: true);
            _systemTrayService.ShowNotification("Print Error", friendlyExError);
        }
        finally
        {
            if (inMemoryBuffer != null)
            {
                Array.Clear(inMemoryBuffer, 0, inMemoryBuffer.Length);
                inMemoryBuffer = null;
            }
            signedUrl = null;
            GC.Collect();
        }
    }

    private void NotifyEvent(Guid jobId, string status, string message, bool isError = false)
    {
        PipelineEventOccurred?.Invoke(this, new PrintPipelineEvent
        {
            JobId = jobId,
            Status = status,
            Message = message,
            IsError = isError
        });
    }

    public void Dispose()
    {
        _cts.Cancel();
        _cts.Dispose();
    }
}
