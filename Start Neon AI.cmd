@echo off
setlocal
cd /d "%~dp0"
set "NEON_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "NEON_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%NEON_NODE%" scripts\start-local-ai.mjs
if errorlevel 1 pause
endlocal
