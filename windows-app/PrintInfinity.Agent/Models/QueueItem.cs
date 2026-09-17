using System;
using CommunityToolkit.Mvvm.ComponentModel;

namespace PrintInfinity.Agent.Models;

/// <summary>
/// Privacy-first representation of a print job in the live queue.
/// Strictly contains ONLY technical print settings: color mode, copies, paper size, page count, and price.
/// Absolutely NO filename, NO thumbnail, and NO preview of actual document content.
/// </summary>
public partial class QueueItem : ObservableObject
{
    public Guid Id { get; set; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ColorModeBadgeText))]
    [NotifyPropertyChangedFor(nameof(ColorBadgeBackground))]
    [NotifyPropertyChangedFor(nameof(ColorBadgeForeground))]
    private string _colorMode = "bw"; // 'color' or 'bw'

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FormattedCopies))]
    private int _copies = 1;

    [ObservableProperty]
    private string _paperSize = "A4";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FormattedPages))]
    private int _pageCount = 1;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FormattedPrice))]
    private decimal _price;

    [ObservableProperty]
    private bool _duplex;

    [ObservableProperty]
    private DateTime _createdAt = DateTime.UtcNow;

    [ObservableProperty]
    private bool _isApproving;

    [ObservableProperty]
    private bool _isRejecting;

    public string FormattedPrice => $"₹{Price:F2}";
    public string FormattedCopies => Copies == 1 ? "1 copy" : $"{Copies} copies";
    public string FormattedPages => PageCount == 1 ? "1 page" : $"{PageCount} pages";
    public string FormattedTime => CreatedAt.ToLocalTime().ToString("hh:mm:ss tt");

    public string ColorModeBadgeText => string.Equals(ColorMode, "color", StringComparison.OrdinalIgnoreCase)
        ? "🎨 Full Color"
        : "⬛ Monochrome B&W";

    public string ColorBadgeBackground => string.Equals(ColorMode, "color", StringComparison.OrdinalIgnoreCase)
        ? "#FEF3C7"
        : "#F1F5F9";

    public string ColorBadgeForeground => string.Equals(ColorMode, "color", StringComparison.OrdinalIgnoreCase)
        ? "#92400E"
        : "#334155";
}
