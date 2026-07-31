@echo off
cd /d "%~dp0"
echo.
echo  Iniciando servidor local (PowerShell)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 pause
