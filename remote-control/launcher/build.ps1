$ErrorActionPreference = 'Stop'
$launcherRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$launcherRepo = [IO.Path]::GetFullPath((Join-Path $launcherRoot '../..'))
$launcherOutput = Join-Path $launcherRepo 'accounts/downloads'
New-Item -ItemType Directory -Path $launcherOutput -Force | Out-Null
$launcherCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $launcherCompiler)) { throw 'The Windows .NET Framework compiler is required.' }
$launcherSource = Join-Path $launcherRoot 'NeonLauncher.cs'
$launcherBinary = Join-Path $launcherOutput 'NeonLauncher.exe'
& $launcherCompiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$launcherBinary" /reference:System.Windows.Forms.dll,System.Drawing.dll,System.Net.Http.dll,System.Web.Extensions.dll,System.Security.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll $launcherSource (Join-Path $launcherRoot "NeonVideo.cs")
if ($LASTEXITCODE -ne 0) { throw 'Neon Launcher did not compile.' }
Get-FileHash -LiteralPath "$launcherOutput/NeonLauncher.exe" -Algorithm SHA256 | Select-Object Hash
