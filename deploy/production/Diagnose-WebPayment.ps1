#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only diagnosis of one WEB YooKassa payment on production as gnh_app.

.DESCRIPTION
  Runs server/scripts/diagnose-web-payment.mjs in a read-only PostgreSQL session
  (default_transaction_read_only=on + BEGIN READ ONLY). Prints only masked identifiers.
  Password: Read-Host -AsSecureString; never written to disk/Git; scrubbed in finally.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PaymentId,
  [string]$HostName = '87c1743b41396e20e77b82cc.twc1.net',
  [string]$Database = 'gnh_supabase',
  [string]$UserName = 'gnh_app',
  [string]$CaFile = ''
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

$ca = Find-CaFile $CaFile
$env:DATABASE_TLS_CA_FILE = $ca
$env:PRODUCTION_EXPECT_HOST = $HostName
Write-Host "Target: ${UserName}@${HostName}/${Database} (TLS verify-full, READ ONLY)"

$secure = Read-Host "Password for $UserName" -AsSecureString
$bstr = [IntPtr]::Zero
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $encoded = [uri]::EscapeDataString($plain)
  $env:PRODUCTION_DATABASE_URL = "postgresql://${UserName}:${encoded}@${HostName}:5432/${Database}?sslmode=verify-full"
  $plain = $null
  $encoded = $null

  Push-Location $serverRoot
  try {
    if (-not (Test-Path 'dist\dbTls.js')) {
      npm run build:api
      if ($LASTEXITCODE -ne 0) { throw "build:api failed (exit $LASTEXITCODE)" }
    }
    node scripts/diagnose-web-payment.mjs --payment-id $PaymentId
    if ($LASTEXITCODE -ne 0) { throw "Diagnosis failed (exit $LASTEXITCODE). Nothing was written." }
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  Remove-Item Env:PRODUCTION_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Variable plain,encoded,secure,bstr -ErrorAction SilentlyContinue
  Write-Host 'Secrets cleared from process env.'
}