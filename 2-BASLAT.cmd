@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
title KUZMIN - Magaza
if not exist ".runtime\node\node.exe" (
 echo Once 1-KURULUM.cmd dosyasini calistirin.
 pause
 exit /b 1
)
".runtime\node\node.exe" "scripts\local-server.mjs"
set "KUZMIN_RESULT=%ERRORLEVEL%"
if not "%KUZMIN_RESULT%"=="0" pause
exit /b %KUZMIN_RESULT%
