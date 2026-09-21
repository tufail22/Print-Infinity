# Deployment, Packaging & Operational Guide

## 1. Web Application Deployment (Vercel)

The `/web` Next.js application is configured for deployment on Vercel with Node.js and Edge serverless runtimes:

### 1.1 Vercel Configuration (`/web/vercel.json` & root `vercel.json`)
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install"
}
```

### 1.2 Environment Variables (Vercel Dashboard)
| Variable Name | Required | Scope | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Base Supabase project URL (`https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Yes | Public | Supabase anonymous public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret | Elevated service role key for admin route handlers. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Public | Razorpay Key ID for client checkout SDK. |
| `RAZORPAY_KEY_SECRET` | Yes | Secret | Razorpay Secret for order creation & HMAC verification. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Secret | Dedicated webhook signing secret from Razorpay Dashboard. |

---

## 2. Windows Desktop Agent Deployment

The desktop agent runs unpackaged as a self-contained, high-performance x64 binary on Windows 10/11.

### 2.1 Compilation & Publishing Command
Compiled via the .NET CLI:
```powershell
dotnet publish "windows-app\PrintInfinity.Agent\PrintInfinity.Agent.csproj" `
  -c Release `
  -r win-x64 `
  --self-contained `
  -o "windows-app\publish\win-x64"
```
- `--self-contained`: Packages the .NET 8 runtime directly within the distribution. The shopkeeper PC **does not require** .NET 8 SDK or runtime pre-installed.
- `-r win-x64`: Native 64-bit machine code compilation.

### 2.2 Installation Directory & File Placement
- Installed Location: `%LOCALAPPDATA%\Programs\PrintInfinityAgent\`
- Executable: `PrintInfinity.Agent.exe`
- Shortcuts automatically generated:
  - Desktop: `%USERPROFILE%\Desktop\Print Infinity Agent.lnk`
  - Start Menu: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Print Infinity\Print Infinity Agent.lnk`

### 2.3 Automated Install & Update Scripts
1. **Clean Reinstall (`reinstall_agent.ps1`)**:
   - Safely terminates existing `PrintInfinity.Agent` processes.
   - Compiles fresh self-contained release build.
   - Copies files to `%LOCALAPPDATA%\Programs\PrintInfinityAgent`.
   - Creates/updates Desktop & Start Menu shortcuts.
   - Launches interactive instance.
2. **Shop Deployment Script (`install.ps1`)**:
   - Designed for shopkeeper automated deployment.
   - Creates Windows registry keys for auto-start at Windows login (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
   - Launches app with `--tray` flag so it starts minimized to the notification area upon Windows boot.
3. **One-Click Batch Launcher (`Install-PrintInfinityAgent.bat`)**:
   - Double-clickable wrapper executing `install.ps1` with bypassed execution policies.

---

## 3. Desktop Agent Configuration (`AppConfig.cs`)

Environment variables and configuration settings for the Windows Agent:

```csharp
public static class AppConfig
{
    // Supabase endpoint
    public static string SupabaseUrl =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
        ?? "https://ynfjuqqkrqgimttpgumx.supabase.co";

    // Public Anon Key
    public static string SupabaseAnonKey =>
        Environment.GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        ?? "sb_publishable_9oCehcE94-agTcP3DPz9dw_kKe_OCYd";

    // Primary Flagship Store UUID
    public static Guid StoreId =>
        Guid.TryParse(Environment.GetEnvironmentVariable("STORE_ID"), out var id)
            ? id
            : Guid.Parse("a0000000-0000-0000-0000-000000000001");
}
```

---

## 4. Diagnostics & Logging System (`startup.log`)

The agent writes detailed operational telemetry to an asynchronous file channel:
- **Log Location**: `%LOCALAPPDATA%\PrintInfinityAgent\startup.log`
- **Mechanism**:
  - `Program.Log(string)` writes to an unbuffered `System.Threading.Channels.Channel<string>`.
  - A dedicated single background thread drains the channel and writes to disk.
  - Logging is completely non-blocking and never introduces UI stutter.
- **Log Content**:
  - Windows OS build & version.
  - XAML check verification status.
  - WinRT ComWrappers initialization status.
  - Window HWND allocation.
  - Supabase GoTrue authentication handshake.
  - Realtime WebSocket subscription state (`Joining`, `Joined`, `Closed`).
  - Win32 local printer enumeration and online detection count.
