# ==============================================================================
# Print Infinity Agent - Clean Reinstaller & Launcher
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Print Infinity Agent - Clean Reinstall & Setup         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$sourceDir = Join-Path $PSScriptRoot "publish\win-x64"
$targetDir = Join-Path $env:LOCALAPPDATA "Programs\PrintInfinityAgent"
$installedExe = Join-Path $targetDir "PrintInfinity.Agent.exe"

# Step 1: Terminate existing instances
Write-Host "[1/5] Stopping any running agent processes..." -ForegroundColor White
Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "      Terminating process PID $($_.Id)..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Verify processes are stopped
$remaining = Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "[!] Warning: Force stopping lingering process..." -ForegroundColor Yellow
    $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Step 2: Ensure source binary exists
Write-Host "[2/5] Checking published release binaries..." -ForegroundColor White
$sourceExe = Join-Path $sourceDir "PrintInfinity.Agent.exe"
if (-not (Test-Path $sourceExe)) {
    Write-Host "      Compiling fresh self-contained build..." -ForegroundColor Cyan
    $proj = Join-Path $PSScriptRoot "PrintInfinity.Agent\PrintInfinity.Agent.csproj"
    dotnet publish $proj -c Release -r win-x64 --self-contained -o $sourceDir
}

# Step 3: Copy to target directory
Write-Host "[3/5] Installing fresh files to: $targetDir" -ForegroundColor White
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force
Write-Host "      All application binaries successfully copied." -ForegroundColor Green

# Step 4: Create Desktop and Start Menu Shortcuts
Write-Host "[4/5] Updating shortcuts..." -ForegroundColor White
$wsh = New-Object -ComObject WScript.Shell

# Desktop shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktopPath "Print Infinity Agent.lnk"
$shortcut = $wsh.CreateShortcut($desktopLnk)
$shortcut.TargetPath = $installedExe
$shortcut.WorkingDirectory = $targetDir
$shortcut.IconLocation = "$installedExe,0"
$shortcut.Description = "Print Infinity Agent - Shopkeeper PC Portal"
$shortcut.Save()
Write-Host "      Desktop shortcut: $desktopLnk" -ForegroundColor Green

# Start Menu shortcut
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Print Infinity"
if (-not (Test-Path $startMenu)) {
    New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
}
$startLnk = Join-Path $startMenu "Print Infinity Agent.lnk"
$startShortcut = $wsh.CreateShortcut($startLnk)
$startShortcut.TargetPath = $installedExe
$startShortcut.WorkingDirectory = $targetDir
$startShortcut.IconLocation = "$installedExe,0"
$startShortcut.Description = "Print Infinity Agent"
$startShortcut.Save()
Write-Host "      Start Menu shortcut: $startLnk" -ForegroundColor Green

# Step 5: Launch in interactive mode (NOT minimized to tray, so window is visible immediately)
Write-Host "[5/5] Launching Print Infinity Agent on your screen..." -ForegroundColor White
Start-Process -FilePath $installedExe -WorkingDirectory $targetDir

Start-Sleep -Seconds 2

$running = Get-Process -Name "PrintInfinity.Agent" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "   REINSTALL COMPLETE & AGENT IS NOW RUNNING!            " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Active PID(s): $(($running | ForEach-Object { $_.Id }) -join ', ')" -ForegroundColor Cyan
    Write-Host " Target Path  : $installedExe" -ForegroundColor White
} else {
    Write-Host "[!] Could not detect active process after launch." -ForegroundColor Yellow
}
