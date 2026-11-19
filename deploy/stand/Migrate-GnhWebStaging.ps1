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
  Staging migrate LOGIN (NOT gnh_web_stage). Example: gnh_web_migrate (or gen_user if that is the staging DB owner).

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
  .\deploy\stand\Migrate-GnhWebStaging.ps1 -CheckConnection -HostName 'xxx.twc1.net' -MigrateUser 'gnh_web_migrate' -CaFile 'C:\path\to\timeweb-ca.crt'

.EXAMPLE
  # Preflight TLS config then apply after typing YES:
  .\deploy\stand\Migrate-GnhWebStaging.ps1 -Apply -HostName 'xxx.twc1.net' -MigrateUser 'gnh_web_migrate' -CaFile 'C:\path\to\timeweb-ca.crt'
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
  Write-Host "[gnh-staging] ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Assert-NoSecretLeak([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return }
  if ($Text -match 'postgresql://[^:\s]+:[^@\s]+@') {
    Fail 'Refusing to continue: a log line appears to contain credentials.'
  }
}

# Capture npm/node stdout+stderr without NativeCommandError under $ErrorActionPreference=Stop.
# Non-zero exit codes must not hide CHECK_CONNECTION_* detail lines.
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
    $text = ($lines -join [Environment]::NewLine)
    return [pscustomobject]@{
      ExitCode = [int]$code
      Text     = $text
    }
  } finally {
    $ErrorActionPreference = $prevEap
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
    $dryResult = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging:dry')
    Assert-NoSecretLeak $dryResult.Text
    Write-Host $dryResult.Text
    if ($dryResult.ExitCode -ne 0) { Fail 'migrate:staging:dry failed' }
    if ($dryResult.Text -notmatch 'DRY 015') { Fail 'dry-run missing migration 015' }
    if ($dryResult.Text -notmatch 'DRY grants-stage') { Fail 'dry-run missing grants-stage' }
  } finally {
    Pop-Location
  }

  if ($LocalOnly -and -not $CheckConnection -and -not $Apply) {
    Write-Step 'LOCAL_PREFLIGHT_OK (no Timeweb connection). Re-run with -CheckConnection or -Apply.'
    Write-Step 'Required migrate user: staging-only owner/admin of gnh_web_staging (prefer gnh_web_migrate). Never gnh_web_stage.'
    Write-Step 'Post-check SQL: deploy/stand/verify-gnh-web-staging.sql'
    exit 0
  }

  $wantRemote = $CheckConnection -or $Apply -or (-not $LocalOnly -and $HostName -and $MigrateUser)
  if (-not $wantRemote) {
    Write-Step 'LOCAL_PREFLIGHT_OK (no Timeweb connection). Re-run with -CheckConnection -HostName -MigrateUser -CaFile.'
    Write-Step 'Required migrate user: staging-only owner/admin of gnh_web_staging (prefer gnh_web_migrate). Never gnh_web_stage.'
    Write-Step 'Post-check SQL: deploy/stand/verify-gnh-web-staging.sql'
    exit 0
  }

  if (-not $HostName) { Fail '-HostName is required for remote check/apply' }
  if (-not $MigrateUser) { Fail '-MigrateUser is required for remote check/apply (example: gnh_web_migrate)' }
  if ($MigrateUser -eq 'gnh_web_stage') {
    Fail 'gnh_web_stage is the app role and must not run DDL migrations or CheckConnection as migrate admin.'
  }
  if ($MigrateUser -eq 'root') {
    Write-Step 'WARNING: prefer gnh_web_migrate (staging-only) over root. Continuing as requested.'
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
        $chkResult = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging:check-connection')
        Assert-NoSecretLeak $chkResult.Text
        Write-Host $chkResult.Text
        if ($chkResult.ExitCode -eq 0 -and $chkResult.Text -match 'CHECK_CONNECTION_OK') {
          Write-Step 'CHECK_CONNECTION_OK'
          exit 0
        }
        if ($chkResult.Text -match 'CHECK_CONNECTION_INCOMPLETE') {
          Write-Step 'CHECK_CONNECTION_INCOMPLETE — see privilege lines and missing list above.'
          Write-Step 'Assign missing privileges on gnh_web_staging only in Timeweb panel.'
          Write-Step 'Do not change permissions on production database gnh_supabase.'
          Write-Step 'Missing CREATEROLE alone does not block GRANT on objects created by the migrate role.'
          exit 2
        }
        Fail 'check-connection failed (see full output above). Connect to gnh_web_staging as gnh_web_migrate (or staging DB owner), not postgres DB / not root / not gnh_web_stage.'
      }

      Write-Step 'npm run migrate:staging:preflight (TLS+isolation, no SQL)'
      $preResult = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging:preflight')
      Assert-NoSecretLeak $preResult.Text
      Write-Host $preResult.Text
      if ($preResult.ExitCode -ne 0) { Fail 'preflight failed' }
      if ($preResult.Text -notmatch 'PREFLIGHT_OK') { Fail 'preflight did not report PREFLIGHT_OK' }

      if (-not $Apply) {
        Write-Step 'Remote preflight OK. Pass -CheckConnection to probe privileges, or -Apply to migrate after confirmation.'
        exit 0
      }

      Write-Step 'Final read-only check-connection before Apply (no DDL)'
      $finalChk = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging:check-connection')
      Assert-NoSecretLeak $finalChk.Text
      Write-Host $finalChk.Text
      if ($finalChk.ExitCode -ne 0 -or $finalChk.Text -notmatch 'CHECK_CONNECTION_OK') {
        if ($finalChk.Text -match 'CHECK_CONNECTION_INCOMPLETE') {
          Write-Step 'CHECK_CONNECTION_INCOMPLETE — fix gnh_web_staging-only rights above, then re-run -Apply. No migration was executed.'
          exit 2
        }
        Fail 'Final check-connection failed; refusing Apply (no migration executed).'
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
        $migResult = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging:seed')
      } else {
        Write-Step 'npm run migrate:staging'
        $migResult = Invoke-NpmCaptured -NpmArguments @('run', 'migrate:staging')
      }
      Assert-NoSecretLeak $migResult.Text
      Write-Host $migResult.Text
      if ($migResult.ExitCode -ne 0) { Fail 'migrate:staging failed' }
      if ($migResult.Text -notmatch 'Staging migrations complete') {
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
