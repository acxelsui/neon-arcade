@echo off
cd /d "%~dp0"
set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE%" set "NODE=node"
echo Starting Neon Arcade. Open http://localhost:3000 when ready.
echo Keep this window open while using the arcade.
"%NODE%" server.mjs
pause
