# Interactive legal import for gnh_web_staging only. Password stays in this process.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$gnhDbHost = '87c1743b41396e20e77b82cc.twc1.net'
$gnhDbPort = '5432'
$gnhDbUser = 'gen_user'
$gnhDbName = 'gnh_web_staging'
$gnhBootstrapDb = 'default_db'
$gnhVersion = '2026-10-20.1'
$gnhCoreIds = @('privacy', 'agreement', 'offer')
$gnhRoot = 'C:\Users\User\Desktop\telegram-card-game-2'
$gnhServer = Join-Path $gnhRoot 'server'
$gnhManifest = 'C:\Users\User\Desktop\telegram-card-game\_private_legal_import\documents.json'
$gnhCaPath = 'C:\Users\User\Desktop\telegram-card-game\_private_legal_import\timeweb-ca.crt'
$gnhLog = Join-Path $gnhRoot 'artifacts\legal-staging-import.log'
$gnhTsx = Join-Path $gnhServer 'node_modules\tsx\dist\cli.mjs'
$gnhStatusPath = Join-Path $gnhServer '_tmp_legal_status.ts'
$gnhProbePath = Join-Path $gnhServer '_tmp_legal_probe.ts'
$gnhGrantPath = Join-Path $gnhServer '_tmp_legal_grant.ts'

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

function Make-Url([string]$database, [string]$password) {
  return 'postgresql://' + [Uri]::EscapeDataString($gnhDbUser) + ':' + [Uri]::EscapeDataString($password) + '@' + $gnhDbHost + ':' + $gnhDbPort + '/' + $database + '?sslmode=verify-full'
}

function Start-Node([string[]]$ArgumentList, [AllowNull()][string]$DatabaseUrl, [string]$ExpectDatabase) {
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
  $psi.EnvironmentVariables['GNH_EXPECT_DATABASE'] = $ExpectDatabase
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
Set-Content -LiteralPath $gnhLog -Value "legal staging import start $(Get-Date -Format o)" -Encoding utf8

if (-not (Test-Path -LiteralPath $gnhManifest)) { throw "Missing package: $gnhManifest" }
if (-not (Test-Path -LiteralPath $gnhCaPath)) { throw "Missing CA: $gnhCaPath" }
if (-not (Test-Path -LiteralPath $gnhTsx)) { throw "Missing tsx: $gnhTsx" }

if (-not (Test-Path -LiteralPath $gnhProbePath)) { throw "Missing probe helper: $gnhProbePath" }
if (-not (Test-Path -LiteralPath $gnhGrantPath)) { throw "Missing grant helper: $gnhGrantPath" }
if (-not (Test-Path -LiteralPath $gnhStatusPath)) { throw "Missing status helper: $gnhStatusPath" }

Write-Host ""
Write-Host "Цель: $gnhDbHost / $gnhDbName / $gnhDbUser (TLS verify-full)"
Write-Host "Пакет: $gnhManifest"
Write-Host "Активация: $($gnhCoreIds -join ',')"
Write-Host ""

$secure = $null
$bstr = [IntPtr]::Zero
$password = $null
$url = $null
$bootstrapUrl = $null
try {
  try {
    $secure = Read-Host -AsSecureString -Prompt 'Пароль gen_user (ввод не отображается)'
  } catch {
    throw 'Пароль не получен. Подключение не выполнялось.'
  }
  if ($null -eq $secure -or $secure.Length -eq 0) {
    throw 'Пустой пароль. Подключение не выполнялось.'
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $url = Make-Url $gnhDbName $password
  $bootstrapUrl = Make-Url $gnhBootstrapDb $password

  Write-Log '=== Direct connect attempt to gnh_web_staging ==='
  $direct = Start-Node -ArgumentList @($gnhTsx, $gnhProbePath) -DatabaseUrl $url -ExpectDatabase $gnhDbName
  Write-Log (Redact $direct.Output)
  if ($direct.Error) { Write-Log (Redact $direct.Error) }
  $directText = Redact ("$($direct.Output)`n$($direct.Error)")
  $needGrant = $false
  if ($direct.Code -ne 0 -and $directText -match 'permission denied for database') {
    Write-Log 'gnh_web_staging CONNECT denied — probe default_db and GRANT'
    $needGrant = $true
  } elseif ($direct.Code -ne 0) {
    Write-Log 'Direct staging connect failed — try default_db probe then retry'
    $needGrant = $true
  }

  if ($needGrant) {
    Write-Log '=== Probe via default_db (TLS + privileges) ==='
    $probe = Start-Node -ArgumentList @($gnhTsx, $gnhProbePath) -DatabaseUrl $bootstrapUrl -ExpectDatabase $gnhBootstrapDb
    Write-Log (Redact $probe.Output)
    if ($probe.Error) { Write-Log (Redact $probe.Error) }
    if ($probe.Code -ne 0) { throw "Probe failed code $($probe.Code)" }
    $probeText = Redact $probe.Output
    if (
      $probeText -notmatch 'current_database: default_db' -or
      $probeText -notmatch 'current_user: gen_user' -or
      $probeText -notmatch 'ssl: true' -or
      $probeText -notmatch 'tls_version: TLSv1\.[23]'
    ) {
      throw 'Probe не подтвердил default_db / gen_user / TLS.'
    }
    if ($probeText -notmatch 'db gnh_web_staging') {
      throw 'База gnh_web_staging не найдена в кластере.'
    }
    if ($probeText -match 'db gnh_web_staging owner=\S+ can_connect=false' -or $directText -match 'permission denied for database') {
      Write-Log 'CONNECT missing — granting CONNECT on gnh_web_staging to gen_user'
      $grant = Start-Node -ArgumentList @($gnhTsx, $gnhGrantPath) -DatabaseUrl $bootstrapUrl -ExpectDatabase $gnhBootstrapDb
      Write-Log (Redact $grant.Output)
      if ($grant.Error) { Write-Log (Redact $grant.Error) }
      if ($grant.Code -ne 0) { throw "GRANT CONNECT failed code $($grant.Code)" }
    }
  }

  Write-Log '=== TLS / identity preflight on gnh_web_staging ==='
  $pre = Start-Node -ArgumentList @($gnhTsx, 'src/legal/documentCheck.ts', 'preflight') -DatabaseUrl $url -ExpectDatabase $gnhDbName
  Write-Log (Redact $pre.Output)
  if ($pre.Error) { Write-Log (Redact $pre.Error) }
  if ($pre.Code -ne 0) { throw "Preflight failed code $($pre.Code)" }
  $preText = Redact $pre.Output
  if (
    $preText -notmatch 'current_database: gnh_web_staging' -or
    $preText -notmatch 'current_user: gen_user' -or
    $preText -notmatch 'ssl: true' -or
    $preText -notmatch 'tls_version: TLSv1\.[23]'
  ) {
    throw 'Подключение не подтвердило gnh_web_staging / gen_user / TLS.'
  }
  Write-Log 'TLS OK: gnh_web_staging as gen_user'

  Write-Log '=== Check active core docs ==='
  $status = Start-Node -ArgumentList @($gnhTsx, $gnhStatusPath) -DatabaseUrl $url -ExpectDatabase $gnhDbName
  Write-Log (Redact $status.Output)
  if ($status.Error) { Write-Log (Redact $status.Error) }

  $needImport = $true
  $activeOk = $true
  foreach ($id in $gnhCoreIds) {
    $line = ($status.Output -split "`r?`n" | Where-Object { $_ -match "^$id version=$([regex]::Escape($gnhVersion)) active=true" } | Select-Object -First 1)
    if (-not $line) { $activeOk = $false }
  }
  if ($activeOk -and $status.Code -eq 0) {
    Write-Log 'Core versions already active — skip import/activate.'
    $needImport = $false
  }

  if ($needImport) {
    Write-Log '=== Import --write ==='
    $imp = Start-Node -ArgumentList @($gnhTsx, 'src/legal/cli.ts', 'import', '--file', $gnhManifest, '--write') -DatabaseUrl $url -ExpectDatabase $gnhDbName
    Write-Log (Redact $imp.Output)
    if ($imp.Error) { Write-Log (Redact $imp.Error) }
    if ($imp.Code -ne 0) { throw "Import failed code $($imp.Code)" }

    Write-Log '=== Activate privacy,agreement,offer --write ==='
    $act = Start-Node -ArgumentList @($gnhTsx, 'src/legal/cli.ts', 'activate', '--file', $gnhManifest, '--documents', ($gnhCoreIds -join ','), '--write') -DatabaseUrl $url -ExpectDatabase $gnhDbName
    Write-Log (Redact $act.Output)
    if ($act.Error) { Write-Log (Redact $act.Error) }
    if ($act.Code -ne 0) { throw "Activate failed code $($act.Code)" }
  }

  Write-Log '=== Final activations ==='
  $final = Start-Node -ArgumentList @($gnhTsx, $gnhStatusPath) -DatabaseUrl $url -ExpectDatabase $gnhDbName
  Write-Log (Redact $final.Output)
  if ($final.Error) { Write-Log (Redact $final.Error) }
  if ($final.Code -ne 0) { throw "Final status failed code $($final.Code)" }

  Write-Log 'DONE'
  Write-Host ""
  Write-Host "Готово. Лог: $gnhLog"
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
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $bstr = [IntPtr]::Zero
  }
  if ($secure) { $secure.Dispose() }
  $secure = $null
  $password = $null
  $url = $null
  $bootstrapUrl = $null
  [GC]::Collect()
}
