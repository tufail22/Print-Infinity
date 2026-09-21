# External & Native Driver Integrations

## 1. Supabase Backend-as-a-Service Integration

Print Infinity utilizes the full Supabase suite across web and native desktop tiers:

```mermaid
graph TD
    subgraph Supabase BaaS
        P[PostgreSQL 15 Database]
        A[GoTrue Auth]
        S[Storage: print-uploads]
        R[Realtime Engine / WebSockets]
    end

    W[Next.js Web / API] -->|@supabase/supabase-js| P
    W -->|@supabase/supabase-js| S
    W -->|GoTrue Client| A
    W -->|Realtime Channels| R

    D[Windows Desktop Agent] -->|supabase-csharp Postgrest| P
    D -->|supabase-csharp Storage| S
    D -->|Gotrue.Session Auth| A
    D -->|RealtimeClient WebSocket| R
```

### 1.1 Supabase Realtime Engine (Change Data Capture)
- The table `public.print_jobs` has replica identity set to full:
  `ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;`
  `ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;`
- The Windows Agent connects via `JobQueueService.cs`:
  - Subscribes to `realtime:jobs:{storeId}` channel.
  - Intercepts `PostgresChangesOptions` on `public.print_jobs`.
  - Filters incoming jobs where `status == "pending_approval"`.
  - Automatically recovers connection state with reconnect event handlers.

### 1.2 Private Storage Bucket Management
- Direct storage uploads from the client browser bypass serverless functions, uploading directly to `print-uploads/{store_id}/{uuid}.{ext}`.
- Desktop agent generates a 60-second signed URL via:
  ```csharp
  var signedUrl = await _authService.Client.Storage
      .From("print-uploads")
      .CreateSignedUrl(storagePath, 60);
  ```
- Immediate deletion after spool confirmation:
  ```csharp
  await _authService.Client.Storage
      .From("print-uploads")
      .Remove(new List<string> { storagePath });
  ```

---

## 2. Razorpay Payment Gateway Integration

### 2.1 Order Creation (`/api/payment/create-order`)
- Uses the official `razorpay` Node.js SDK:
  ```typescript
  const instance = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const order = await instance.orders.create({
    amount: Math.round(amount * 100), // Converted to paise
    currency: "INR",
    receipt: `rcpt_${jobId.slice(0, 10)}`,
    notes: { print_job_id: jobId, store_id: storeId }
  });
  ```

### 2.2 Client-Side Checkout Modal
- In `PaymentSelector.tsx`, Razorpay Checkout script (`https://checkout.razorpay.com/v1/checkout.js`) is dynamically loaded.
- Launches native UPI selector (Google Pay, PhonePe, Paytm, BHIM) and QR display directly inside the kiosk flow.

### 2.3 Webhook Verification & Resilience
- Server-to-server webhook (`POST /api/payment/webhook`) verifies authenticity using cryptographic HMAC-SHA256 signature verification (`x-razorpay-signature`).
- Processes payment capture events asynchronously even if the customer's mobile browser is closed during transaction processing.

---

## 3. Windows Native Subsystem Integrations

### 3.1 Win32 Print Spooler (`winspool.drv`)
- Used for low-overhead hardware communication:
  - `OpenPrinter`: Obtains a handle (`phPrinter`) to the spooler queue.
  - `GetPrinter`: Reads `PRINTER_INFO_2` structures to verify online status and port mappings.
  - `EnumJobs`: Checks queued job count, page progress, and hardware error flags (`PAPEROUT`, `OFFLINE`, `ERROR`).
  - `ClosePrinter`: Releases spooler handle to prevent handle leaks.

### 3.2 Windows Management Instrumentation (WMI)
- Used during `ScanPrinters` in `WindowsPrinterService.cs`:
  - Queries `SELECT * FROM Win32_Printer` to identify driver names, port descriptions (USB, WSD, IP, TCP/IP), and hardware status.
  - WMI polling is throttled (10s on Hardware tab, 60s relaxed on Queue tab, and **paused completely** when minimized to tray).

### 3.3 Windows Data Protection & Credential Locker
- Primary: Uses WinRT `Windows.Security.Credentials.PasswordVault` to securely store GoTrue session tokens under resource name `PrintInfinity.Agent.Storekeeper`.
- Fallback: Uses .NET DPAPI `System.Security.Cryptography.ProtectedData` encrypted against the current Windows user profile (`DataProtectionScope.CurrentUser`).

### 3.4 Windows Notification & System Tray Subsystem
- Interacts with Win32 User32 and Shell32 APIs:
  - `Shell_NotifyIconW`: Manages system tray icon life cycle (`NIM_ADD`, `NIM_MODIFY`, `NIM_DELETE`).
  - `ShowWindow(hWnd, SW_HIDE)` / `ShowWindow(hWnd, SW_RESTORE)`: Controls window visibility without killing the process.
  - Native Windows Toast Notifications: Alerts storekeepers when new jobs arrive or when a printer is out of paper.
