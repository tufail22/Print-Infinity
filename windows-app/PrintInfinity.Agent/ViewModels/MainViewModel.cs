using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using PrintInfinity.Agent.Models;
using PrintInfinity.Agent.Services;

namespace PrintInfinity.Agent.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly ISupabaseRealtimeService _realtimeService;
    private readonly IPrintStreamService _printStreamService;

    [ObservableProperty]
    private string _stationId = "STATION-01";

    [ObservableProperty]
    private bool _isConnected;

    [ObservableProperty]
    private string _statusMessage = "Ready for print jobs";

    public ObservableCollection<PrintJob> PendingJobs { get; } = new();

    public MainViewModel(ISupabaseRealtimeService realtimeService, IPrintStreamService printStreamService)
    {
        _realtimeService = realtimeService;
        _printStreamService = printStreamService;

        _realtimeService.JobReceived += (s, job) =>
        {
            PendingJobs.Add(job);
            StatusMessage = $"New job received: {job.FileName}";
        };
    }

    /// <summary>
    /// Action 1 (Cash Only): Storekeeper physically accepts and acknowledges cash payment.
    /// Transitions payment to verified and job to pending_approval.
    /// Does NOT approve or print the document yet.
    /// </summary>
    [RelayCommand]
    private async Task ConfirmCashReceivedAsync(PrintJob job)
    {
        if (job == null || !job.CanConfirmCash) return;

        job.PaymentStatus = PaymentStatus.Verified;
        job.Status = JobStatus.PendingApproval;

        await _realtimeService.ConfirmCashPaymentAsync(job.Id);
        StatusMessage = $"Cash confirmed for {job.FileName} ({job.FormattedAmount}). Ready for approval.";
    }

    /// <summary>
    /// Action 2: Storekeeper reviews and approves the job to print.
    /// STRICT GUARD: Job CANNOT be approved if payment is not verified.
    /// </summary>
    [RelayCommand]
    private async Task ApproveJobAsync(PrintJob job)
    {
        if (job == null) return;

        // Security Guard: Cash must be acknowledged or UPI verified before printing
        if (!job.IsPaymentVerified)
        {
            StatusMessage = $"Cannot approve {job.FileName}: Payment must be verified first!";
            return;
        }

        job.Status = JobStatus.Approved;
        await _realtimeService.UpdateJobStatusAsync(job.Id, JobStatus.Approved);

        // Stream directly to hardware printer memory (zero-disk)
        job.Status = JobStatus.Printing;
        await _printStreamService.StreamToPrinterAsync(job.FileUrl, job.Settings.PrinterName);

        job.Status = JobStatus.Completed;
        StatusMessage = $"Successfully printed {job.FileName}. Document memory cleared.";
        PendingJobs.Remove(job);
    }

    /// <summary>
    /// Reject job (e.g. unpaid, invalid file, customer cancelled).
    /// </summary>
    [RelayCommand]
    private async Task RejectJobAsync(PrintJob job)
    {
        if (job == null) return;

        job.Status = JobStatus.Rejected;
        await _realtimeService.UpdateJobStatusAsync(job.Id, JobStatus.Rejected);
        PendingJobs.Remove(job);
        StatusMessage = $"Rejected job {job.FileName}.";
    }
}
