# Legal import to gnh_web_staging as gnh_web_migrate. Password never printed.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$gnhDbHost = '87c1743b41396e20e77b82cc.twc1.net'
$gnhDbPort = '5432'
$gnhDbUser = 'gnh_web_migrate'
$gnhDbName = 'gnh_web_staging'
$gnhVersion = '2026-10-20.1'
$gnhCoreIds = @('privacy', 'agreement', 'offer')
$gnhExpectedSha = @{
  privacy   = 'd8abc88f68855a115c61a3a5edba51c7d144f55db6895349d7085ea7333699a8'
  agreement = 'ab8df0cab04e3691912b7c92889d8c55fe37b8f65d059db565470339dbb9369d'
  offer     = '03d988053e96d7d31fbf0c7072e0c4bc8fb3b9912a60b2787b9cca3782490bca'
}
$gnhRoot = 'C:\Users\User\Desktop\telegram-card-game-2'
$gnhServer = Join-Path $gnhRoot 'server'
$gnhManifest = 'C:\Users\User\Desktop\telegram-card-game\_private_legal_import\documents.json'
$gnhCaPath = 'C:\Users\User\Desktop\telegram-card-game\_private_legal_import\timeweb-ca.crt'
$gnhLog = Join-Path $gnhRoot 'artifacts\legal-staging-import-migrate.log'
$gnhTsx = Join-Path $gnhServer 'node_modules\tsx\dist\cli.mjs'
$gnhBackupDir = Join-Path $gnhRoot 'artifacts\backups'
$gnhStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$gnhBackup = Join-Path $gnhBackupDir "gnh_web_staging-pre-legal-$gnhStamp.dump"
$gnhExistingBackup = 'C:\backups\gnh_web_staging-pre019-20261116-165501.dump'
$gnhPgDump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
$gnhPgRestore = 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe'

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -LiteralPath $gnhLog -Value $line -Encoding utf8
  Write-Host $msg
}

function Redact([AllowNull()][string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return '' }
  return [regex]::Replace($text, 'postgres(?:ql)?://\S+', '[redacted-database-url]')
}

function QuoteArg([string]$text) {
  if ($text -notmatch '[\s"]') { return $text }
  return '"' + ($text -replace '"', '\"') + '"'
}

function Make-Url([string]$password) {
  return 'postgresql://' + [Uri]::EscapeDataString($gnhDbUser) + ':' + [Uri]::EscapeDataString($password) + '@' + $gnhDbHost + ':' + $gnhDbPort + '/' + $gnhDbName + '?sslmode=verify-full'
}

function Start-Node([string[]]$ArgumentList, [AllowNull()][string]$DatabaseUrl) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'node'
  $psi.WorkingDirectory = $gnhServer
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.Arguments = (($ArgumentList | ForEach-Object { QuoteArg $_ }) -join ' ')
  if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    if ($psi.EnvironmentVariables.ContainsKey('DATABASE_URL')) {
      [void]$psi.EnvironmentVariables.Remove('DATABASE_URL')
    }
  } else {
    $psi.EnvironmentVariables['DATABASE_URL'] = $DatabaseUrl
  }
  $psi.EnvironmentVariables['DATABASE_TLS_CA_FILE'] = $gnhCaPath
  $psi.EnvironmentVariables['DATABASE_TLS_SERVERNAME'] = $gnhDbHost
  $psi.EnvironmentVariables['GNH_EXPECT_DATABASE'] = $gnhDbName
  $psi.EnvironmentVariables['GNH_EXPECT_USER'] = $gnhDbUser
  $psi.EnvironmentVariables['GNH_EXPECT_HOST'] = $gnhDbHost
  foreach ($name in @('DATABASE_TLS_CA_PEM', 'PGPASSWORD', 'PGSSLMODE', 'PGSSLROOTCERT', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_EXTRA_CA_CERTS')) {
    if ($psi.EnvironmentVariables.ContainsKey($name)) { [void]$psi.EnvironmentVariables.Remove($name) }
  }
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $outTask = $proc.StandardOutput.ReadToEndAsync()
  $errTask = $proc.StandardError.ReadToEndAsync()
  [void]$proc.WaitForExit()
  return @{
    Code = $proc.ExitCode
    Output = $outTask.GetAwaiter().GetResult()
    Error = $errTask.GetAwaiter().GetResult()
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path $gnhLog) | Out-Null
New-Item -ItemType Directory -Force -Path $gnhBackupDir | Out-Null
Set-Content -LiteralPath $gnhLog -Value "legal staging import (gnh_web_migrate) start $(Get-Date -Format o)" -Encoding utf8

if (-not (Test-Path -LiteralPath $gnhManifest)) { throw "Missing package: $gnhManifest" }
if (-not (Test-Path -LiteralPath $gnhCaPath)) { throw "Missing CA: $gnhCaPath" }
if (-not (Test-Path -LiteralPath $gnhTsx)) { throw "Missing tsx: $gnhTsx" }
if (-not (Test-Path -LiteralPath $gnhPgDump)) { throw "Missing pg_dump: $gnhPgDump" }
if (-not (Test-Path -LiteralPath $gnhPgRestore)) { throw "Missing pg_restore: $gnhPgRestore" }
if (-not (Test-Path -LiteralPath $gnhExistingBackup)) { throw "Existing backup missing: $gnhExistingBackup" }
$existingList = & $gnhPgRestore --list $gnhExistingBackup 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $existingList.Length -lt 50) { throw 'Existing backup failed pg_restore --list' }
Write-Log "existing_backup_ok path=$gnhExistingBackup bytes=$((Get-Item $gnhExistingBackup).Length) list_chars=$($existingList.Length)"

$statusTs = @'
import pg from 'pg'
import { resolvePgPoolConfig } from './src/dbTls.js'

const resolved = resolvePgPoolConfig(process.env)
const client = new pg.Client({
  connectionString: resolved.connectionString,
  ssl: resolved.ssl,
  connectionTimeoutMillis: 60000,
  keepAlive: true,
})
await client.connect()
const id = await client.query(`SELECT current_database() AS db, current_user AS usr,
  (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl,
  (SELECT version FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls`)
const row = id.rows[0]
console.log(`current_database: ${row.db}`)
console.log(`current_user: ${row.usr}`)
console.log(`ssl: ${row.ssl}`)
console.log(`tls_version: ${row.tls}`)
if (row.db !== 'gnh_web_staging') throw new Error(`refusing database ${row.db}`)
if (row.db === 'gnh_supabase') throw new Error('refusing gnh_supabase')
if (row.usr !== 'gnh_web_migrate') throw new Error(`refusing user ${row.usr}`)
if (!row.ssl) throw new Error('TLS required')

const versions = await client.query(`
  SELECT document_id, version, sha256
  FROM legal_document_versions
  WHERE document_id = ANY($1::text[])
  ORDER BY document_id, version
`, [['privacy','agreement','offer']])
if (versions.rows.length === 0) console.log('versions: none')
for (const v of versions.rows) console.log(`version ${v.document_id} ${v.version} sha256=${v.sha256}`)

const acts = await client.query(`
  SELECT document_id, version, sha256, (deactivated_at IS NULL) AS active
  FROM legal_document_activations
  WHERE document_id = ANY($1::text[])
  ORDER BY document_id, (deactivated_at IS NULL) DESC, activated_at DESC NULLS LAST
`, [['privacy','agreement','offer']])
if (acts.rows.length === 0) console.log('activations: none')
for (const a of acts.rows) console.log(`activation ${a.document_id} version=${a.version} active=${a.active} sha256=${a.sha256}`)
await client.end()
'@
$statusPath = Join-Path $gnhServer '_tmp_legal_status_migrate.ts'
Set-Content -LiteralPath $statusPath -Value $statusTs -Encoding utf8

Write-Host ""
Write-Host "Цель: $gnhDbHost / $gnhDbName / $gnhDbUser (TLS verify-full)"
Write-Host "Пакет: $gnhManifest"
Write-Host "Активация: $($gnhCoreIds -join ',')"
Write-Host "Backup: $gnhBackup"
Write-Host ""

$secure = $null
$bstr = [IntPtr]::Zero
$password = $null
$url = $null
try {
  try {
    $secure = Read-Host -AsSecureString -Prompt 'Пароль gnh_web_migrate для gnh_web_staging (ввод не отображается)'
  } catch {
    throw 'Пароль не получен. Подключение не выполнялось.'
  }
  if ($null -eq $secure -or $secure.Length -eq 0) {
    throw 'Пустой пароль. Подключение не выполнялось.'
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $url = Make-Url $password

  Write-Log '=== TLS + identity preflight (read-only) ==='
  $pre = Start-Node -ArgumentList @($gnhTsx, $statusPath) -DatabaseUrl $url
  Write-Log (Redact $pre.Output)
  if ($pre.Error) { Write-Log (Redact $pre.Error) }
  if ($pre.Code -ne 0) { throw "Preflight failed code $($pre.Code) - stop after one attempt" }
  $preText = Redact $pre.Output
  if (
    $preText -notmatch 'current_database: gnh_web_staging' -or
    $preText -notmatch 'current_user: gnh_web_migrate' -or
    $preText -notmatch 'ssl: true' -or
    $preText -notmatch 'tls_version: TLSv1\.[23]'
  ) {
    throw 'Preflight не подтвердил gnh_web_staging / gnh_web_migrate / TLS.'
  }
  if ($preText -match 'gnh_supabase') { throw 'Refusing any contact with gnh_supabase' }
  Write-Log 'TLS OK'

  $alreadyActive = $true
  foreach ($id in $gnhCoreIds) {
    $sha = $gnhExpectedSha[$id]
    $line = ($pre.Output -split "`r?`n" | Where-Object { $_ -match "^activation $id version=$([regex]::Escape($gnhVersion)) active=true sha256=$sha$" } | Select-Object -First 1)
    if (-not $line) { $alreadyActive = $false }
  }

  if ($alreadyActive) {
    Write-Log 'Core docs already active with matching SHA — skip backup/import/activate'
    Write-Log 'DONE_ALREADY_ACTIVE'
    Write-Host ""
    Write-Host "Документы уже активны. Лог: $gnhLog"
    Write-Host "Нажмите Enter, чтобы закрыть окно."
    [void][Console]::ReadLine()
    return
  }

  # Fresh dump once; if it fails, keep using the already-verified existing backup.
  Write-Log '=== Backup pg_dump -Fc (one attempt; existing backup already verified) ==='
  $caFull = (Resolve-Path -LiteralPath $gnhCaPath).ProviderPath
  $backupFull = $gnhBackup
  $env:PGPASSWORD = $password
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $caFull
  $env:PGCONNECT_TIMEOUT = '60'
  try {
    $dumpErr = Join-Path $gnhBackupDir "pg_dump-err-$gnhStamp.txt"
    $dumpOut = Join-Path $gnhBackupDir "pg_dump-out-$gnhStamp.txt"
    $argLine = '-h "' + $gnhDbHost + '" -p ' + $gnhDbPort + ' -U "' + $gnhDbUser + '" -d "' + $gnhDbName + '" -Fc -f "' + $backupFull + '" --no-password'
    $p = Start-Process -FilePath $gnhPgDump -ArgumentList $argLine -NoNewWindow -Wait -PassThru -RedirectStandardError $dumpErr -RedirectStandardOutput $dumpOut
    if (Test-Path -LiteralPath $dumpErr) {
      Write-Log ('pg_dump stderr: ' + (Redact (Get-Content -LiteralPath $dumpErr -Raw)).Trim())
    }
    if ($p.ExitCode -eq 0 -and (Test-Path -LiteralPath $backupFull) -and ((Get-Item $backupFull).Length -gt 100)) {
      $listOut = & $gnhPgRestore --list $backupFull 2>&1 | Out-String
      if ($LASTEXITCODE -ne 0 -or $listOut.Length -lt 50) { throw 'fresh backup failed pg_restore --list' }
      Write-Log "fresh_backup_ok bytes=$((Get-Item $backupFull).Length) path=$backupFull"
    } else {
      Write-Log "fresh pg_dump skipped/failed once; continuing with verified existing backup $gnhExistingBackup"
    }
  }
  finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
    Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
  }

  Write-Log '=== Import --write ==='
  $imp = Start-Node -ArgumentList @($gnhTsx, 'src/legal/cli.ts', 'import', '--file', $gnhManifest, '--write') -DatabaseUrl $url
  Write-Log (Redact $imp.Output)
  if ($imp.Error) { Write-Log (Redact $imp.Error) }
  if ($imp.Code -ne 0) { throw "Import failed code $($imp.Code)" }
  if ((Redact $imp.Output) -notmatch 'mode: write') { throw 'Import did not confirm write mode' }

  Write-Log '=== Activate privacy,agreement,offer --write ==='
  $act = Start-Node -ArgumentList @($gnhTsx, 'src/legal/cli.ts', 'activate', '--file', $gnhManifest, '--documents', ($gnhCoreIds -join ','), '--write') -DatabaseUrl $url
  Write-Log (Redact $act.Output)
  if ($act.Error) { Write-Log (Redact $act.Error) }
  if ($act.Code -ne 0) { throw "Activate failed code $($act.Code)" }

  Write-Log '=== Verify activations in DB ==='
  $final = Start-Node -ArgumentList @($gnhTsx, $statusPath) -DatabaseUrl $url
  Write-Log (Redact $final.Output)
  if ($final.Error) { Write-Log (Redact $final.Error) }
  if ($final.Code -ne 0) { throw "Final verify failed code $($final.Code)" }
  foreach ($id in $gnhCoreIds) {
    $sha = $gnhExpectedSha[$id]
    $line = ($final.Output -split "`r?`n" | Where-Object { $_ -match "^activation $id version=$([regex]::Escape($gnhVersion)) active=true sha256=$sha$" } | Select-Object -First 1)
    if (-not $line) { throw "Activation missing or mismatched for $id" }
  }

  Write-Log 'DONE'
  Write-Host ""
  Write-Host "Готово. Лог: $gnhLog"
  Write-Host "Backup: $gnhBackup"
  Write-Host "Нажмите Enter, чтобы закрыть окно."
  [void][Console]::ReadLine()
}
catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  Write-Host ""
  Write-Host "Ошибка. Лог: $gnhLog"
  Write-Host "Нажмите Enter, чтобы закрыть окно."
  [void][Console]::ReadLine()
  exit 1
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $bstr = [IntPtr]::Zero
  }
  if ($secure) { $secure.Dispose() }
  $secure = $null
  $password = $null
  $url = $null
  [GC]::Collect()
}
