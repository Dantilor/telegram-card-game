<#
.SYNOPSIS
  Read-only PASS/FAIL verification of Timeweb database gnh_web_staging.

.DESCRIPTION
  Connects as migrate LOGIN with TLS verify-full + Timeweb CA.
  Runs server/scripts/verify-staging.mjs (SELECT / privilege / catalog only).
  Checklist source: deploy/stand/verify-gnh-web-staging.sql

  Never migrates, never GRANT/REVOKE/ALTER ROLE, never touches gnh_supabase data,
  never deploys.

.PARAMETER HostName
  PostgreSQL hostname (e.g. xxx.twc1.net).

.PARAMETER MigrateUser
  Staging migrate LOGIN (default gnh_web_migrate). Not gnh_web_stage.

.PARAMETER CaFile
  Absolute path to Timeweb root CA PEM (.crt).

.PARAMETER ServerName
  TLS server name when HostName is an IP. Defaults to HostName.

.EXAMPLE
  .\deploy\stand\Verify-GnhWebStaging.ps1 `
    -HostName 'xxx.twc1.net' `
    -MigrateUser 'gnh_web_migrate' `
    -CaFile 'C:\path\to\timeweb-ca.crt'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$HostName,
  [string]$MigrateUser = 'gnh_web_migrate',
  [string]$CaFile = '',
  [string]$ServerName = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[gnh-verify] $Message"
}

function Fail([string]$Message) {
  Write-Host "[gnh-verify] ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Assert-NoSecretLeak([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return }
  if ($Text -match 'postgresql://[^:\s]+:[^@\s]+@') {
    Fail 'Refusing to continue: a log line appears to contain credentials.'
  }
}

function Invoke-NpmCaptured {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$NpmArguments
  )
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $raw = & npm @NpmArguments 2>&1
    $code = $LASTEXITCODE
    $lines = foreach ($item in @($raw)) {
      if ($null -eq $item) { continue }
      if ($item -is [System.Management.Automation.ErrorRecord]) {
        [string]$item.Exception.Message
      } else {
        [string]$item
      }
    }
    return [pscustomobject]@{
      ExitCode = [int]$code
      Text     = ($lines -join [Environment]::NewLine)
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverRoot = Join-Path $repoRoot 'server'
$sqlPath = Join-Path $repoRoot 'deploy\stand\verify-gnh-web-staging.sql'

if (-not (Test-Path -LiteralPath (Join-Path $serverRoot 'package.json'))) {
  Fail "server/package.json not found under $repoRoot"
}
if (-not (Test-Path -LiteralPath $sqlPath)) {
  Fail "Missing verify SQL: $sqlPath"
}

Write-Step "repo=$repoRoot"
Write-Step 'mode=read-only (no migrate, no grants, no seed, no deploy)'

if ($env:DATABASE_URL) {
  Fail 'DATABASE_URL is set in this shell. Clear it (Remove-Item Env:DATABASE_URL) and use only staging params.'
}
if ($env:PGSSLMODE -and ($env:PGSSLMODE -match '^(disable|allow|false|0)$')) {
  Fail 'PGSSLMODE disables TLS and is refused.'
}
if ($MigrateUser -eq 'gnh_web_stage') {
  Fail 'gnh_web_stage is the app role — verify as gnh_web_migrate.'
}
if ($HostName -match 'gnh_supabase' -or $MigrateUser -match 'gnh_supabase') {
  Fail 'Refusing production identifiers in host/user.'
}

if (-not $CaFile) {
  $candidates = @(
    (Join-Path $env:USERPROFILE 'Desktop\telegram-card-game\_private_legal_import\timeweb-ca.crt'),
    (Join-Path $repoRoot '_private_legal_import\timeweb-ca.crt')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { $CaFile = $c; break }
  }
}
if (-not $CaFile) {
  Fail 'Timeweb CA file not found. Pass -CaFile with absolute path to timeweb-ca.crt'
}
$CaFile = (Resolve-Path -LiteralPath $CaFile).Path
Write-Step "ca_file_ok length=$((Get-Item -LiteralPath $CaFile).Length)"

if (-not $ServerName) { $ServerName = $HostName }

Write-Step "migrate_user=$MigrateUser"
Write-Step "expect_host=$HostName"
Write-Step "tls_servername=$ServerName"
Write-Step 'target_database=gnh_web_staging'
Write-Step 'Enter migrate admin password (not echoed, not saved):'
$secure = Read-Host -AsSecureString
if (-not $secure) { Fail 'Password is required' }

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) | Out-Null
}
if ([string]::IsNullOrWhiteSpace($plain)) { Fail 'Password is empty' }

$encUser = [Uri]::EscapeDataString($MigrateUser)
$encPass = [Uri]::EscapeDataString($plain)
$plain = $null
$stagingUrl = "postgresql://${encUser}:${encPass}@${HostName}:5432/gnh_web_staging?sslmode=verify-full"
$encPass = $null

$env:STAGING_DATABASE_URL = $stagingUrl
$env:STAGING_EXPECT_HOST = $HostName
$env:STAGING_MIGRATE_USER = $MigrateUser
$env:DATABASE_TLS_CA_FILE = $CaFile
$env:DATABASE_TLS_SERVERNAME = $ServerName
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

try {
  Push-Location $serverRoot
  try {
    Write-Step 'npm run build:api (need dist/dbTls.js)'
    $build = Invoke-NpmCaptured -NpmArguments @('run', 'build:api')
    Assert-NoSecretLeak $build.Text
    if ($build.ExitCode -ne 0) {
      Write-Host $build.Text
      Fail 'build:api failed'
    }

    Write-Step 'npm run verify:staging (read-only)'
    $verify = Invoke-NpmCaptured -NpmArguments @('run', 'verify:staging')
    Assert-NoSecretLeak $verify.Text
    Write-Host $verify.Text

    if ($verify.ExitCode -eq 0 -and $verify.Text -match 'VERIFY_PASS') {
      Write-Step 'VERIFY_PASS'
      exit 0
    }
    if ($verify.Text -match 'VERIFY_FAIL') {
      Write-Step 'VERIFY_FAIL — see FAIL items above. No SQL changes were made.'
      exit 2
    }
    Fail 'verify:staging failed (see full output above).'
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:STAGING_DATABASE_URL,Env:STAGING_EXPECT_HOST,Env:STAGING_MIGRATE_USER,Env:DATABASE_TLS_CA_FILE,Env:DATABASE_TLS_SERVERNAME -ErrorAction SilentlyContinue
  $stagingUrl = $null
  [GC]::Collect()
}
