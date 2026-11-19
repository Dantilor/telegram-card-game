<#
.SYNOPSIS
  Prepare local gnh_web_local Postgres for WEB E2E (embedded Postgres by default).

.DESCRIPTION
  Never connects to gnh_supabase or Timeweb. Starts embedded Postgres (no Docker),
  applies local migrations 001–015 + local RLS, seeds synthetic users.

.EXAMPLE
  .\deploy\local\Setup-GnhWebLocal.ps1
#>
[CmdletBinding()]
param(
  [switch]$Stop,
  [switch]$SkipSeed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) { Write-Host "[gnh-local] $Message" }
function Fail([string]$Message) { Write-Error "[gnh-local] $Message"; exit 1 }

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverRoot = Join-Path $repoRoot 'server'
Push-Location $serverRoot
try {
  if ($Stop) {
    Write-Step 'Stopping embedded Postgres'
    node scripts/start-local-embedded-pg.mjs --stop
    exit $LASTEXITCODE
  }

  Write-Step 'Starting embedded Postgres'
  node scripts/start-local-embedded-pg.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'embedded Postgres failed to start' }

  $metaPath = Join-Path $serverRoot '.local-pg\connection.json'
  if (-not (Test-Path -LiteralPath $metaPath)) { Fail 'connection.json missing after start' }
  $meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
  if ($meta.database -ne 'gnh_web_local') { Fail 'Refusing non-local database name in connection.json' }
  if ($meta.host -ne '127.0.0.1') { Fail 'Refusing non-loopback host' }

  $env:LOCAL_DATABASE_URL = [string]$meta.connectionString
  $env:GNH_LOCAL_DATABASE = '1'
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

  Write-Step 'npm run migrate:local:dry'
  npm run migrate:local:dry
  if ($LASTEXITCODE -ne 0) { Fail 'dry-run failed' }

  Write-Step 'npm run migrate:local'
  if ($SkipSeed) {
    npm run migrate:local
  } else {
    npm run migrate:local -- --seed
  }
  if ($LASTEXITCODE -ne 0) { Fail 'migrate:local failed' }

  $envFile = Join-Path $serverRoot '.env.web-local'
  $example = Join-Path $repoRoot 'deploy\local\env.web-local.example'
  $url = [string]$meta.connectionString
  if (Test-Path -LiteralPath $example) {
    $text = Get-Content -LiteralPath $example -Raw
    $text = $text -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$url"
    Set-Content -LiteralPath $envFile -Value $text -Encoding utf8
    Write-Step "Wrote server/.env.web-local (gitignored)"
  }

  $viteLocal = Join-Path $repoRoot '.env.web.local'
  if (-not (Test-Path -LiteralPath $viteLocal)) {
    @(
      '# Local-only (gitignored). Enables WEB login gate «Локальный вход (dev)».'
      'VITE_WEB_DEV_LOGIN=1'
      'VITE_WEB_DEV_LOGIN_SECRET=local-e2e-dev-secret-not-for-prod'
    ) | Set-Content -LiteralPath $viteLocal -Encoding utf8
    Write-Step 'Wrote .env.web.local (gitignored)'
  }

  Write-Step 'LOCAL_OK gnh_web_local ready for npm run dev:web:all / Playwright'
  Write-Step 'Never use this URL against Timeweb or gnh_supabase.'
} finally {
  Remove-Item Env:LOCAL_DATABASE_URL -ErrorAction SilentlyContinue
  Pop-Location
}
