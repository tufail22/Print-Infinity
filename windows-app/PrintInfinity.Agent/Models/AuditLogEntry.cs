using System;

namespace PrintInfinity.Agent.Models;

/// <summary>
/// Simple text-only audit record for storekeeper operational auditing.
/// Strictly logs timestamp, status, and page count without storing files, previews, or customer data.
/// </summary>
public class AuditLogEntry
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Pending";
    public int PageCount { get; set; } = 1;
    public int Copies { get; set; } = 1;
    public string ColorMode { get; set; } = "bw";
    public string Details { get; set; } = string.Empty;

    public string FormattedTimestamp => Timestamp.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
    public string FormattedPages => $"{PageCount * Copies} pages ({Copies}x{PageCount}p)";
    public string StatusBadgeColor => Status switch
    {
        "Approved" => "#10B981",
        "Rejected" => "#EF4444",
        _ => "#6366F1"
    };
}
