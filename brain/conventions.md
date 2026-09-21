# Engineering Standards & Coding Conventions

## 1. Architectural Philosophy

1. **Zero-Disk In-Memory Guarantee**: Never persist customer documents to local storage. Stream directly to RAM, spool, and immediately zero RAM and delete from cloud storage.
2. **Deterministic Fallbacks**: Every automated system (e.g. printer selection, payment verification, session restore) must have an explicit, graceful fallback that does not crash or leave resources locked.
3. **Idempotent State Machines**: All state updates across webhooks, RPCs, and agent loops must be idempotent. Re-executing an operation must never corrupt state or cause regression.
4. **Token-Efficiency in AI Contexts**: Keep documentation dense, modular, and cross-referenced. Update only the relevant Markdown files in `brain/` when code changes.

---

## 2. TypeScript & React Standards (`/web`)

### 2.1 File & Directory Organization
- Pages: `page.tsx` (App Router structure).
- UI Components: PascalCase filenames (`PrintWizard.tsx`, `LiveTracker.tsx`).
- Utilities & Libraries: camelCase filenames (`supabaseClient.ts`, `tokenManager.ts`).
- Types: Centralized in `web/src/types/` (`printJob.ts`).

### 2.2 React Component Best Practices
- Strict TypeScript typing; avoid `any` wherever possible.
- Use functional components with hooks (`useState`, `useEffect`, `useCallback`).
- When referencing URL search parameters in Next.js 14 client components, wrap in `<Suspense>` to prevent client-side deopt bailouts.
- Use `clsx` and `twMerge` for conditional styling:
  ```typescript
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```

### 2.3 API Route Handlers
- Use Next.js Node.js Route Handlers (`export async function POST(req: NextRequest)`).
- Enforce strict input validation using schemas or regex before executing database queries.
- Return structured JSON responses with standard HTTP status codes (`200`, `400`, `401`, `404`, `429`, `500`).

---

## 3. C# & .NET Standards (`/windows-app`)

### 3.1 Language & Runtime Features
- Target: `.NET 8.0`, C# 12.
- Nullable reference types enabled (`<Nullable>enable</Nullable>`).
- File-scoped namespaces (`namespace PrintInfinity.Agent.Services;`).

### 3.2 MVVM Architecture (`CommunityToolkit.Mvvm`)
- ViewModels inherit from `ObservableObject`.
- Use source generator attributes:
  - `[ObservableProperty]` for automatic property and change event generation.
  - `[NotifyPropertyChangedFor(nameof(DerivedProperty))]` for computed values.
  - `[RelayCommand]` for automatic command binding.
- Thread Dispatching: All UI modifications originating from background tasks (Realtime events, Spooler monitors) must dispatch to UI thread via:
  ```csharp
  _dispatcherQueue?.TryEnqueue(() => { /* Update ObservableCollection or Property */ });
  ```

### 3.3 Win32 P/Invoke Conventions
- Pin native structures with `[StructLayout(LayoutKind.Sequential)]`.
- Always wrap native handles (`IntPtr`) in clean `try/finally` blocks with dedicated release calls (`ClosePrinter`, `Marshal.FreeHGlobal`).

### 3.4 Asynchronous Patterns
- Always pass `CancellationToken` through long-running operations.
- Avoid synchronous blocking (`.Result` or `.Wait()`); use `await` or `GetAwaiter().GetResult()` only when constrained by Win32 callback signatures.
- Static `HttpClient` with `SocketsHttpHandler` to prevent socket leaks.

---

## 4. SQL & Database Standards (`/supabase`)

### 4.1 Naming Conventions
- Tables: plural `snake_case` (`stores`, `print_jobs`, `payments`).
- Columns: lowercase `snake_case` (`customer_token`, `storage_expires_at`).
- Foreign Keys: `{singular_table}_id` (`store_id`, `print_job_id`).
- Migrations: Timestamped format `YYYYMMDDHHMMSS_description.sql`.

### 4.2 Security & RLS Standards
- Every newly created table **must immediately enable RLS**:
  ```sql
  ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
  ```
- Anonymous client access must be explicitly guarded by `customer_token` or restricted to public read-only views (`active = true`).
- Sensitive mutations must be encapsulated in `SECURITY DEFINER` stored procedures with an explicit `SET search_path = public`.

---

## 5. Maintenance Rules for Future Agents

1. **Synchronized Brain Updates**: When modifying code (e.g. adding an API endpoint, modifying a table, or altering printer logic), update the corresponding `.md` file in `d:\Print Infinty 2.0\brain\` in the same task.
2. **Minimal Token Footprint**: When writing documentation, avoid duplicating code blocks. Use state diagrams, markdown tables, and pseudocode algorithms to maximize information density.
3. **Preserve Architectural Constraints**: Do NOT introduce temporary disk file caches, bypass Supabase GoTrue authentication, or weaken Row Level Security policies under any circumstances.
