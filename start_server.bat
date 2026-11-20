@echo off
title EEE FEST 2026 - Raffle Draw & Verification Portal
color 0B
echo ============================================================
echo   EEE FEST 2026 - RAFFLE DRAW ^& VERIFICATION PORTAL
echo   Department of Electrical and Electronic Engineering
echo   Daffodil International University
echo ============================================================
echo.
echo Checking Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

echo Starting Flask Server on http://localhost:5000 ...
echo Press Ctrl+C in this window to stop the server.
echo.
start "" http://localhost:5000
python app.py
pause
