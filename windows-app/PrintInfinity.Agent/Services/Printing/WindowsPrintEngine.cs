using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Windows.Data.Pdf;
using Windows.Storage.Streams;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services.Printing;

public class WindowsPrintEngine : IPrintEngine
{
    public async Task<string> PrintAsync(
        byte[] fileBytes,
        string fileExtension,
        PrinterItem targetPrinter,
        PrintJobRecord job,
        CancellationToken cancellationToken = default)
    {
        var documentName = $"PrintInfinity_{job.Id:N}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var ext = (fileExtension ?? string.Empty).Trim().ToLowerInvariant();

        if (ext == ".pdf" || IsPdfBytes(fileBytes))
        {
            await PrintPdfFromMemoryAsync(fileBytes, targetPrinter, job, documentName, cancellationToken);
        }
        else
        {
            await PrintImageFromMemoryAsync(fileBytes, targetPrinter, job, documentName, cancellationToken);
        }

        return documentName;
    }

    private static bool IsPdfBytes(byte[] bytes)
    {
        return bytes.Length > 4 &&
               bytes[0] == 0x25 && // %
               bytes[1] == 0x50 && // P
               bytes[2] == 0x44 && // D
               bytes[3] == 0x46;   // F
    }

    private static async Task PrintPdfFromMemoryAsync(
        byte[] pdfBytes,
        PrinterItem targetPrinter,
        PrintJobRecord job,
        string documentName,
        CancellationToken cancellationToken)
    {
        // 1. Create in-memory WinRT stream (Zero disk I/O)
        using var randomAccessStream = new InMemoryRandomAccessStream();
        using (var writer = new DataWriter(randomAccessStream.GetOutputStreamAt(0)))
        {
            writer.WriteBytes(pdfBytes);
            await writer.StoreAsync();
            await writer.FlushAsync();
        }

        var pdfDoc = await PdfDocument.LoadFromStreamAsync(randomAccessStream);
        var totalPages = (int)pdfDoc.PageCount;
        int currentPageIndex = 0;

        await Task.Run(() =>
        {
            using var printDoc = new PrintDocument();
            // Silent print controller: suppresses Windows printing popup dialogs
            printDoc.PrintController = new StandardPrintController();
            printDoc.DocumentName = documentName;

            ApplyPrinterSettings(printDoc, targetPrinter, job);

            printDoc.PrintPage += (sender, e) =>
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (currentPageIndex < totalPages)
                {
                    using var page = pdfDoc.GetPage((uint)currentPageIndex);
                    using var pageStream = new InMemoryRandomAccessStream();

                    // Render page into memory stream at high resolution
                    page.RenderToStreamAsync(pageStream).AsTask(cancellationToken).GetAwaiter().GetResult();

                    using var netStream = pageStream.AsStream();
                    using var pageImage = Image.FromStream(netStream);

                    // Fit image into printable area preserving aspect ratio
                    DrawImagePreservingAspect(e.Graphics, pageImage, e.MarginBounds);

                    currentPageIndex++;
                    e.HasMorePages = currentPageIndex < totalPages;
                }
                else
                {
                    e.HasMorePages = false;
                }
            };

            printDoc.Print();
        }, cancellationToken);
    }

    private static async Task PrintImageFromMemoryAsync(
        byte[] imageBytes,
        PrinterItem targetPrinter,
        PrintJobRecord job,
        string documentName,
        CancellationToken cancellationToken)
    {
        await Task.Run(() =>
        {
            using var netStream = new MemoryStream(imageBytes);
            using var image = Image.FromStream(netStream);

            using var printDoc = new PrintDocument();
            printDoc.PrintController = new StandardPrintController();
            printDoc.DocumentName = documentName;

            ApplyPrinterSettings(printDoc, targetPrinter, job);

            printDoc.PrintPage += (sender, e) =>
            {
                cancellationToken.ThrowIfCancellationRequested();

                DrawImagePreservingAspect(e.Graphics, image, e.MarginBounds);
                e.HasMorePages = false;
            };

            printDoc.Print();
        }, cancellationToken);
    }

    private static void ApplyPrinterSettings(PrintDocument printDoc, PrinterItem targetPrinter, PrintJobRecord job)
    {
        printDoc.PrinterSettings.PrinterName = targetPrinter.WindowsPrinterName;
        printDoc.PrinterSettings.Copies = (short)Math.Max(1, job.Copies);

        // Color Mode
        var isColor = string.Equals(job.ColorMode, "color", StringComparison.OrdinalIgnoreCase);
        if (printDoc.PrinterSettings.SupportsColor)
        {
            printDoc.DefaultPageSettings.Color = isColor;
        }

        // Duplex
        if (printDoc.PrinterSettings.CanDuplex)
        {
            printDoc.PrinterSettings.Duplex = job.Duplex ? Duplex.Vertical : Duplex.Simplex;
        }

        // Paper Size Mapping (A4 default, Letter, A3, photo sizes)
        var targetSize = job.PaperSize ?? "A4";
        foreach (PaperSize size in printDoc.PrinterSettings.PaperSizes)
        {
            if (string.Equals(size.PaperName, targetSize, StringComparison.OrdinalIgnoreCase) ||
                (targetSize.Equals("A4", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.A4) ||
                (targetSize.Equals("Letter", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.Letter) ||
                (targetSize.Equals("A3", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.A3))
            {
                printDoc.DefaultPageSettings.PaperSize = size;
                break;
            }
        }
    }

    private static void DrawImagePreservingAspect(Graphics? g, Image img, Rectangle bounds)
    {
        if (g == null) return;

        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;

        var imgRatio = (float)img.Width / img.Height;
        var boundsRatio = (float)bounds.Width / bounds.Height;

        int drawWidth, drawHeight;
        if (imgRatio > boundsRatio)
        {
            drawWidth = bounds.Width;
            drawHeight = (int)(bounds.Width / imgRatio);
        }
        else
        {
            drawHeight = bounds.Height;
            drawWidth = (int)(bounds.Height * imgRatio);
        }

        var x = bounds.X + (bounds.Width - drawWidth) / 2;
        var y = bounds.Y + (bounds.Height - drawHeight) / 2;

        g.DrawImage(img, new Rectangle(x, y, drawWidth, drawHeight));
    }
}
