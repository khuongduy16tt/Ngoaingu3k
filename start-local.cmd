@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm is not installed or not on PATH.
  echo Install Node.js LTS, then run this file again.
  exit /b 1
)

echo Starting Ngoaingu3k local server...
call npm.cmd run dev --prefix server
