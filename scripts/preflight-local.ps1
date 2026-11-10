# Read-only local preflight. Does not import images, deploy, or approve rights.
# Usage:
#   powershell -NoProfile -File .\scripts\preflight-local.ps1
#   powershell -NoProfile -File .\scripts\preflight-local.ps1 -VirgoStarsAssets "..\virgo-stars\public\assets"
param(
    [string]$VirgoStarsAssets = ""
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & node.exe --version
    if ($LASTEXITCODE -ne 0) { throw "Node.js not available." }

    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests did not pass." }

    & npm.cmd run audit:catalog
    if ($LASTEXITCODE -ne 0) { throw "Candidate catalog audit did not pass." }

    $manifest = Join-Path $root "manifests\approved-assets.json"
    $assets = Join-Path $root "public\assets"

    if (Test-Path -LiteralPath $manifest -PathType Leaf) {
        & node.exe "scripts/verify-pack.mjs" --root $assets --manifest $manifest
        if ($LASTEXITCODE -ne 0) { throw "Approved asset pack verification failed." }

        if ($VirgoStarsAssets -and (Test-Path -LiteralPath $VirgoStarsAssets -PathType Container)) {
            & node.exe "scripts/check-web-asset-collisions.mjs" --legacy $VirgoStarsAssets --pack $assets --manifest $manifest
            $status = $LASTEXITCODE
            if ($status -eq 3) {
                Write-Warning "Matching files still exist in VirgoStars. Exclude the legacy copies in a separately tested future web build."
            } elseif ($status -ne 0) {
                throw "Web asset collision check blocked migration (exit $status)."
            }
        } else {
            Write-Host "Upstream comparison skipped: no valid -VirgoStarsAssets path supplied."
        }
    } else {
        Write-Host "Approved assets manifest absent, as expected before rights review and binary import."
    }
    Write-Host "Read-only local preflight completed. No production integration was tested."
} finally {
    Pop-Location
}
