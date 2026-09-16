using System;
using CommunityToolkit.Mvvm.ComponentModel;

namespace PrintInfinity.Agent.Models;

public enum JobStatus
{
    PendingPayment,
    PendingApproval,
    Pending,
    Approved,
    Rejected,
    Printing,
    Completed,
    Failed,
    Expired
}

public enum PaymentStatus
{
    Pending,
    Verified,
    Failed
}

public enum PaymentMethod
{
    Cash,
    Upi
}

public partial class PrintJob : ObservableObject
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string StationId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public int TotalPages { get; set; } = 1;
    public PrintSettings Settings { get; set; } = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsCash))]
    [NotifyPropertyChangedFor(nameof(CanConfirmCash))]
    [NotifyPropertyChangedFor(nameof(PaymentBadgeText))]
    private PaymentMethod _payment = PaymentMethod.Cash;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsPaymentVerified))]
    [NotifyPropertyChangedFor(nameof(CanConfirmCash))]
    [NotifyPropertyChangedFor(nameof(CanApprove))]
    [NotifyPropertyChangedFor(nameof(PaymentBadgeText))]
    private PaymentStatus _paymentStatus = PaymentStatus.Pending;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanApprove))]
    private JobStatus _status = JobStatus.PendingPayment;

    public decimal Amount { get; set; }
    public string? CustomerPhone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsCash => Payment == PaymentMethod.Cash;
    public bool IsPaymentVerified => PaymentStatus == PaymentStatus.Verified;
    public bool CanConfirmCash => IsCash && PaymentStatus == PaymentStatus.Pending;
    public bool CanApprove => IsPaymentVerified && (Status == JobStatus.PendingApproval || Status == JobStatus.PendingPayment || Status == JobStatus.Pending);

    public string FormattedAmount => $"₹{Amount:F2}";

    public string PaymentBadgeText => Payment switch
    {
        PaymentMethod.Cash when PaymentStatus == PaymentStatus.Verified => "✓ Cash Verified",
        PaymentMethod.Cash => "💵 Cash (Awaiting Payment)",
        PaymentMethod.Upi when PaymentStatus == PaymentStatus.Verified => "✓ UPI Verified",
        PaymentMethod.Upi => "📱 UPI (Awaiting Webhook)",
        _ => "Pending"
    };
}
