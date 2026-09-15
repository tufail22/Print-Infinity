using System;
using System.Threading;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

/// <summary>
/// Service that listens for real-time print job notifications from Supabase
/// and notifies the storekeeper UI.
/// </summary>
public interface ISupabaseRealtimeService
{
    event EventHandler<PrintJob>? JobReceived;
    Task ConnectAsync(string stationId, CancellationToken cancellationToken = default);
    Task DisconnectAsync();
    Task UpdateJobStatusAsync(Guid jobId, JobStatus status, CancellationToken cancellationToken = default);
}

public class SupabaseRealtimeService : ISupabaseRealtimeService
{
    public event EventHandler<PrintJob>? JobReceived;

    public async Task ConnectAsync(string stationId, CancellationToken cancellationToken = default)
    {
        // Subscribes to Supabase Realtime channel for this station's print jobs
        await Task.CompletedTask;
    }

    public async Task DisconnectAsync()
    {
        await Task.CompletedTask;
    }

    public async Task UpdateJobStatusAsync(Guid jobId, JobStatus status, CancellationToken cancellationToken = default)
    {
        // Updates the print job record status in Supabase (approved, rejected, completed)
        await Task.CompletedTask;
    }
}
