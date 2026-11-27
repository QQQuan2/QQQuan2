@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Tiny Island  -  http://localhost:8000
echo.
set "PY=python"
where py >nul 2>nul
if %errorlevel%==0 set "PY=py"

rem Start the static server first (in the background of this console),
rem then give it a moment before opening the browser so the first load
rem never hits a connection-refused page.
start "" /b %PY% -m http.server 8000
timeout /t 2 >nul
start "" http://localhost:8000

echo   Server running. Press Ctrl+C or close this window to stop.
pause >nul
