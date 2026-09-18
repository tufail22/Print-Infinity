$target = Join-Path $env:LOCALAPPDATA "Programs\PrintInfinityAgent"
$source = Join-Path $PSScriptRoot "publish\win-x64"

Write-Host "Source: $source"
Write-Host "Target: $target"

if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Path $target -Force | Out-Null
}

# Copy files
$items = Get-ChildItem -Path $source
$lockedCount = 0
foreach ($item in $items) {
    try {
        Copy-Item -Path $item.FullName -Destination (Join-Path $target $item.Name) -Recurse -Force -ErrorAction Stop
    } catch {
        Write-Host "Notice: File locked ($($item.Name)), skipping live rewrite"
        $lockedCount++
    }
}

Write-Host "Sync complete. Locked files skipped: $lockedCount"
