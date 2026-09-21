using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
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
        var (_, pageRangeSpec) = ParsePaperSizeAndRange(job.PaperSize);
        var pagesToPrint = ParsePageIndices(totalPages, pageRangeSpec, job.PageCount);
        int currentPrintIndex = 0;

        var isColor = string.Equals(job.ColorMode, "color", StringComparison.OrdinalIgnoreCase);

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

                if (currentPrintIndex < pagesToPrint.Count)
                {
                    var pageIndex = pagesToPrint[currentPrintIndex];
                    using var page = pdfDoc.GetPage((uint)pageIndex);
                    using var pageStream = new InMemoryRandomAccessStream();

                    // Render page into memory stream at high resolution
                    page.RenderToStreamAsync(pageStream).AsTask(cancellationToken).GetAwaiter().GetResult();

                    using var netStream = pageStream.AsStream();
                    using var pageImage = Image.FromStream(netStream);

                    // Fit image into printable area preserving aspect ratio and strictly enforcing color mode
                    DrawImagePreservingAspect(e.Graphics, pageImage, e.MarginBounds, isColor);

                    currentPrintIndex++;
                    e.HasMorePages = currentPrintIndex < pagesToPrint.Count;
                }
                else
                {
                    e.HasMorePages = false;
                }
            };

            printDoc.Print();
        }, cancellationToken);
    }

    private static (string CleanPaperSize, string? PageRangeSpec) ParsePaperSizeAndRange(string? rawPaperSize)
    {
        if (string.IsNullOrWhiteSpace(rawPaperSize))
            return ("A4", null);

        var idx = rawPaperSize.IndexOf("|pages:", StringComparison.OrdinalIgnoreCase);
        if (idx >= 0)
        {
            var clean = rawPaperSize[..idx].Trim();
            var spec = rawPaperSize[(idx + 7)..].Trim();
            return (string.IsNullOrEmpty(clean) ? "A4" : clean, string.IsNullOrEmpty(spec) ? null : spec);
        }

        return (rawPaperSize.Trim(), null);
    }

    private static System.Collections.Generic.List<int> ParsePageIndices(int totalPages, string? pagesSpec, int maxPaidCount)
    {
        var result = new System.Collections.Generic.List<int>();
        if (totalPages <= 0) return result;

        if (string.IsNullOrWhiteSpace(pagesSpec) || string.Equals(pagesSpec, "all", StringComparison.OrdinalIgnoreCase))
        {
            var limit = maxPaidCount > 0 ? Math.Min(totalPages, maxPaidCount) : totalPages;
            for (int i = 0; i < limit; i++)
            {
                result.Add(i);
            }
            return result;
        }

        if (string.Equals(pagesSpec, "odd", StringComparison.OrdinalIgnoreCase))
        {
            for (int i = 0; i < totalPages; i++)
            {
                if ((i + 1) % 2 != 0)
                {
                    result.Add(i);
                }
            }
        }
        else if (string.Equals(pagesSpec, "even", StringComparison.OrdinalIgnoreCase))
        {
            for (int i = 0; i < totalPages; i++)
            {
                if ((i + 1) % 2 == 0)
                {
                    result.Add(i);
                }
            }
        }
        else
        {
            try
            {
                var parts = pagesSpec.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var set = new System.Collections.Generic.HashSet<int>();
                foreach (var part in parts)
                {
                    if (part.Contains('-'))
                    {
                        var dash = part.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                        if (dash.Length == 2 && int.TryParse(dash[0], out int start) && int.TryParse(dash[1], out int end))
                        {
                            var s = Math.Max(1, Math.Min(start, end));
                            var e = Math.Min(totalPages, Math.Max(start, end));
                            for (int p = s; p <= e; p++)
                            {
                                set.Add(p - 1);
                            }
                        }
                    }
                    else if (int.TryParse(part, out int pageNum))
                    {
                        if (pageNum >= 1 && pageNum <= totalPages)
                        {
                            set.Add(pageNum - 1);
                        }
                    }
                }
                result = System.Linq.Enumerable.ToList(System.Linq.Enumerable.OrderBy(set, x => x));
            }
            catch
            {
                for (int i = 0; i < totalPages; i++) result.Add(i);
            }
        }

        if (result.Count == 0)
        {
            for (int i = 0; i < totalPages; i++) result.Add(i);
        }

        if (maxPaidCount > 0 && result.Count > maxPaidCount)
        {
            result = System.Linq.Enumerable.ToList(System.Linq.Enumerable.Take(result, maxPaidCount));
        }

        return result;
    }

    private static async Task PrintImageFromMemoryAsync(
        byte[] imageBytes,
        PrinterItem targetPrinter,
        PrintJobRecord job,
        string documentName,
        CancellationToken cancellationToken)
    {
        var isColor = string.Equals(job.ColorMode, "color", StringComparison.OrdinalIgnoreCase);

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

                DrawImagePreservingAspect(e.Graphics, image, e.MarginBounds, isColor);
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
        var (cleanPaperSize, _) = ParsePaperSizeAndRange(job.PaperSize);
        foreach (PaperSize size in printDoc.PrinterSettings.PaperSizes)
        {
            if (string.Equals(size.PaperName, cleanPaperSize, StringComparison.OrdinalIgnoreCase) ||
                (cleanPaperSize.Equals("A4", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.A4) ||
                (cleanPaperSize.Equals("Letter", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.Letter) ||
                (cleanPaperSize.Equals("A3", StringComparison.OrdinalIgnoreCase) && size.Kind == PaperKind.A3))
            {
                printDoc.DefaultPageSettings.PaperSize = size;
                break;
            }
        }
    }

    private static readonly ColorMatrix GrayscaleMatrix = new ColorMatrix(new float[][]
    {
        new float[] {0.299f, 0.299f, 0.299f, 0, 0},
        new float[] {0.587f, 0.587f, 0.587f, 0, 0},
        new float[] {0.114f, 0.114f, 0.114f, 0, 0},
        new float[] {0,      0,      0,      1, 0},
        new float[] {0,      0,      0,      0, 1}
    });

    private static void DrawImagePreservingAspect(Graphics? g, Image img, Rectangle bounds, bool isColor)
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
        var destRect = new Rectangle(x, y, drawWidth, drawHeight);

        if (!isColor)
        {
            using var attr = new ImageAttributes();
            attr.SetColorMatrix(GrayscaleMatrix);
            g.DrawImage(img, destRect, 0, 0, img.Width, img.Height, GraphicsUnit.Pixel, attr);
        }
        else
        {
            g.DrawImage(img, destRect);
        }
    }
}
