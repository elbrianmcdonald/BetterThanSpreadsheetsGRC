# setup-env.ps1 — populate .env with strong secrets for first-run installation.
#
# Idempotent: existing non-empty values are preserved. Generates only the
# secrets that are missing or blank. Safe to re-run.
#
# Generates: AUTH_SECRET, CRON_SECRET, POSTGRES_PASSWORD.
#
# Usage:
#   .\scripts\setup-env.ps1

$ErrorActionPreference = "Stop"

# Run from repo root so paths resolve.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envFile = ".env"
$exampleFile = ".env.example"

if (-not (Test-Path $exampleFile)) {
  Write-Error "$exampleFile not found. Run this script from the repo root."
  exit 1
}

if (-not (Test-Path $envFile)) {
  Copy-Item $exampleFile $envFile
  Write-Host "Created $envFile from $exampleFile"
}

function New-HexSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
}

function Set-EnvVarIfMissing {
  param([string]$Var)

  $content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
  if ($null -eq $content) { $content = "" }

  # Treat both unset and empty as missing.
  if ($content -match "(?m)^${Var}=\S+") {
    Write-Host "  $Var already set, skipping"
    return
  }

  $value = New-HexSecret

  if ($content -match "(?m)^${Var}=") {
    $newContent = [regex]::Replace(
      $content,
      "(?m)^${Var}=.*",
      "${Var}=${value}"
    )
    # -NoNewline avoids appending an extra blank line on each rewrite.
    Set-Content -Path $envFile -Value $newContent -NoNewline -Encoding utf8
  } else {
    Add-Content -Path $envFile -Value "${Var}=${value}" -Encoding utf8
  }
  Write-Host "  Generated $Var"
}

Write-Host "Populating secrets in ${envFile}:"
Set-EnvVarIfMissing -Var "AUTH_SECRET"
Set-EnvVarIfMissing -Var "CRON_SECRET"
Set-EnvVarIfMissing -Var "POSTGRES_PASSWORD"

Write-Host ""
Write-Host "Setup complete. Review $envFile, then run: docker compose up -d"
