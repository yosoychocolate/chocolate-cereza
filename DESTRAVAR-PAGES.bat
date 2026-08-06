@echo off
chcp 65001 >nul
echo.
echo === Destravar GitHub Pages (sem botao de deletar) ===
echo.
echo 1. Abra Settings ^> Pages e clique em UNPUBLISH SITE
echo    https://github.com/yosoychocolate/chocolate-cereza/settings/pages
echo.
echo 2. Espere 2 minutos (nao faca nada nesse tempo)
echo.
echo 3. Configure de novo:
echo    Source: Deploy from a branch
echo    Branch: gh-pages
echo    Folder: / (root)
echo    Save
echo.
echo 4. Actions ^> Deploy GitHub Pages ^> Run workflow
echo.
echo 5. Teste (Ctrl+F5):
echo    https://yosoychocolate.github.io/chocolate-cereza/version.json
echo    Deve mostrar 7261063 ou mais recente
echo.
start https://github.com/yosoychocolate/chocolate-cereza/settings/pages
pause
