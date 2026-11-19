# Read-only WEB Premium verification against gnh_web_staging ONLY.
# No UPDATE/DELETE/INSERT. Password is prompted interactively and never written to disk.
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$root = Split-Path -Parent $here
Set-Location $root

Write-Host '=== GNH WEB Premium READ-ONLY check ==='
Write-Host 'Target DB: gnh_web_staging (TLS verify-full). Production gnh_supabase is refused.'
Write-Host 'Password will not be echoed or saved.'
Write-Host ''

$secure = Read-Host 'Password for gnh_web_migrate' -AsSecureString
if (-not $secure) { throw 'Empty password' }
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) | Out-Null
}
$secure = $null
if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Empty password' }

$env:STAGING_DB_PASSWORD = $plain
$plain = $null
$env:STAGING_DB_USER = 'gnh_web_migrate'

$code = 1
try {
  Push-Location (Join-Path $root 'server')
  node (Join-Path $here 'verify-web-payment-readonly.mjs') 2>&1 | Tee-Object -FilePath (Join-Path $here 'verify-web-payment-run.log')
  $code = $LASTEXITCODE
} finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Item Env:STAGING_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:STAGING_DB_USER -ErrorAction SilentlyContinue
}

Write-Host ''
if ($code -eq 0) {
  Write-Host 'DONE. Report: artifacts\web-payment-verify.json'
} else {
  Write-Host "FAILED exit=$code"
}
Write-Host 'Press Enter to close...'
[void][Console]::ReadLine()
exit $code
