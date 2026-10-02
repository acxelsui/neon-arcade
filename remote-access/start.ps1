param(
 [Parameter(Mandatory=$true)][string]$BrowserDirectory,
 [string]$NodePath = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskBrowser = Join-Path $BrowserDirectory 'web-server.exe'
if (-not (Test-Path -LiteralPath $taskBrowser)) { throw 'Choose the installed Moonlight Web folder.' }
if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Choose the installed Node runtime.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'config.json'))) { throw 'The private gateway config is missing.' }
function PortIsListening([int]$Port) {
 $taskClient = New-Object System.Net.Sockets.TcpClient
 try { $taskClient.Connect('127.0.0.1',$Port); return $true } catch { return $false } finally { $taskClient.Dispose() }
}
if (-not (PortIsListening 8080)) {
 Start-Process -FilePath $taskBrowser -WorkingDirectory $BrowserDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $BrowserDirectory 'server\output.log') -RedirectStandardError (Join-Path $BrowserDirectory 'server\error.log')
}
if (-not (PortIsListening 8090)) {
 Start-Process -FilePath $NodePath -ArgumentList @('remote-access/gateway.mjs') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'gateway.log') -RedirectStandardError (Join-Path $PSScriptRoot 'gateway-error.log')
}
$taskSunshine = Get-Service -Name 'SunshineService' -ErrorAction SilentlyContinue
if ($taskSunshine.Status -ne 'Running') { Write-Output 'Start Sunshine before connecting. Its local settings are https://localhost:47990/.' }
Write-Output 'Owner-protected browser services started. Keep this host PC awake and Tailscale connected. After a restart, run this launcher again before connecting.'
