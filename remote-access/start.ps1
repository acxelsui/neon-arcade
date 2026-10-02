param(
 [Parameter(Mandatory=$true)][string]$BrowserDirectory,
 [string]$NodePath = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskBrowser = Join-Path $BrowserDirectory 'web-server.exe'
if (-not (Test-Path -LiteralPath $taskBrowser)) { throw 'Choose the installed Moonlight Web folder.' }
if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Choose the installed Node runtime.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'device-config.json'))) { throw 'Register this PC in the owner Devices page and save its private device-config.json here.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskRepo 'remote-relay\node_modules\ws\wrapper.mjs'))) { throw 'Install the relay package dependencies before starting the PC client.' }
function PortIsListening([int]$Port) {
 $taskClient = New-Object System.Net.Sockets.TcpClient
 try { $taskClient.Connect('127.0.0.1',$Port); return $true } catch { return $false } finally { $taskClient.Dispose() }
}
if (-not (PortIsListening 8080)) {
 Start-Process -FilePath $taskBrowser -WorkingDirectory $BrowserDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $BrowserDirectory 'server\output.log') -RedirectStandardError (Join-Path $BrowserDirectory 'server\error.log')
}
if (-not (Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*remote-access/device-client.mjs*' })) {
 Start-Process -FilePath $NodePath -ArgumentList @('remote-access/device-client.mjs') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'device.log') -RedirectStandardError (Join-Path $PSScriptRoot 'device-error.log')
}
$taskSunshine = Get-Service -Name 'SunshineService' -ErrorAction SilentlyContinue
if ($taskSunshine.Status -ne 'Running') { Write-Output 'Start Sunshine before connecting. Its local settings are https://localhost:47990/.' }
Write-Output 'Outbound PC client started. Keep this host PC awake and online. After a restart, run this launcher again before connecting. Tailscale is not needed by the browser on the other laptop.'
