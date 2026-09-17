using System;
using Postgrest.Attributes;
using Postgrest.Models;

namespace PrintInfinity.Agent.Models;

[Table("printers")]
public class PrinterRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("store_id")]
    public Guid StoreId { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("type")]
    public string Type { get; set; } = "bw"; // 'color' or 'bw'

    [Column("connection")]
    public string Connection { get; set; } = "usb"; // 'usb' or 'wifi'

    [Column("windows_printer_name")]
    public string WindowsPrinterName { get; set; } = string.Empty;

    [Column("is_online")]
    public bool IsOnline { get; set; }

    [Column("created_at", ignoreOnInsert: true)]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at", ignoreOnInsert: true)]
    public DateTime UpdatedAt { get; set; }
}

[Table("storekeepers")]
public class StorekeeperRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; } // references auth.users(id)

    [Column("store_id")]
    public Guid StoreId { get; set; }

    [Column("role")]
    public string Role { get; set; } = "storekeeper";

    [Column("created_at", ignoreOnInsert: true)]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at", ignoreOnInsert: true)]
    public DateTime UpdatedAt { get; set; }
}

[Table("stores")]
public class StoreRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("address")]
    public string? Address { get; set; }

    [Column("active")]
    public bool Active { get; set; }
}

[Table("print_jobs")]
public class PrintJobRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("store_id")]
    public Guid StoreId { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending_payment";

    [Column("color_mode")]
    public string ColorMode { get; set; } = "bw"; // 'color' or 'bw'

    [Column("copies")]
    public int Copies { get; set; } = 1;

    [Column("paper_size")]
    public string PaperSize { get; set; } = "A4";

    [Column("duplex")]
    public bool Duplex { get; set; }

    [Column("page_count")]
    public int PageCount { get; set; } = 1;

    [Column("storage_path")]
    public string? StoragePath { get; set; }

    [Column("customer_token")]
    public string CustomerToken { get; set; } = string.Empty;

    [Column("rejection_reason")]
    public string? RejectionReason { get; set; }

    [Column("created_at", ignoreOnInsert: true)]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at", ignoreOnInsert: true)]
    public DateTime UpdatedAt { get; set; }
}

[Table("payments")]
public class PaymentRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("print_job_id")]
    public Guid PrintJobId { get; set; }

    [Column("method")]
    public string Method { get; set; } = "cash";

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("gateway_ref")]
    public string? GatewayRef { get; set; }

    [Column("created_at", ignoreOnInsert: true)]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at", ignoreOnInsert: true)]
    public DateTime UpdatedAt { get; set; }
}
