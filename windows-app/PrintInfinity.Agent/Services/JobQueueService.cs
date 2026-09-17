using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Supabase.Realtime;
using Supabase.Realtime.PostgresChanges;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public interface IJobQueueService : IDisposable
{
    event EventHandler<QueueItem>? JobArrived;
    event EventHandler<Guid>? JobRemoved;

    Task StartListeningAsync(Guid storeId);
    Task<List<QueueItem>> FetchPendingJobsAsync(Guid storeId);
    Task<bool> ApproveJobAsync(Guid jobId);
    Task<bool> RejectJobAsync(Guid jobId, string reason);
}

public class JobQueueService : IJobQueueService
{
    private readonly ISupabaseAuthService _authService;
    private RealtimeChannel? _realtimeChannel;
    private Timer? _fallbackPollingTimer;
    private Guid _storeId;
    private bool _isDisposed;
    private readonly HashSet<Guid> _knownJobIds = new();

    public event EventHandler<QueueItem>? JobArrived;
    public event EventHandler<Guid>? JobRemoved;

    public JobQueueService(ISupabaseAuthService authService)
    {
        _authService = authService;
    }

    public async Task StartListeningAsync(Guid storeId)
    {
        _storeId = storeId;
        await _authService.InitializeAsync();

        // 1. Initial query for existing pending_approval jobs
        var existing = await FetchPendingJobsAsync(storeId);
        foreach (var job in existing)
        {
            if (_knownJobIds.Add(job.Id))
            {
                JobArrived?.Invoke(this, job);
            }
        }

        // 2. Setup Supabase Realtime subscription
        try
        {
            var channelName = $"realtime:jobs:{storeId}";
            _realtimeChannel = _authService.Client.Realtime.Channel(channelName);

            var options = new PostgresChangesOptions(
                schema: "public",
                table: "print_jobs",
                eventType: PostgresChangesOptions.ListenType.All
            );

            _realtimeChannel.Register(options);
            _realtimeChannel.AddPostgresChangeHandler(PostgresChangesOptions.ListenType.All, async (sender, change) =>
            {
                try
                {
                    // Trigger a quick poll to ensure full relation synchronization
                    await RefreshPendingJobsAsync();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Realtime handler error: {ex.Message}");
                }
            });

            await _realtimeChannel.Subscribe();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Realtime subscription error (fallback polling active): {ex.Message}");
        }

        // 3. Reliable background polling fallback (every 3 seconds)
        _fallbackPollingTimer = new Timer(async _ =>
        {
            if (_isDisposed) return;
            try
            {
                await RefreshPendingJobsAsync();
            }
            catch
            {
                // Ignore transient polling exceptions
            }
        }, null, TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(3));
    }

    private async Task RefreshPendingJobsAsync()
    {
        if (_storeId == Guid.Empty) return;

        var currentJobs = await FetchPendingJobsAsync(_storeId);
        var currentIds = currentJobs.Select(j => j.Id).ToHashSet();

        // Detect new jobs
        foreach (var job in currentJobs)
        {
            if (_knownJobIds.Add(job.Id))
            {
                JobArrived?.Invoke(this, job);
            }
        }

        // Detect removed jobs (e.g. cancelled by customer or completed)
        var removedIds = _knownJobIds.Where(id => !currentIds.Contains(id)).ToList();
        foreach (var id in removedIds)
        {
            _knownJobIds.Remove(id);
            JobRemoved?.Invoke(this, id);
        }
    }

    public async Task<List<QueueItem>> FetchPendingJobsAsync(Guid storeId)
    {
        await _authService.InitializeAsync();

        try
        {
            var response = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.StoreId == storeId && x.Status == "pending_approval")
                .Get();

            var records = response.Models;
            if (records.Count == 0) return new List<QueueItem>();

            // Query corresponding payments for exact amounts
            var jobIds = records.Select(r => r.Id).ToList();
            var paymentsMap = new Dictionary<Guid, decimal>();
            try
            {
                var paymentsResponse = await _authService.Client.From<PaymentRecord>().Get();
                if (paymentsResponse?.Models != null)
                {
                    foreach (var p in paymentsResponse.Models)
                    {
                        if (jobIds.Contains(p.PrintJobId))
                        {
                            paymentsMap[p.PrintJobId] = p.Amount;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Payments query notice: {ex.Message}");
            }

            var items = new List<QueueItem>();
            foreach (var r in records)
            {
                decimal price;
                if (paymentsMap.TryGetValue(r.Id, out var paymentAmount) && paymentAmount > 0)
                {
                    price = paymentAmount;
                }
                else
                {
                    var rate = string.Equals(r.ColorMode, "color", StringComparison.OrdinalIgnoreCase) ? 10.00m : 3.00m;
                    price = r.Copies * r.PageCount * rate;
                }

                items.Add(new QueueItem
                {
                    Id = r.Id,
                    ColorMode = r.ColorMode,
                    Copies = r.Copies,
                    PaperSize = r.PaperSize,
                    PageCount = r.PageCount > 0 ? r.PageCount : 1,
                    Duplex = r.Duplex,
                    Price = price,
                    CreatedAt = r.CreatedAt
                });
            }

            return items;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to fetch pending jobs: {ex.Message}");
            return new List<QueueItem>();
        }
    }

    public async Task<bool> ApproveJobAsync(Guid jobId)
    {
        await _authService.InitializeAsync();
        try
        {
            var response = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.Id == jobId)
                .Get();

            var job = response.Models.FirstOrDefault();
            if (job == null) return false;

            job.Status = "approved";
            job.UpdatedAt = DateTime.UtcNow;

            await _authService.Client.From<PrintJobRecord>().Update(job);
            _knownJobIds.Remove(jobId);
            JobRemoved?.Invoke(this, jobId);
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error approving job {jobId}: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> RejectJobAsync(Guid jobId, string reason)
    {
        await _authService.InitializeAsync();
        try
        {
            var response = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.Id == jobId)
                .Get();

            var job = response.Models.FirstOrDefault();
            if (job == null) return false;

            job.Status = "rejected";
            job.RejectionReason = string.IsNullOrWhiteSpace(reason) ? "Rejected by storekeeper" : reason.Trim();
            job.UpdatedAt = DateTime.UtcNow;

            await _authService.Client.From<PrintJobRecord>().Update(job);
            _knownJobIds.Remove(jobId);
            JobRemoved?.Invoke(this, jobId);
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error rejecting job {jobId}: {ex.Message}");
            return false;
        }
    }

    public void Dispose()
    {
        _isDisposed = true;
        _fallbackPollingTimer?.Dispose();
        _fallbackPollingTimer = null;
        try
        {
            _realtimeChannel?.Unsubscribe();
        }
        catch
        {
            // Ignore unsubscribe errors
        }
    }
}
