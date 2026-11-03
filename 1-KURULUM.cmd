@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
title KUZMIN - Ilk Kurulum
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\setup.ps1"
set "KUZMIN_RESULT=%ERRORLEVEL%"
if not "%KUZMIN_RESULT%"=="0" echo Kurulum tamamlanamadi. Yukaridaki hata mesajini kontrol edin.
pause
exit /b %KUZMIN_RESULT%
