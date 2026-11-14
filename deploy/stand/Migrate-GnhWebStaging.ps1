<#
.SYNOPSIS
  Safe Windows helper to migrate Timeweb database gnh_web_staging (001–015 + grants).

.DESCRIPTION
  Orchestrates existing server npm scripts. Does not reimplement SQL.
  Never prints passwords or full DATABASE_URL / STAGING_DATABASE_URL.
  Default mode is local preflight only (no Timeweb connection).

  Migrate admin must be a cluster admin / DB owner with CREATE on gnh_web_staging
  (Timeweb often: gen_user). Never use gnh_web_stage for DDL. Prefer gen_user over root.

.PARAMETER HostName
  PostgreSQL hostname (e.g. xxx.twc1.net). Required for -CheckConnection / -Apply.

.PARAMETER MigrateUser
  Admin LOGIN for migrations (NOT gnh_web_stage). Example: gen_user

.PARAMETER CaFile
  Absolute path to Timeweb root CA PEM (.crt).

.PARAMETER ServerName
  TLS server name when HostName is an IP. Defaults to HostName.

.PARAMETER CheckConnection
  Connect to gnh_web_staging as migrate user (read-only privilege SELECTs).
  No CREATE/ALTER/GRANT/REVOKE/migrate/seed. Reports missing Timeweb panel rights.
  Never touches gnh_supabase or production roles (gen_user/gnh_app/gamenight_bot rights unchanged).

.PARAMETER Apply
  After confirmation, run npm run migrate:staging (connects to Timeweb).

.PARAMETER Seed
  With -Apply, also run seed_minimal.

.PARAMETER LocalOnly
  Only local tool/build/dry-run checks (default if -Apply / -CheckConnection omitted).

.EXAMPLE
  # Local checks only (no network):
  .\deploy\stand\Migrate-GnhWebStaging.ps1 -LocalOnly -CaFile 'C:\path\to\timeweb-ca.crt'

.EXAMPLE
  # Safe connection + privilege probe (no DDL):
  .\deploy\stand\Migrate-GnhWebStaging.ps1 -CheckConnection -HostName 'xxx.twc1.net' -MigrateUser 'gen_user' -CaFile 'C:\path\to\timeweb-ca.crt'

.EXAMPLE
  # Preflight TLS config then apply after typing YES:
  .\deploy\stand\Migrate-GnhWebStaging.ps1 -Apply -HostName 'xxx.twc1.net' -MigrateUser 'gen_user' -CaFile 'C:\path\to\timeweb-ca.crt'
#>
[CmdletBinding()]
param(
  [string]$HostName = '',
  [string]$MigrateUser = '',
  [string]$CaFile = '',
  [string]$ServerName = '',
  [switch]$CheckConnection,
  [switch]$Apply,
  [switch]$Seed,
  [switch]$LocalOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[gnh-staging] $Message"
}

function Fail([string]$Message) {
  Write-Error "[gnh-staging] $Message"
  exit 1
}

function Assert-NoSecretLeak([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return }
  if ($Text -match 'postgresql://[^:\s]+:[^@\s]+@') {
    Fail 'Refusing to continue: a log line appears to contain credentials.'
  }
}

if ($CheckConnection -and $Apply) {
  Fail 'Use either -CheckConnection or -Apply, not both.'
}
if ($CheckConnection -and $LocalOnly) {
  Fail 'Use either -CheckConnection or -LocalOnly, not both.'
}
if ($Seed -and -not $Apply) {
  Fail '-Seed requires -Apply.'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverRoot = Join-Path $repoRoot 'server'
if (-not (Test-Path -LiteralPath (Join-Path $serverRoot 'package.json'))) {
  Fail "server/package.json not found under $repoRoot"
}

Write-Step "repo=$repoRoot"
Push-Location $repoRoot
try {
  $branch = (git branch --show-current 2>$null)
  if ($branch) { Write-Step "git_branch=$branch" }

  # --- tools ---
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $node) { Fail 'Node.js not found on PATH' }
  if (-not $npm) { Fail 'npm not found on PATH' }
  Write-Step ("node=" + (node -v))
  Write-Step ("npm=" + (npm -v))

  # --- refuse production env bleed ---
  if ($env:DATABASE_URL) {
    Fail 'DATABASE_URL is set in this shell. Clear it (Remove-Item Env:DATABASE_URL) and use only staging params.'
  }
  if ($env:PGSSLMODE -and ($env:PGSSLMODE -match '^(disable|allow|false|0)$')) {
    Fail 'PGSSLMODE disables TLS and is refused.'
  }

  # --- CA ---
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
  if (-not (Test-Path -LiteralPath $CaFile)) { Fail "CA file missing: $CaFile" }
  Write-Step "ca_file_ok path_set=yes length=$((Get-Item -LiteralPath $CaFile).Length)"

  # --- local build + dry-run (always; needed for dist/dbTls.js) ---
  Push-Location $serverRoot
  try {
    Write-Step 'npm run build:api'
    npm run build:api
    if ($LASTEXITCODE -ne 0) { Fail 'build:api failed' }

    Write-Step 'npm run migrate:staging:dry'
    $dryOut = npm run migrate:staging:dry 2>&1 | Out-String
    Assert-NoSecretLeak $dryOut
    Write-Host $dryOut
    if ($LASTEXITCODE -ne 0) { Fail 'migrate:staging:dry failed' }
    if ($dryOut -notmatch 'DRY 015') { Fail 'dry-run missing migration 015' }
    if ($dryOut -notmatch 'DRY grants-stage') { Fail 'dry-run missing grants-stage' }
  } finally {
    Pop-Location
  }

  if ($LocalOnly -and -not $CheckConnection -and -not $Apply) {
    Write-Step 'LOCAL_PREFLIGHT_OK (no Timeweb connection). Re-run with -CheckConnection or -Apply.'
    Write-Step 'Required migrate user: Timeweb admin/owner of gnh_web_staging (prefer gen_user). Never gnh_web_stage.'
    Write-Step 'Post-check SQL: deploy/stand/verify-gnh-web-staging.sql'
    exit 0
  }

  $wantRemote = $CheckConnection -or $Apply -or (-not $LocalOnly -and $HostName -and $MigrateUser)
  if (-not $wantRemote) {
    Write-Step 'LOCAL_PREFLIGHT_OK (no Timeweb connection). Re-run with -CheckConnection -HostName -MigrateUser -CaFile.'
    Write-Step 'Required migrate user: Timeweb admin/owner of gnh_web_staging (prefer gen_user). Never gnh_web_stage.'
    Write-Step 'Post-check SQL: deploy/stand/verify-gnh-web-staging.sql'
    exit 0
  }

  if (-not $HostName) { Fail '-HostName is required for remote check/apply' }
  if (-not $MigrateUser) { Fail '-MigrateUser is required for remote check/apply (example: gen_user)' }
  if ($MigrateUser -eq 'gnh_web_stage') {
    Fail 'gnh_web_stage is the app role and must not run DDL migrations or CheckConnection as migrate admin.'
  }
  if ($MigrateUser -eq 'root') {
    Write-Step 'WARNING: prefer gen_user over root (root password auth previously failed). Continuing as requested.'
  }
  if ($HostName -match 'gnh_supabase' -or $MigrateUser -match 'gnh_supabase') {
    Fail 'Refusing production identifiers in host/user.'
  }

  if (-not $ServerName) { $ServerName = $HostName }

  Write-Step "migrate_user=$MigrateUser"
  Write-Step "expect_host=$HostName"
  Write-Step "tls_servername=$ServerName"
  Write-Step "target_database=gnh_web_staging"
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
  # Always connect to gnh_web_staging — never default "postgres" (Adminer trap).
  $stagingUrl = "postgresql://${encUser}:${encPass}@${HostName}:5432/gnh_web_staging?sslmode=verify-full"
  $encPass = $null

  # Process-scoped env only
  $env:STAGING_DATABASE_URL = $stagingUrl
  $env:STAGING_EXPECT_HOST = $HostName
  $env:STAGING_MIGRATE_USER = $MigrateUser
  $env:DATABASE_TLS_CA_FILE = $CaFile
  $env:DATABASE_TLS_SERVERNAME = $ServerName
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

  try {
    Push-Location $serverRoot
    try {
      if ($CheckConnection) {
        Write-Step 'npm run migrate:staging:check-connection (TLS + privilege SELECTs only; no DDL)'
        $chk = npm run migrate:staging:check-connection 2>&1 | Out-String
        Assert-NoSecretLeak $chk
        Write-Host $chk
        if ($LASTEXITCODE -eq 0 -and $chk -match 'CHECK_CONNECTION_OK') {
          Write-Step 'CHECK_CONNECTION_OK'
          exit 0
        }
        if ($chk -match 'CHECK_CONNECTION_INCOMPLETE') {
          Write-Step 'CHECK_CONNECTION_INCOMPLETE — assign missing privileges on gnh_web_staging only in Timeweb panel.'
          Write-Step 'Do not change permissions on production database gnh_supabase.'
          exit 2
        }
        Fail 'check-connection failed (see output above). Connect to gnh_web_staging as gen_user, not postgres DB / not root.'
      }

      Write-Step 'npm run migrate:staging:preflight (TLS+isolation, no SQL)'
      $pre = npm run migrate:staging:preflight 2>&1 | Out-String
      Assert-NoSecretLeak $pre
      Write-Host $pre
      if ($LASTEXITCODE -ne 0) { Fail 'preflight failed' }
      if ($pre -notmatch 'PREFLIGHT_OK') { Fail 'preflight did not report PREFLIGHT_OK' }

      if (-not $Apply) {
        Write-Step 'Remote preflight OK. Pass -CheckConnection to probe privileges, or -Apply to migrate after confirmation.'
        exit 0
      }

      Write-Host ''
      Write-Host 'About to APPLY migrations 001-015 + grants to database gnh_web_staging only.'
      Write-Host 'This will CONNECT to Timeweb. Production gnh_supabase must not be targeted.'
      $confirm = Read-Host 'Type YES to continue'
      if ($confirm -ne 'YES') {
        Write-Step 'Aborted by operator (confirmation was not YES).'
        exit 2
      }

      if ($Seed) {
        Write-Step 'npm run migrate:staging:seed'
        $out = npm run migrate:staging:seed 2>&1 | Out-String
      } else {
        Write-Step 'npm run migrate:staging'
        $out = npm run migrate:staging 2>&1 | Out-String
      }
      Assert-NoSecretLeak $out
      Write-Host $out
      if ($LASTEXITCODE -ne 0) { Fail 'migrate:staging failed' }
      if ($out -notmatch 'Staging migrations complete') {
        Fail 'migrate finished without success marker'
      }
      Write-Step 'MIGRATE_OK'
      Write-Step 'Run verify SQL manually while connected to gnh_web_staging:'
      Write-Step '  deploy/stand/verify-gnh-web-staging.sql'
    } finally {
      Pop-Location
    }
  } finally {
    Remove-Item Env:STAGING_DATABASE_URL,Env:STAGING_EXPECT_HOST,Env:STAGING_MIGRATE_USER,Env:DATABASE_TLS_CA_FILE,Env:DATABASE_TLS_SERVERNAME -ErrorAction SilentlyContinue
    $stagingUrl = $null
    [GC]::Collect()
  }
} finally {
  Pop-Location
}
