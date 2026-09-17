# ==============================================================================
# Print Infinity Agent — Automated Windows Installer
# ==============================================================================
# Installs the agent into %LocalAppData%\Programs\PrintInfinityAgent
# Configures Windows Startup minimized to tray (--tray)
# Creates Desktop and Start Menu shortcuts
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Print Infinity Agent — Shop PC Setup               " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$sourceDir = Join-Path $PSScriptRoot "publish"
if (-not (Test-Path $sourceDir)) {
    # Fallback to current directory if script is packaged inside the folder
    $sourceDir = $PSScriptRoot
}

$exeSource = Join-Path $sourceDir "PrintInfinity.Agent.exe"
if (-not (Test-Path $exeSource)) {
    # If binary is not pre-packaged, check if dotnet SDK is available to build it
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        Write-Host "[*] Pre-built binary not found. Compiling Print Infinity Agent with .NET..." -ForegroundColor Cyan
        $projPath = Join-Path $PSScriptRoot "PrintInfinity.Agent\PrintInfinity.Agent.csproj"
        if (Test-Path $projPath) {
            & dotnet publish $projPath -c Release -r win-x64 --self-contained -o (Join-Path $PSScriptRoot "publish")
            $sourceDir = Join-Path $PSScriptRoot "publish"
            $exeSource = Join-Path $sourceDir "PrintInfinity.Agent.exe"
        }
    }
}

if (-not (Test-Path $exeSource)) {
    Write-Error "Could not locate 'PrintInfinity.Agent.exe'. Please ensure the publish folder is present or .NET 8 SDK is installed."
    exit 1
}


$targetDir = Join-Path $env:LOCALAPPDATA "Programs\PrintInfinityAgent"
Write-Host "[1/5] Target directory: $targetDir" -ForegroundColor White

# 1. Stop any running instances of Print Infinity Agent
$runningProcesses = Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue
if ($runningProcesses) {
    Write-Host "[!] Existing Print Infinity Agent detected. Stopping process..." -ForegroundColor Yellow
    $runningProcesses | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# 2. Ensure target directory exists and copy files
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Write-Host "[2/5] Copying application files..." -ForegroundColor White
Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force

$installedExe = Join-Path $targetDir "PrintInfinity.Agent.exe"

# 3. Create Windows Startup Registry Entry (Minimizes to tray on boot)
Write-Host "[3/5] Registering for automatic Windows startup (--tray)..." -ForegroundColor White
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCommand = "`"$installedExe`" --tray"
Set-ItemProperty -Path $runKeyPath -Name "PrintInfinityAgent" -Value $runCommand -Force
Write-Host "      Startup registry configured: $runCommand" -ForegroundColor Green

# 4. Create Desktop and Start Menu Shortcuts
Write-Host "[4/5] Creating shortcuts..." -ForegroundColor White
$wshShell = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcutPath = Join-Path $desktopPath "Print Infinity Agent.lnk"
$shortcut = $wshShell.CreateShortcut($desktopShortcutPath)
$shortcut.TargetPath = $installedExe
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = "Print Infinity Cloud Printing Agent for Shop Keepers"
$shortcut.Save()

# Start Menu Shortcut
$startMenuPrograms = [Environment]::GetFolderPath("Programs")
$startMenuDir = Join-Path $startMenuPrograms "Print Infinity"
if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}
$startMenuShortcutPath = Join-Path $startMenuDir "Print Infinity Agent.lnk"
$startShortcut = $wshShell.CreateShortcut($startMenuShortcutPath)
$startShortcut.TargetPath = $installedExe
$startShortcut.WorkingDirectory = $targetDir
$startShortcut.Description = "Print Infinity Cloud Printing Agent"
$startShortcut.Save()

# 5. Create clean Uninstaller script in target directory
$uninstallScript = @"
Write-Host "Uninstalling Print Infinity Agent..." -ForegroundColor Yellow
Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "PrintInfinityAgent" -ErrorAction SilentlyContinue
Remove-Item -Path "$desktopShortcutPath" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$startMenuDir" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Application shortcuts and startup entries removed." -ForegroundColor Green
Write-Host "You can now delete this folder: $targetDir" -ForegroundColor White
"@
Set-Content -Path (Join-Path $targetDir "uninstall.ps1") -Value $uninstallScript -Force

$uninstallBat = @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
"@
Set-Content -Path (Join-Path $targetDir "Uninstall.bat") -Value $uninstallBat -Force

Write-Host "[5/5] Launching Print Infinity Agent..." -ForegroundColor White
Start-Process -FilePath $installedExe

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "   Installation Complete!                             " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host " The Print Infinity Agent is now running." -ForegroundColor White
Write-Host " It will automatically start minimized to the system tray" -ForegroundColor White
Write-Host " every time this PC powers on." -ForegroundColor White
Write-Host ""
