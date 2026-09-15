# Print Infinity

> High-speed, privacy-first cloud-to-local printing ecosystem for retail print shops.

---

## 📖 Architecture & Workflow

Print Infinity bridges the gap between walk-in customers and local print shop hardware without cumbersome cables, email attachments, or USB drives.

```
                   ┌───────────────────────────────┐
                   │    Customer Scans QR Code     │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │   /web (Next.js 14 Web App)   │
                   │  • Upload Document            │
                   │  • Configure Print Settings   │
                   │  • Select Cash / UPI Payment  │
                   └───────────────┬───────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │       Supabase Backend        │
                   │  • Encrypted Object Storage   │
                   │  • Postgres Job Record        │
                   │  • Realtime Broadcast Event   │
                   └───────────────┬───────────────┘
                                   │
                         Realtime Job Stream
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │ /windows-app (WinUI 3 Agent)  │
                   │  • Storekeeper Desktop App    │
                   │  • Preview & Queue Management │
                   │  • Approve or Reject Job      │
                   └───────────────┬───────────────┘
                                   │
                           (Upon Approval)
                                   ▼
                   ┌───────────────────────────────┐
                   │        Printer Stream         │
                   │  • In-Memory Network/GDI Pipe │
                   │  • NEVER Persisted to Disk    │
                   │  • Immediate Memory Eviction  │
                   └───────────────────────────────┘
```

### End-to-End Flow

1. **Scan & Connect**: The customer walks into the print shop and scans an in-store QR code using their smartphone or desktop browser. This opens the `/web` portal with the shop's station identifier preloaded.
2. **Configure & Pay**:
   - The customer uploads their document (PDF, DOCX, Images).
   - Selects print settings: copies, color vs. monochrome, page ranges, orientation, duplex options, and paper size.
   - Chooses a payment method (**Cash** at counter or instant **UPI**).
   - Submits the print job.
3. **Store & Broadcast**:
   - Supabase securely stores the document file and inserts a new job record with `status = 'pending'`.
   - A Supabase **Realtime** event notifies the connected storekeeper desktop client.
4. **Approve / Reject (Storekeeper)**:
   - The `/windows-app` (WinUI 3 on .NET 8) receives the real-time notification with audio/visual cues.
   - The storekeeper reviews the job details, confirms payment (if Cash), and clicks **Approve** or **Reject**.
5. **Zero-Disk Streaming & Privacy**:
   - Upon approval, the Windows agent streams the document bytes directly from Supabase Storage into the Windows Print Spooler / printer driver stream in-memory.
   - **Zero Disk Persistence Guarantee**: The document is **never saved to the local hard drive** of the storekeeper's PC, guaranteeing customer privacy and data security.
   - The Supabase storage record and database job status transition to `completed` with automatic lifecycle expiration.

---

## 📂 Monorepo Structure

```
print-infinity/
├── web/                   # Customer-facing Web Application
│   ├── src/
│   │   ├── app/           # Next.js 14 App Router (layout, page, styles)
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # Supabase client and helper utilities
│   ├── public/            # Static assets
│   ├── package.json       # Next.js dependencies & scripts
│   ├── tailwind.config.ts # Tailwind CSS configuration
│   └── tsconfig.json      # TypeScript compiler settings
│
├── windows-app/           # Storekeeper Desktop Agent
│   ├── PrintInfinity.Agent.sln
│   └── PrintInfinity.Agent/
│       ├── PrintInfinity.Agent.csproj  # .NET 8 WinUI 3 (Windows App SDK)
│       ├── App.xaml / App.xaml.cs       # Application lifecycle
│       ├── MainWindow.xaml / .cs        # Queue dashboard & approval UI
│       ├── Models/                      # PrintJob & PrintSettings models
│       ├── Services/                    # Supabase Realtime & in-memory print streamer
│       ├── ViewModels/                  # MVVM view models
│       └── Package.appxmanifest         # MSIX application manifest
│
├── supabase/              # Backend Services & Data Layer
│   ├── config.toml        # Supabase local development configuration
│   ├── migrations/        # Declarative SQL schema migrations
│   ├── functions/         # Supabase Edge Functions (Deno/TypeScript)
│   └── seed.sql           # Initial development seed data
│
├── .gitignore             # CI-friendly ignore rules for Node, .NET, and Supabase
├── package.json           # Root workspace configuration
└── README.md              # Architecture & documentation
```

---

## 🚀 Getting Started (Scaffold Baseline)

### Prerequisites

- **Node.js**: v18.17+ or v20+ (recommended LTS)
- **.NET 8 SDK**: .NET 8.0 with Windows App SDK workload (`net8.0-windows10.0.19041.0`)
- **Supabase CLI**: For running local database, storage, and edge functions

### Development

#### 1. Web Application (`/web`)
```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Start local Next.js dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the customer interface.

#### 2. Windows Agent (`/windows-app`)
```bash
# Open solution in Visual Studio 2022 (with .NET Desktop Development & Windows App SDK installed)
start windows-app/PrintInfinity.Agent.sln

# Or build via .NET CLI
dotnet build windows-app/PrintInfinity.Agent.sln
```

#### 3. Supabase Backend (`/supabase`)
```bash
# Start local Supabase containers (Docker required)
npx supabase start

# Apply migrations
npx supabase db reset
```

---

## 🔒 Security & Privacy Commitments

- **No Local Artifact Retention**: Documents are processed via streaming memory buffers (`MemoryStream`) and passed to printer APIs without disk writes.
- **Secure File Expiration**: Uploaded customer files have strict TTLs in Supabase Storage and are purged upon job completion or cancellation.
- **Role-Based Isolation**: Customer web clients only have permissions to insert their own jobs; only authenticated store agents can subscribe to real-time shop channels.
