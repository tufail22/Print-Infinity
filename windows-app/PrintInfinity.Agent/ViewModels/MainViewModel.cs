using System.Collections.ObjectModel;
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

    public ObservableCollection<PrintJob> PendingJobs { get; } = new();

    public MainViewModel(ISupabaseRealtimeService realtimeService, IPrintStreamService printStreamService)
    {
        _realtimeService = realtimeService;
        _printStreamService = printStreamService;
    }

    [RelayCommand]
    private async Task ApproveJobAsync(PrintJob job)
    {
        // Approve job and stream document directly to printer
        await _realtimeService.UpdateJobStatusAsync(job.Id, JobStatus.Approved);
    }

    [RelayCommand]
    private async Task RejectJobAsync(PrintJob job)
    {
        // Reject job
        await _realtimeService.UpdateJobStatusAsync(job.Id, JobStatus.Rejected);
        PendingJobs.Remove(job);
    }
}
