#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only preflight (+ optional gated apply) of migration 024 as gnh_app.

.DESCRIPTION
  -PreflightOnly: ONLY `npm run migrate:production-024:preflight`.
    That Node entry uses a PostgreSQL session with default_transaction_read_only=on
    and never runs CREATE/ALTER/GRANT/INSERT/UPDATE/DELETE.
  Apply path: requires interactive "APPLY" + backup "YES", then the four CONFIRM_*
    env gates expected by the migrator. Never changes DB passwords, roles, or owners.
  Password: Read-Host -AsSecureString; never written to disk/Git; scrubbed in finally.

.NOTES
  Production apply/deploy is operator-driven. Do not pipe passwords into this script.
#>
[CmdletBinding()]
param(
  [string]$HostName = '87c1743b41396e20e77b82cc.twc1.net',
  [string]$Database = 'gnh_supabase',
  [string]$UserName = 'gnh_app',
  [string]$CaFile = '',
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverRoot = Join-Path $repoRoot 'server'

function Find-CaFile([string]$Preferred) {
  if ($Preferred -and (Test-Path -LiteralPath $Preferred)) { return $Preferred }
  $candidates = @(
    $env:DATABASE_TLS_CA_FILE,
    (Join-Path $env:USERPROFILE 'Downloads\ca.crt'),
    (Join-Path $env:USERPROFILE 'Desktop\telegram-card-game\_private_legal_import\timeweb-ca.crt')
  ) | Where-Object { $_ }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  throw 'TLS CA file not found. Set -CaFile or DATABASE_TLS_CA_FILE.'
}

function Clear-SecretEnv {
  foreach ($n in @(
    'PRODUCTION_DATABASE_URL','PRODUCTION_GNH_APP_DATABASE_URL','DATABASE_URL',
    'GNH_ALLOW_PROD_WEB_MIGRATE','CONFIRM_PRODUCTION_WEB_MIGRATE','CONFIRM_PRODUCTION_BACKUP',
    'CONFIRM_PRODUCTION_024_DEVICES','CONFIRM_PRODUCTION_024_DUAL_ROLE'
  )) { Remove-Item "Env:$n" -ErrorAction SilentlyContinue }
}

# Fail closed: never inherit apply confirmations from a parent shell.
Clear-SecretEnv

if ($UserName -ne 'gnh_app') {
  throw "This script is locked to UserName=gnh_app (got '$UserName'). Refusing."
}

$ca = Find-CaFile $CaFile
$env:DATABASE_TLS_CA_FILE = $ca
$env:GNH_EXPECT_HOST = $HostName
$env:PRODUCTION_EXPECT_HOST = $HostName

Write-Host "CA: $ca"
Write-Host "Target: ${UserName}@${HostName}/${Database} (TLS verify-full)"
Write-Host "Mode: $(if ($PreflightOnly) { 'PREFLIGHT_ONLY (read-only)' } else { 'preflight then gated apply' })"
Write-Host "Backup reminder: Timeweb physical backup gnh-prod-db 2026-11-23 21:24 must exist before apply."

$secure = Read-Host "Password for $UserName" -AsSecureString
$bstr = [IntPtr]::Zero
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $encoded = [uri]::EscapeDataString($plain)
  # URL kept only in process env; never Write-Host / never written to a file.
  $env:PRODUCTION_DATABASE_URL = "postgresql://${UserName}:${encoded}@${HostName}:5432/${Database}?sslmode=verify-full"
  $plain = $null
  $encoded = $null

  Push-Location $serverRoot
  try {
    if (-not (Test-Path 'dist\dbTls.js')) {
      Write-Host 'Building API (dbTls)...'
      npm run build:api
      if ($LASTEXITCODE -ne 0) { throw "build:api failed (exit $LASTEXITCODE)" }
    }

    Write-Host ''
    Write-Host '=== PREFLIGHT (read-only; session default_transaction_read_only=on) ==='
    npm run migrate:production-024:preflight
    if ($LASTEXITCODE -ne 0) {
      throw "Preflight/connection failed (exit $LASTEXITCODE). No migration attempted."
    }

    if ($PreflightOnly) {
      Write-Host 'PreflightOnly: stopping. Apply script was not invoked; CONFIRM_* were not set.'
      return
    }

    Write-Host ''
    Write-Host "Type APPLY to run migration 024 as $UserName. Anything else aborts with no writes."
    if ((Read-Host 'Confirm') -cne 'APPLY') {
      Write-Host 'Aborted: apply not confirmed. No migration attempted.'
      return
    }
    if ((Read-Host 'Type YES if Timeweb physical backup 2026-11-23 21:24 is verified') -cne 'YES') {
      Write-Host 'Aborted: backup not confirmed. No migration attempted.'
      return
    }

    # Set gates only after interactive APPLY + backup YES (case-sensitive).
    $env:GNH_ALLOW_PROD_WEB_MIGRATE = '1'
    $env:CONFIRM_PRODUCTION_WEB_MIGRATE = 'YES'
    $env:CONFIRM_PRODUCTION_BACKUP = 'YES'
    $env:CONFIRM_PRODUCTION_024_DEVICES = 'YES'

    Write-Host ''
    Write-Host '=== APPLY 024 ==='
    npm run migrate:production-024
    if ($LASTEXITCODE -ne 0) {
      throw "Apply failed (exit $LASTEXITCODE). Do not run ad-hoc SQL; inspect migrator output."
    }

    Write-Host ''
    Write-Host '=== POST-CHECK (read-only preflight) ==='
    # Drop apply confirmations before post-check so a mistaken second apply cannot run.
    Remove-Item Env:GNH_ALLOW_PROD_WEB_MIGRATE -ErrorAction SilentlyContinue
    Remove-Item Env:CONFIRM_PRODUCTION_WEB_MIGRATE -ErrorAction SilentlyContinue
    Remove-Item Env:CONFIRM_PRODUCTION_BACKUP -ErrorAction SilentlyContinue
    Remove-Item Env:CONFIRM_PRODUCTION_024_DEVICES -ErrorAction SilentlyContinue

    npm run migrate:production-024:preflight
    if ($LASTEXITCODE -ne 0) { throw "Post-check failed (exit $LASTEXITCODE)" }

    Write-Host ''
    Write-Host 'DONE. Keep GNH_WEB_DEVICE_LIMIT_ENABLED=0 on API. No deploy performed by this script.'
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  Clear-SecretEnv
  Remove-Variable plain,encoded,secure,bstr -ErrorAction SilentlyContinue
  Write-Host 'Secrets cleared from process env.'
}