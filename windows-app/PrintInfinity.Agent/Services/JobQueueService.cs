using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Supabase.Realtime;
using Supabase.Realtime.PostgresChanges;
using Postgrest;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public interface IJobQueueService : IDisposable
{
    event EventHandler<QueueItem>? JobArrived;
    event EventHandler<Guid>? JobRemoved;
    event EventHandler<QueueItem>? JobApproved;

    Task StartListeningAsync(Guid storeId);
    void StopListening();
    Task<List<QueueItem>> FetchPendingJobsAsync(Guid storeId);
    Task<bool> ApproveJobAsync(Guid jobId);
    Task<bool> RejectJobAsync(Guid jobId, string reason);
    void ReleaseApprovedJob(Guid jobId);
}

public class JobQueueService : IJobQueueService
{
    private readonly ISupabaseAuthService _authService;
    private RealtimeChannel? _realtimeChannel;

    // FIX 3: Extended to 30s; disabled when Realtime is confirmed healthy.
    private Timer? _fallbackPollingTimer;
    private bool _realtimeHealthy = false;

    private Guid _storeId;
    private bool _isDisposed;
    private readonly HashSet<Guid> _knownJobIds = new();
    private readonly HashSet<Guid> _dispatchedApprovedJobIds = new();

    // Semaphore prevents concurrent RefreshPendingJobsAsync calls from overlapping.
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    public event EventHandler<QueueItem>? JobArrived;
    public event EventHandler<Guid>? JobRemoved;
    public event EventHandler<QueueItem>? JobApproved;

    public void ReleaseApprovedJob(Guid jobId)
    {
        lock (_dispatchedApprovedJobIds)
        {
            _dispatchedApprovedJobIds.Remove(jobId);
        }
    }

    public JobQueueService(ISupabaseAuthService authService)
    {
        _authService = authService;
    }

    public async Task StartListeningAsync(Guid storeId)
    {
        // Stop any previous subscription or timers cleanly before starting new one
        StopListening();

        _storeId = storeId;
        _isDisposed = false;
        await _authService.InitializeAsync();

        // 1. Initial query for existing pending_approval jobs
        var existing = await FetchPendingJobsAsync(storeId);
        Program.Log($"JobQueueService: StartListeningAsync fetched {existing.Count} job(s) for store {storeId}");
        foreach (var job in existing)
        {
            if (_knownJobIds.Add(job.Id))
            {
                JobArrived?.Invoke(this, job);
            }
        }

            // 2. Setup Supabase Realtime subscription with state & error monitoring
            try
            {
                var channelName = $"realtime:jobs:{storeId}";
                _realtimeChannel = _authService.Client.Realtime.Channel(channelName);

                // Wire up state changes to maintain accurate _realtimeHealthy status
                _realtimeChannel.AddStateChangedHandler((sender, state) =>
                {
                    Program.Log($"JobQueueService: Realtime socket state changed to: {state}");
                    if (state == Supabase.Realtime.Constants.ChannelState.Joined)
                    {
                        _realtimeHealthy = true;
                    }
                    else if (state == Supabase.Realtime.Constants.ChannelState.Closed ||
                             state == Supabase.Realtime.Constants.ChannelState.Errored)
                    {
                        _realtimeHealthy = false;
                    }
                });

                _realtimeChannel.AddErrorHandler((sender, ex) =>
                {
                    Program.Log($"JobQueueService: Realtime socket error: {ex?.Message}");
                    _realtimeHealthy = false;
                });

                var options = new PostgresChangesOptions(
                    schema: "public",
                    table: "print_jobs",
                    eventType: PostgresChangesOptions.ListenType.All
                );

                _realtimeChannel.Register(options);

                // FIX 2: Apply INSERT events directly from payload; only poll on UPDATE/DELETE.
                _realtimeChannel.AddPostgresChangeHandler(PostgresChangesOptions.ListenType.All, async (sender, change) =>
                {
                    try
                    {
                        _realtimeHealthy = true;

                        if (change.Event == Supabase.Realtime.Constants.EventType.Insert)
                        {
                            // Fast path: extract the new record from the Realtime payload directly.
                            // Only trigger a full refresh if we can't parse the payload.
                            bool handled = TryHandleInsertPayload(change);
                            if (!handled)
                            {
                                await RefreshPendingJobsAsync();
                            }
                        }
                        else
                        {
                            // UPDATE/DELETE: do a targeted refresh to sync state.
                            await RefreshPendingJobsAsync();
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Realtime handler error: {ex.Message}");
                    }
                });

                await _realtimeChannel.Subscribe();
                _realtimeHealthy = true;
                Program.Log($"JobQueueService: Realtime subscription active for store {storeId}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Realtime subscription error (fallback polling active): {ex.Message}");
                _realtimeHealthy = false;
            }

            // 3. Auto-healing fallback timer. Runs every 15s.
            // When Realtime is healthy, it stays idle (0 DB calls).
            // When Realtime drops, it actively polls database and attempts reconnection.
            _fallbackPollingTimer = new Timer(async _ =>
            {
                if (_isDisposed) return;

                // Validate channel state
                if (_realtimeHealthy && _realtimeChannel != null && (_realtimeChannel.IsClosed || _realtimeChannel.IsErrored))
                {
                    _realtimeHealthy = false;
                }

                if (!_realtimeHealthy)
                {
                    Program.Log("JobQueueService: Fallback poll active (Realtime disconnected)...");
                    try
                    {
                        await RefreshPendingJobsAsync();
                    }
                    catch (Exception pollEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"Fallback polling error: {pollEx.Message}");
                    }

                    // Attempt auto-healing re-subscription
                    try
                    {
                        if (_realtimeChannel != null && (_realtimeChannel.IsClosed || _realtimeChannel.IsErrored))
                        {
                            Program.Log("JobQueueService: Attempting Realtime socket re-subscription...");
                            await _realtimeChannel.Subscribe();
                        }
                    }
                    catch (Exception reSubEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"Auto-heal subscription notice: {reSubEx.Message}");
                    }
                }
            }, null, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(15));

            // 4. Initial sweep for any in-flight 'approved' or interrupted 'printing' jobs
            _ = Task.Run(RefreshPendingJobsAsync);
        }

    /// FIX 2: Attempt to apply an INSERT Realtime event without a full round-trip.
    /// Returns true if handled; false if the caller should fall back to a full poll.
    /// </summary>
    private bool TryHandleInsertPayload(PostgresChangesResponse change)
    {
        try
        {
            // Use the standard Supabase Realtime Model<T>() API to deserialize the inserted record.
            var record = change.Model<PrintJobRecord>();
            if (record == null) return false;

            // Only surface jobs that need storekeeper attention.
            if (record.Status != "pending_approval" && record.Status != "pending_payment") return false;

            // Skip if this job ID is already tracked.
            if (!_knownJobIds.Add(record.Id)) return true;

            var colorMode = record.ColorMode ?? "bw";
            var copies = Math.Max(1, record.Copies);
            var pageCount = Math.Max(1, record.PageCount);
            var rate = string.Equals(colorMode, "color", StringComparison.OrdinalIgnoreCase) ? 10.00m : 3.00m;
            var price = copies * pageCount * rate;

            var item = new QueueItem
            {
                Id = record.Id,
                ColorMode = colorMode,
                Copies = copies,
                PaperSize = record.PaperSize ?? "A4",
                PageCount = pageCount,
                Duplex = record.Duplex,
                Price = price,
                PaymentMethod = "cash",
                PaymentStatus = "pending",
                CreatedAt = record.CreatedAt
            };

            Program.Log($"JobQueueService: New job via Realtime INSERT (fast path). ID={record.Id}, Color={colorMode}, Price=₹{price:F2}");
            JobArrived?.Invoke(this, item);
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"TryHandleInsertPayload error (will fall back to full poll): {ex.Message}");
            return false;
        }
    }

    private async Task RefreshPendingJobsAsync()
    {
        if (_storeId == Guid.Empty) return;

        // FIX: Prevent overlapping concurrent refreshes.
        if (!await _refreshLock.WaitAsync(0)) return;
        try
        {
            var currentJobs = await FetchPendingJobsAsync(_storeId);
            var currentIds = currentJobs.Select(j => j.Id).ToHashSet();

            // Detect new jobs
            foreach (var job in currentJobs)
            {
                if (_knownJobIds.Add(job.Id))
                {
                    Program.Log($"JobQueueService: New incoming job arrived! ID={job.Id}, Color={job.ColorMode}, Price={job.FormattedPrice}, Method={job.PaymentMethod}");
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

            // Check for jobs that have transitioned to 'approved' or were left in 'printing' (interrupted/crash recovery)
            try
            {
                var approvedResponse = await _authService.Client.From<PrintJobRecord>()
                    .Where(x => x.StoreId == _storeId)
                    .Where(x => x.Status == "approved")
                    .Get();

                var printingResponse = await _authService.Client.From<PrintJobRecord>()
                    .Where(x => x.StoreId == _storeId)
                    .Where(x => x.Status == "printing")
                    .Get();

                var actionableRecords = (approvedResponse?.Models ?? new List<PrintJobRecord>())
                    .Concat(printingResponse?.Models ?? new List<PrintJobRecord>())
                    .GroupBy(r => r.Id)
                    .Select(g => g.First())
                    .ToList();

                foreach (var r in actionableRecords)
                {
                    bool shouldDispatch = false;
                    lock (_dispatchedApprovedJobIds)
                    {
                        shouldDispatch = _dispatchedApprovedJobIds.Add(r.Id);
                    }

                    if (shouldDispatch)
                    {
                        var queueItem = new QueueItem
                        {
                            Id = r.Id,
                            ColorMode = r.ColorMode,
                            Copies = r.Copies,
                            PaperSize = r.PaperSize,
                            PageCount = r.PageCount > 0 ? r.PageCount : 1,
                            Duplex = r.Duplex,
                            Price = CalculateDefaultPrice(r),
                            PaymentMethod = "upi",
                            PaymentStatus = "verified",
                            CreatedAt = r.CreatedAt
                        };
                        Program.Log($"JobQueueService: Job ready to print (Status={r.Status})! ID={r.Id}, Color={r.ColorMode}");
                        JobApproved?.Invoke(this, queueItem);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Approved/printing query notice: {ex.Message}");
            }
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public async Task<List<QueueItem>> FetchPendingJobsAsync(Guid storeId)
    {
        await _authService.InitializeAsync();

        try
        {
            // 1. Fetch pending_approval jobs (orders ready for storekeeper approval)
            var approvalResponse = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.StoreId == storeId)
                .Where(x => x.Status == "pending_approval")
                .Get();

            // 2. Also fetch pending_payment jobs (cash at counter or active submissions)
            var paymentResponse = await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.StoreId == storeId)
                .Where(x => x.Status == "pending_payment")
                .Get();

            var records = (approvalResponse.Models ?? new List<PrintJobRecord>())
                .Concat(paymentResponse.Models ?? new List<PrintJobRecord>())
                .GroupBy(r => r.Id)
                .Select(g => g.First())
                .OrderByDescending(r => r.CreatedAt)
                .ToList();

            if (records.Count == 0) return new List<QueueItem>();

            // FIX 4: Only fetch payment records for the specific job IDs we actually need.
            var jobIds = records.Select(r => r.Id).ToList();
            var paymentsMap = new Dictionary<Guid, (decimal Amount, string Method, string Status)>();
            try
            {
                // Build a list of string representations to pass to the In() filter
                var idStrings = jobIds.Select(id => id.ToString()).ToList();
                var paymentsResponse = await _authService.Client.From<PaymentRecord>()
                    .Filter("print_job_id", Postgrest.Constants.Operator.In, idStrings)
                    .Get();

                if (paymentsResponse?.Models != null)
                {
                    foreach (var p in paymentsResponse.Models)
                    {
                        paymentsMap[p.PrintJobId] = (p.Amount, p.Method, p.Status);
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
                string method = "cash";
                string status = "pending";

                if (paymentsMap.TryGetValue(r.Id, out var payInfo))
                {
                    price = payInfo.Amount > 0 ? payInfo.Amount : CalculateDefaultPrice(r);
                    method = !string.IsNullOrWhiteSpace(payInfo.Method) ? payInfo.Method : "cash";
                    status = !string.IsNullOrWhiteSpace(payInfo.Status) ? payInfo.Status : "pending";
                }
                else
                {
                    price = CalculateDefaultPrice(r);
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
                    PaymentMethod = method,
                    PaymentStatus = status,
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

    private static decimal CalculateDefaultPrice(PrintJobRecord r)
    {
        var rate = string.Equals(r.ColorMode, "color", StringComparison.OrdinalIgnoreCase) ? 10.00m : 3.00m;
        return (r.Copies > 0 ? r.Copies : 1) * (r.PageCount > 0 ? r.PageCount : 1) * rate;
    }

    // FIX 5: Eliminate read-before-write. Build the update directly without an extra GET.
    public async Task<bool> ApproveJobAsync(Guid jobId)
    {
        await _authService.InitializeAsync();
        try
        {
            // Direct update by primary key — no preceding GET round-trip.
            var patchRecord = new PrintJobRecord
            {
                Id = jobId,
                Status = "approved",
                UpdatedAt = DateTime.UtcNow
            };
            await _authService.Client.From<PrintJobRecord>()
                .Where(x => x.Id == jobId)
                .Set(x => x.Status!, "approved")
                .Set(x => x.UpdatedAt, DateTime.UtcNow)
                .Update();

            // Auto-verify corresponding payment if still pending (e.g. storekeeper confirmed cash)
            try
            {
                var payResp = await _authService.Client.From<PaymentRecord>()
                    .Where(x => x.PrintJobId == jobId)
                    .Get();
                var payment = payResp.Models.FirstOrDefault();
                if (payment != null && payment.Status != "verified")
                {
                    payment.Status = "verified";
                    payment.UpdatedAt = DateTime.UtcNow;
                    await _authService.Client.From<PaymentRecord>().Update(payment);
                }
            }
            catch (Exception payEx)
            {
                System.Diagnostics.Debug.WriteLine($"Notice updating payment status: {payEx.Message}");
            }

            _knownJobIds.Remove(jobId);
            JobRemoved?.Invoke(this, jobId);
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error approving job {jobId}: {ex.Message}");

            // Fallback: read-then-write if the set-only path fails (e.g. older Supabase client)
            try
            {
                var response = await _authService.Client.From<PrintJobRecord>()
                    .Where(x => x.Id == jobId).Get();
                var job = response.Models.FirstOrDefault();
                if (job == null) return false;
                job.Status = "approved";
                job.UpdatedAt = DateTime.UtcNow;
                await _authService.Client.From<PrintJobRecord>().Update(job);
                _knownJobIds.Remove(jobId);
                JobRemoved?.Invoke(this, jobId);
                return true;
            }
            catch (Exception fallbackEx)
            {
                System.Diagnostics.Debug.WriteLine($"Approve fallback also failed for job {jobId}: {fallbackEx.Message}");
                return false;
            }
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

    public void StopListening()
    {
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
        _realtimeChannel = null;
        _realtimeHealthy = false;
    }

    public void Dispose()
    {
        _isDisposed = true;
        StopListening();
        _refreshLock.Dispose();
    }
}
