namespace PrintInfinity.Agent.Models;

public enum ColorMode
{
    Monochrome,
    Color
}

public enum DuplexMode
{
    SingleSided,
    DuplexLongEdge,
    DuplexShortEdge
}

public class PrintSettings
{
    public int Copies { get; set; } = 1;
    public ColorMode Color { get; set; } = ColorMode.Monochrome;
    public DuplexMode Duplex { get; set; } = DuplexMode.SingleSided;
    public string PaperSize { get; set; } = "A4";
    public string? PageRange { get; set; }
}
