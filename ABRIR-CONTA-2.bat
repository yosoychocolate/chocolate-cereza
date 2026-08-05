@echo off
title Segunda conta (anonimo) - Chocolate ^& Cereza
cd /d "%~dp0"
echo.
echo  Abrindo http://localhost:8765 em janela ANONIMA (segunda conta)
echo  O servidor ja deve estar rodando (ABRIR-SITE.bat).
echo.
start "" chrome --incognito "http://localhost:8765/"
timeout /t 2 >nul
echo  Se o Chrome nao abriu, copie: http://localhost:8765
echo  e abra em Ctrl+Shift+N (anonimo) manualmente.
echo.
pause
