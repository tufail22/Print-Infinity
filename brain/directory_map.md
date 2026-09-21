# Repository Directory Map & Module Taxonomy

```
d:\Print Infinty 2.0\
├── .github/                       # CI/CD workflows and GitHub automation
├── docs/                          # Specifications, audit logs, privacy guidelines
├── scratch/                       # Automated test suites, simulations, verification scripts
├── supabase/                      # Database migrations, seed data, and Supabase CLI configuration
├── web/                           # Customer web application & Next.js backend Route Handlers
├── windows-app/                   # Native Windows Agent desktop application (.NET 8 / WinUI 3)
├── brain/                         # AI knowledge base and system architecture documentation
├── package.json                   # Root monorepo/workspace scripts and dependencies
├── vercel.json                    # Vercel deployment configuration and build overrides
└── INSTALL.md / SETUP.md          # Setup and installation instructions for operators
```

---

## 1. Web Application (`/web`)

Next.js 14 App Router project providing customer kiosk frontend, administrative portal, and backend serverless endpoints.

```
web/
├── package.json                   # Web dependencies (Next 14.2, React 18, Supabase, Razorpay, Lucide)
├── tsconfig.json                  # TypeScript compiler settings and path aliases (@/* -> src/*)
├── tailwind.config.ts             # Tailwind CSS tokens, color palettes, and typography presets
├── vercel.json                    # Next.js deployment routing config
├── public/                        # Static assets, branding logos, favicon
└── src/
    ├── app/
    │   ├── layout.tsx             # Root layout with fonts, metadata, and global HTML wrappers
    │   ├── globals.css            # Custom CSS utilities, scrollbar styling, animations
    │   ├── page.tsx               # Root redirector (navigates to /print or /admin)
    │   ├── print/
    │   │   ├── layout.tsx         # Customer portal shell with responsive constraints
    │   │   └── page.tsx           # Customer entrypoint hosting the PrintWizard component
    │   ├── admin/
    │   │   └── page.tsx           # Storekeeper admin portal (pricing, printer tags, analytics, auth)
    │   └── api/
    │       ├── create-order/      # Legacy order endpoint (aliased to payment/create-order)
    │       ├── verify-payment/    # Legacy verification endpoint
    │       ├── print-jobs/
    │       │   ├── create/route.ts# POST: Rate-limited job creation, validation, and storage binding
    │       │   └── status/route.ts# GET: Customer status polling endpoint (token-guarded)
    │       ├── payment/
    │       │   ├── create-order/route.ts  # POST: Razorpay order generation in INR paise
    │       │   ├── verify/route.ts        # POST: Client-side Razorpay signature verification
    │       │   ├── switch-to-cash/route.ts# POST: In-flight payment mode switch to cash at counter
    │       │   └── webhook/route.ts       # POST: Razorpay server-to-server webhook (HMAC-SHA256)
    │       └── store/
    │           ├── register/route.ts      # POST: Store registration endpoint
    │           └── manage/route.ts        # GET/POST: Store configuration and rates management
    ├── components/
    │   └── print/
    │       ├── PrintWizard.tsx    # 6-step customer wizard orchestrator & state machine
    │       ├── StoreHeader.tsx    # Store identification banner, location, and rates display
    │       ├── UploadZone.tsx     # File drag-and-drop, PDF validation, image compression UI
    │       ├── SettingsSheet.tsx  # Detailed print specs (copies, paper size, duplex, margins, n-up)
    │       ├── PrintPreview.tsx   # Canvas/thumbnail rendering of uploaded pages with privacy notices
    │       ├── PaymentSelector.tsx# Razorpay UPI modal trigger vs Pay at Counter toggle
    │       └── LiveTracker.tsx    # Realtime status tracker with progress ring and step indicators
    ├── config/
    │   └── pricing.ts             # Price calculation engine, per-page rates, size multipliers, discounts
    ├── lib/
    │   ├── supabaseClient.ts      # Supabase browser client & customer authenticated factory
    │   ├── tokenManager.ts        # Ephemeral customer token generator & localStorage persistence
    │   ├── imageCompressor.ts     # Client-side image downscaling and compression before upload
    │   └── pdfUtils.ts            # Client-side PDF page counting and validation utilities
    └── types/
        └── printJob.ts            # TypeScript domain types (PrintJobRecord, DetailedPrintSettings, etc.)
```

---

## 2. Windows Native Desktop Agent (`/windows-app`)

Native Windows 11 Fluent desktop client running on the store PC to intercept, authorize, and spool print jobs directly into hardware.

```
windows-app/
├── PrintInfinity.Agent.sln        # Visual Studio solution file
├── reinstall_agent.ps1            # Automated release publisher, file installer, and process launcher
├── install.ps1                    # Installer PowerShell script for automated shop deployments
├── Install-PrintInfinityAgent.bat # One-click batch launcher for shopkeepers
└── PrintInfinity.Agent/
    ├── PrintInfinity.Agent.csproj # .NET 8, WindowsAppSDK 1.5, x64 self-contained build spec
    ├── Package.appxmanifest       # MSIX application declaration and packaging metadata
    ├── app.manifest               # Win32 OS compatibility (PerMonitorV2 DPI awareness)
    ├── App.xaml / App.xaml.cs     # Application entrypoint, lifecycle hooks, unhandled exception trap
    ├── MainWindow.xaml / .cs      # WinUI 3 Window shell, System Tray integration, Navigation manager
    ├── Program.cs                 # Main() bootstrap, COM wrappers, async channel logging (startup.log)
    ├── Config/
    │   └── AppConfig.cs           # Environment loader (Supabase URL, Anon Key, Store ID)
    ├── Models/
    │   ├── DbModels.cs            # Postgrest models (StoreRecord, PrinterRecord, PrintJobRecord, PaymentRecord)
    │   ├── QueueItem.cs           # Observable model for pending print queue jobs (privacy-first settings)
    │   ├── PrinterItem.cs         # Observable model for hardware printers, connection types, priority
    │   ├── AuditLogEntry.cs       # Text-only operational log entry for printed jobs (zero-disk)
    │   ├── PrintJob.cs            # Domain print job representation
    │   └── PrintSettings.cs       # Technical print settings model
    ├── Services/
    │   ├── SupabaseAuthService.cs # GoTrue auth provider, storekeeper session validator
    │   ├── CredentialStorageService.cs # Windows PasswordVault & DPAPI session encrypter
    │   ├── JobQueueService.cs     # Realtime WebSocket subscriber, state monitor, queue manager
    │   ├── PrintPipelineService.cs# In-memory streaming, priority fallback, zero-disk RAM wiper
    │   ├── WindowsPrinterService.cs # WMI and Win32 hardware printer detector and health checker
    │   ├── PrinterSyncService.cs  # Cloud synchronization for hardware printer mappings
    │   ├── SystemTrayService.cs   # Win32 Shell_NotifyIconW background system tray runner
    │   └── Printing/
    │       ├── IPrintEngine.cs    # Print engine abstraction interface
    │       ├── WindowsPrintEngine.cs # WinRT PdfDocument memory loader & StandardPrintController
    │       ├── IPrintSpoolerMonitor.cs # Spooler monitor interface
    │       └── PrintSpoolerMonitor.cs # Win32 winspool.drv job status tracker (OpenPrinter, EnumJobs)
    ├── ViewModels/
    │   ├── LoginViewModel.cs      # Auth viewmodel (GoTrue login/registration, auto-login check)
    │   ├── LiveQueueViewModel.cs  # Pending jobs queue, auto-dismissing notifications, action handlers
    │   └── PrinterSetupViewModel.cs# Hardware printer configuration, priority tagging, cloud save
    └── Views/
        ├── LoginView.xaml / .cs   # Authentication view (Sign In / Register / Remember Me)
        ├── DashboardView.xaml / .cs # Main storekeeper interface (Queue, Printers, Audit Log tabs)
        ├── PrinterSetupView.xaml / .cs # Hardware printer cards, priority spinners, cloud sync
        ├── PrinterSelectionDialog.xaml / .cs # Manual printer selection modal when auto-pick is ambiguous
        └── RejectReasonDialog.xaml / .cs # Job rejection dialog transmitting reasons to customer
```

---

## 3. Database & Cloud Backend (`/supabase`)

Database migrations, declarative schemas, Row Level Security (RLS) policies, and RPC functions.

```
supabase/
├── config.toml                    # Supabase local development configuration
├── seed.sql                       # Initial seed data for test environments
└── migrations/
    ├── 20240101000000_print_infinity_core.sql # Core tables, RLS policies, storage bucket, triggers
    ├── 20240102000000_add_printer_priority.sql # Adds priority integer column to public.printers
    ├── 20240102000000_printers_index.sql      # Multi-column indexes on public.printers
    ├── 20240103000000_approve_print_job_rpc.sql # approve_print_job security definer stored procedure
    └── 20240104000000_fix_payment_advance_idempotency.sql # verify_payment_and_advance_job idempotency guard
```

---

## 4. Verification & Scratch Suite (`/scratch`)

Test scripts, failure simulation harnesses, and diagnostic utilities.

```
scratch/
├── e2e_simulation.mjs             # End-to-end customer upload -> payment -> agent verification simulation
├── test_api_resilience.mjs        # Stress and chaos testing against Next.js route handlers
├── test_db_idempotency.mjs        # Payment race condition and status advance idempotency tests
├── test_live_webhook.mjs          # Razorpay HMAC-SHA256 signature verification tests
├── test_payments_suite.mjs        # Full payment regression suite (UPI & Cash flows)
└── capture_window.ps1             # Win32 screen capture automation for UI verification
```
