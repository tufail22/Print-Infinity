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
