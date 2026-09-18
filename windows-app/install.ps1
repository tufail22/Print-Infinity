# ==============================================================================
# Print Infinity Agent - Automated Windows Installer
# ==============================================================================
# Installs the agent into %LocalAppData%\Programs\PrintInfinityAgent
# Configures Windows Startup minimized to tray
# Creates Desktop and Start Menu shortcuts
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Print Infinity Agent - Shop PC Setup               " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$sourceDir = Join-Path $PSScriptRoot "publish\win-x64"
if (-not (Test-Path (Join-Path $sourceDir "PrintInfinity.Agent.exe"))) {
    $sourceDir = Join-Path $PSScriptRoot "publish"
}
if (-not (Test-Path (Join-Path $sourceDir "PrintInfinity.Agent.exe"))) {
    $sourceDir = $PSScriptRoot
}

$exeSource = Join-Path $sourceDir "PrintInfinity.Agent.exe"
if (-not (Test-Path $exeSource)) {
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        Write-Host "[*] Pre-built binary not found. Compiling with .NET SDK..." -ForegroundColor Cyan
        $projPath = Join-Path $PSScriptRoot "PrintInfinity.Agent\PrintInfinity.Agent.csproj"
        if (Test-Path $projPath) {
            $publishOut = Join-Path $PSScriptRoot "publish"
            & dotnet publish $projPath -c Release -r win-x64 --self-contained -o $publishOut
            $sourceDir = $publishOut
            $exeSource = Join-Path $sourceDir "PrintInfinity.Agent.exe"
        }
    }
}

if (-not (Test-Path $exeSource)) {
    Write-Error "Could not locate PrintInfinity.Agent.exe. Ensure publish folder exists or .NET 8 SDK is installed."
    exit 1
}

$targetDir = Join-Path $env:LOCALAPPDATA "Programs\PrintInfinityAgent"
Write-Host "[1/5] Target directory: $targetDir" -ForegroundColor White

# Stop any running instances
$runningProcesses = Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-Host "[!] Stopping existing agent process..." -ForegroundColor Yellow
    $runningProcesses | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# Ensure target directory and copy files
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Write-Host "[2/5] Copying application files..." -ForegroundColor White
Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force

$installedExe = Join-Path $targetDir "PrintInfinity.Agent.exe"

# Register Windows Startup entry with --tray parameter
Write-Host "[3/5] Registering for automatic Windows startup (tray mode)..." -ForegroundColor White
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCommand = "`"$installedExe`" --tray"
Set-ItemProperty -Path $runKeyPath -Name "PrintInfinityAgent" -Value $runCommand -Force
Write-Host "      Startup entry saved: $runCommand" -ForegroundColor Green

# Create Desktop and Start Menu shortcuts
Write-Host "[4/5] Creating shortcuts..." -ForegroundColor White
$wshShell = New-Object -ComObject WScript.Shell

$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcutPath = Join-Path $desktopPath "Print Infinity Agent.lnk"
$shortcut = $wshShell.CreateShortcut($desktopShortcutPath)
$shortcut.TargetPath = $installedExe
$shortcut.WorkingDirectory = $targetDir
$shortcut.IconLocation = "$installedExe,0"
$shortcut.Description = "Print Infinity Cloud Printing Agent for Shopkeepers"
$shortcut.Save()

$startMenuPrograms = [Environment]::GetFolderPath("Programs")
$startMenuDir = Join-Path $startMenuPrograms "Print Infinity"
if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}
$startMenuShortcutPath = Join-Path $startMenuDir "Print Infinity Agent.lnk"
$startShortcut = $wshShell.CreateShortcut($startMenuShortcutPath)
$startShortcut.TargetPath = $installedExe
$startShortcut.WorkingDirectory = $targetDir
$startShortcut.IconLocation = "$installedExe,0"
$startShortcut.Description = "Print Infinity Cloud Printing Agent"
$startShortcut.Save()

# Write uninstall script
$uninstallPs1 = Join-Path $targetDir "uninstall.ps1"
$uninstallBat = Join-Path $targetDir "Uninstall.bat"

$uninstallLines = @(
    'Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue | Stop-Process -Force',
    "Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'PrintInfinityAgent' -ErrorAction SilentlyContinue",
    "Remove-Item -Path '$desktopShortcutPath' -Force -ErrorAction SilentlyContinue",
    "Remove-Item -Path '$startMenuDir' -Recurse -Force -ErrorAction SilentlyContinue",
    'Write-Host "Uninstall complete. You may now delete this folder manually." -ForegroundColor Green'
)
Set-Content -Path $uninstallPs1 -Value $uninstallLines -Force

$batLines = @(
    "@echo off",
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""%~dp0uninstall.ps1""",
    "pause"
)
Set-Content -Path $uninstallBat -Value $batLines -Force

# Launch the application
Write-Host "[5/5] Launching Print Infinity Agent..." -ForegroundColor White
Start-Process -FilePath $installedExe -WorkingDirectory $targetDir

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "   Installation Complete!                             " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host " Agent is now running. Check the system tray." -ForegroundColor White
Write-Host " It will auto-start minimized to tray on every boot." -ForegroundColor White
Write-Host ""
