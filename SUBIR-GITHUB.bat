@echo off
chcp 65001 >nul
setlocal

set "GIT=C:\Users\Usuario\AppData\Local\GitHubDesktop\app-3.6.3\resources\app\git\cmd\git.exe"
set "SRC=%~dp0"
set "CLONE=%~dp0..\site-teste-git"

if not exist "%GIT%" (
  echo Git nao encontrado. Instale o GitHub Desktop ou abra o projeto la e clique em Push origin.
  pause
  exit /b 1
)

if not exist "%CLONE%\.git" (
  echo Clonando repositorio...
  "%GIT%" clone https://github.com/yosoychocolate/chocolate-cereza.git "%CLONE%"
)

echo Sincronizando arquivos...
robocopy "%SRC%" "%CLONE%" /MIR /XD .git functions\node_modules node_modules .cursor site-teste-git /XF version.json SUBIR-GITHUB.bat /NFL /NDL /NJH /NJS /nc /ns /np >nul

cd /d "%CLONE%"
"%GIT%" pull origin main
"%GIT%" add -A
"%GIT%" status --short
echo.
set /p MSG=Mensagem do commit (Enter = atualizacao site): 
if "%MSG%"=="" set MSG=atualizacao site
"%GIT%" commit -m "%MSG%" || (
  echo Nada novo para enviar.
  pause
  exit /b 0
)
"%GIT%" push origin main
echo.
echo Enviado! Aguarde Actions ficar verde em:
echo https://github.com/yosoychocolate/chocolate-cereza/actions
echo Depois abra o site com Ctrl+F5 e confira version.json
pause
