using System;

namespace PrintInfinity.Agent.Models;

public enum JobStatus
{
    Pending,
    Approved,
    Rejected,
    Printing,
    Completed,
    Failed
}

public enum PaymentMethod
{
    Cash,
    Upi
}

public class PrintJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string StationId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public int TotalPages { get; set; }
    public PrintSettings Settings { get; set; } = new();
    public PaymentMethod Payment { get; set; } = PaymentMethod.Cash;
    public decimal Amount { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public string? CustomerPhone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
