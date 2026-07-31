@echo off
title Chocolate ^& Cereza - Servidor local
cd /d "%~dp0"
echo.
echo  Abrindo o site em http://localhost:8080
echo  NAO FECHE esta janela enquanto usar o site.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
echo.
echo  Servidor encerrado.
pause
