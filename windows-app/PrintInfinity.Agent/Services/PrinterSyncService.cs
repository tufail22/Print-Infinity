using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using PrintInfinity.Agent.Models;

namespace PrintInfinity.Agent.Services;

public interface IPrinterSyncService
{
    Task<List<PrinterRecord>> GetStorePrintersAsync(Guid storeId);
    Task MergeWithInstalledPrintersAsync(List<PrinterItem> localPrinters, Guid storeId);
    Task<bool> SavePrinterMappingAsync(PrinterItem printer, Guid storeId);
}

public class PrinterSyncService : IPrinterSyncService
{
    private readonly ISupabaseAuthService _authService;

    public PrinterSyncService(ISupabaseAuthService authService)
    {
        _authService = authService;
    }

    public async Task<List<PrinterRecord>> GetStorePrintersAsync(Guid storeId)
    {
        await _authService.InitializeAsync();
        try
        {
            var response = await _authService.Client.From<PrinterRecord>()
                .Where(x => x.StoreId == storeId)
                .Get();

            return response.Models.ToList();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to fetch printers from Supabase: {ex.Message}");
            return new List<PrinterRecord>();
        }
    }

    public async Task MergeWithInstalledPrintersAsync(List<PrinterItem> localPrinters, Guid storeId)
    {
        var remoteList = await GetStorePrintersAsync(storeId);
        var remoteMap = new Dictionary<string, PrinterRecord>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in remoteList)
        {
            if (!string.IsNullOrWhiteSpace(r.WindowsPrinterName))
            {
                remoteMap[r.WindowsPrinterName] = r;
            }
        }

        foreach (var local in localPrinters)
        {
            if (remoteMap.TryGetValue(local.WindowsPrinterName, out var remote))
            {
                local.Id = remote.Id;
                local.DisplayName = remote.Name;
                local.Type = remote.Type;
                local.Connection = remote.Connection;
                local.Priority = remote.Priority > 0 ? remote.Priority : 1;
                local.IsCloudSynced = true;
                local.LastSavedAtText = "Synced with Cloud";
            }
            else
            {
                local.IsCloudSynced = false;
                local.LastSavedAtText = "Unsaved in Cloud";
            }
        }
    }

    public async Task<bool> SavePrinterMappingAsync(PrinterItem printer, Guid storeId)
    {
        await _authService.InitializeAsync();
        printer.IsSaving = true;

        try
        {
            // Normalize values according to database CHECK constraints
            var normalizedType = string.Equals(printer.Type, "color", StringComparison.OrdinalIgnoreCase) ? "color" : "bw";
            var normalizedConnection = string.Equals(printer.Connection, "wifi", StringComparison.OrdinalIgnoreCase) ? "wifi" : "usb";
            var displayName = string.IsNullOrWhiteSpace(printer.DisplayName) ? printer.WindowsPrinterName : printer.DisplayName;

            // Check if record already exists for this windows_printer_name and store_id
            var existingResponse = await _authService.Client.From<PrinterRecord>()
                .Where(x => x.StoreId == storeId && x.WindowsPrinterName == printer.WindowsPrinterName)
                .Get();

            var existing = existingResponse.Models.FirstOrDefault();

            if (existing != null)
            {
                existing.Name = displayName;
                existing.Type = normalizedType;
                existing.Connection = normalizedConnection;
                existing.Priority = Math.Max(1, printer.Priority);
                existing.IsOnline = printer.IsOnline;
                existing.UpdatedAt = DateTime.UtcNow;

                var updateResponse = await _authService.Client.From<PrinterRecord>().Update(existing);
                var updated = updateResponse.Models.FirstOrDefault();
                if (updated != null)
                {
                    printer.Id = updated.Id;
                }
            }
            else
            {
                var newRecord = new PrinterRecord
                {
                    Id = printer.Id ?? Guid.NewGuid(),
                    StoreId = storeId,
                    Name = displayName,
                    Type = normalizedType,
                    Connection = normalizedConnection,
                    Priority = Math.Max(1, printer.Priority),
                    WindowsPrinterName = printer.WindowsPrinterName,
                    IsOnline = printer.IsOnline
                };

                var insertResponse = await _authService.Client.From<PrinterRecord>().Insert(newRecord);
                var inserted = insertResponse.Models.FirstOrDefault();
                if (inserted != null)
                {
                    printer.Id = inserted.Id;
                }
            }

            printer.IsCloudSynced = true;
            printer.LastSavedAtText = $"Saved to Supabase ({DateTime.Now:HH:mm:ss})";
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving printer mapping to Supabase: {ex.Message}");
            printer.LastSavedAtText = $"Save error: {ex.Message}";
            return false;
        }
        finally
        {
            printer.IsSaving = false;
        }
    }
}
