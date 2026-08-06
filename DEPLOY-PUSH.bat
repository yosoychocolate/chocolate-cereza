@echo off
chcp 65001 >nul
echo.
echo === Deploy push notifications (Firebase Cloud Functions) ===
echo.
echo Antes: cole FIREBASE_VAPID_KEY em firebase-config.js
echo        (Firebase Console - Cloud Messaging - Web Push)
echo.

where firebase >nul 2>&1
if errorlevel 1 (
  echo Firebase CLI nao encontrado. Instale com:
  echo   npm install -g firebase-tools
  echo   firebase login
  pause
  exit /b 1
)

cd /d "%~dp0functions"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 pause & exit /b 1
)

cd /d "%~dp0"
echo.
echo Publicando functions + regras Firestore...
firebase deploy --only functions,firestore:rules
echo.
pause
