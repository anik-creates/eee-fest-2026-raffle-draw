@echo off
title EEE FEST 2026 - Master Verification & Admin Portal Server
color 0B

echo ======================================================================
echo    EEE FEST 2026 - OFFICIAL RAFFLE DRAW ^& VERIFICATION PORTAL
echo    Department of Electrical and Electronic Engineering
echo    Daffodil International University (DIU)
echo ======================================================================
echo.

:: Detect Python executable
set PY_CMD=python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PY_CMD=py
    ) else (
        echo [ERROR] Python was not found in your system PATH!
        echo You can still open the portal offline without Python by double-clicking:
        echo   docs\index.html
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Python detected.
echo.
echo ======================================================================
echo  PORTAL LAUNCH ADDRESSES:
echo    - Local Computer: http://127.0.0.1:5000
echo    - Default Super Admin: admin@eeefest.com / eeefestadmin
echo ======================================================================
echo.
echo Launching your default browser to http://127.0.0.1:5000 in 2 seconds...

start "" http://127.0.0.1:5000

echo.
echo Starting Flask Verification Server...
echo Press Ctrl+C in this console window anytime to stop the server.
echo ======================================================================
echo.

%PY_CMD% app.py

pause
