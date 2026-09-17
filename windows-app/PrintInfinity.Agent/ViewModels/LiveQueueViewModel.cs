using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.UI.Dispatching;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services;

namespace PrintInfinity.Agent.ViewModels;

public partial class LiveQueueViewModel : ObservableObject, IDisposable
{
    private readonly IJobQueueService _queueService;
    private readonly IPrintPipelineService _printPipelineService;
    private readonly ISystemTrayService _systemTrayService;
    private readonly DispatcherQueue? _dispatcherQueue;
    private Guid _storeId;

    public Microsoft.UI.Xaml.XamlRoot? XamlRoot { get; set; }

    public ObservableCollection<QueueItem> PendingJobs { get; } = new();
    public ObservableCollection<AuditLogEntry> AuditLogs { get; } = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasJobs))]
    [NotifyPropertyChangedFor(nameof(HasNoJobs))]
    [NotifyPropertyChangedFor(nameof(QueueBadgeText))]
    private int _jobCount;

    public bool HasJobs => JobCount > 0;
    public bool HasNoJobs => JobCount == 0;
    public string QueueBadgeText => JobCount > 0 ? $"({JobCount})" : string.Empty;

    [ObservableProperty]
    private bool _isRealtimeConnected = true;

    [ObservableProperty]
    private string _statusMessage = "Listening for incoming print jobs...";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasNotification))]
    private string _notificationMessage = string.Empty;

    public bool HasNotification => !string.IsNullOrWhiteSpace(NotificationMessage);

    public LiveQueueViewModel(
        IJobQueueService queueService,
        IPrintPipelineService printPipelineService,
        ISystemTrayService systemTrayService)
    {
        _queueService = queueService;
        _printPipelineService = printPipelineService;
        _systemTrayService = systemTrayService;
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();

        _queueService.JobArrived += OnJobArrived;
        _queueService.JobRemoved += OnJobRemoved;

        _printPipelineService.PipelineEventOccurred += (s, e) =>
        {
            _dispatcherQueue?.TryEnqueue(() =>
            {
                NotificationMessage = e.Message;
            });
        };

        _printPipelineService.AuditLogGenerated += (s, log) =>
        {
            _dispatcherQueue?.TryEnqueue(() =>
            {
                AuditLogs.Insert(0, log);
            });
        };
    }

    public async Task StartAsync(Guid storeId)
    {
        _storeId = storeId;
        StatusMessage = "Connecting to Supabase Realtime...";
        await _queueService.StartListeningAsync(storeId);
        IsRealtimeConnected = true;
        StatusMessage = "Realtime Active • Ready for customer prints";
    }

    private void OnJobArrived(object? sender, QueueItem job)
    {
        _dispatcherQueue?.TryEnqueue(() =>
        {
            if (PendingJobs.All(j => j.Id != job.Id))
            {
                PendingJobs.Insert(0, job);
                JobCount = PendingJobs.Count;

                // Native Windows toast notification via System Tray
                _systemTrayService.ShowNotification(
                    "🖨️ New Print Job Received",
                    $"{job.FormattedPages}, {job.FormattedCopies} ({job.ColorModeBadgeText}) — {job.FormattedPrice}"
                );

                NotificationMessage = $"New {job.ColorModeBadgeText} job received ({job.FormattedPrice})";
            }
        });
    }

    private void OnJobRemoved(object? sender, Guid jobId)
    {
        _dispatcherQueue?.TryEnqueue(() =>
        {
            var existing = PendingJobs.FirstOrDefault(j => j.Id == jobId);
            if (existing != null)
            {
                PendingJobs.Remove(existing);
                JobCount = PendingJobs.Count;
            }
        });
    }

    [RelayCommand]
    public async Task ApproveJobAsync(QueueItem? job)
    {
        if (job == null) return;

        job.IsApproving = true;
        NotificationMessage = $"Queued job ({job.FormattedPrice}) for print pipeline...";

        PendingJobs.Remove(job);
        JobCount = PendingJobs.Count;

        await _printPipelineService.EnqueueJobAsync(job, PromptPrinterSelectionAsync);
    }

    public async Task<PrinterItem?> PromptPrinterSelectionAsync(List<PrinterItem> candidates)
    {
        if (_dispatcherQueue == null || XamlRoot == null)
        {
            return candidates.FirstOrDefault();
        }

        var tcs = new TaskCompletionSource<PrinterItem?>();

        _dispatcherQueue.TryEnqueue(async () =>
        {
            try
            {
                var dialog = new Views.PrinterSelectionDialog(candidates)
                {
                    XamlRoot = XamlRoot
                };

                var result = await dialog.ShowAsync();
                if (result == Microsoft.UI.Xaml.Controls.ContentDialogResult.Primary)
                {
                    tcs.TrySetResult(dialog.SelectedPrinter);
                }
                else
                {
                    tcs.TrySetResult(null);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Printer selection dialog notice: {ex.Message}");
                tcs.TrySetResult(candidates.FirstOrDefault());
            }
        });

        return await tcs.Task;
    }

    public async Task RejectJobWithReasonAsync(QueueItem job, string reason)
    {
        job.IsRejecting = true;
        NotificationMessage = string.Empty;

        var success = await _queueService.RejectJobAsync(job.Id, reason);
        if (success)
        {
            PendingJobs.Remove(job);
            JobCount = PendingJobs.Count;

            // Log strictly text metadata
            AuditLogs.Insert(0, new AuditLogEntry
            {
                Timestamp = DateTime.UtcNow,
                Status = "Rejected",
                PageCount = job.PageCount,
                Copies = job.Copies,
                ColorMode = job.ColorMode,
                Details = $"Reason: {reason}"
            });

            NotificationMessage = $"✕ Job rejected: '{reason}'. Customer notified.";
        }
        else
        {
            NotificationMessage = "Failed to reject job. Check internet connection.";
            job.IsRejecting = false;
        }
    }

    public void Dispose()
    {
        _queueService.JobArrived -= OnJobArrived;
        _queueService.JobRemoved -= OnJobRemoved;
        _queueService.Dispose();
        _printPipelineService.Dispose();
    }
}
