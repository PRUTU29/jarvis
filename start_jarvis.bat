@echo off
title J.A.R.V.I.S. - Laptop Assistant Boot System
color 0B

cd /d "%~dp0"

echo =======================================================================
echo          J.A.R.V.I.S. SYSTEM INITIALIZATION SEQUENCE
echo =======================================================================
echo.
echo           __  ___  ____  _      _  ____
echo          ^|  ^|/  / / __ \^| ^|    ^| ^|/ ___^|
echo          ^|  '  / ^| ^|  ^| ^| ^|    ^| ^|\___ \
echo          ^|  .  \ ^| ^|__^| ^| ^|___ ^| ^| ___) ^|
echo          ^|_^|\__\ \______/\____/ ^|_^|____/
echo.
echo     [SYSTEM] LOADING LOCAL OS INTELLIGENCE CONTROLLERS...
echo     [SYSTEM] HARDWARE MONITOR INTERFACE ONLINE.
echo.
echo =======================================================================
echo.

if not exist "main.py" (
    echo [ERROR] Crucial system file 'main.py' was not found in the current folder!
    echo Current folder path: %CD%
    echo Please make sure all Jarvis files are extracted in this folder.
    echo.
    pause
    exit /b
)

if not exist "requirements.txt" (
    echo [ERROR] Required file 'requirements.txt' was not found in the current folder!
    echo Please make sure all Jarvis files are extracted in this folder.
    echo.
    pause
    exit /b
)

set PYTHON_EXE=python
python --version >nul 2>nul
if %errorlevel% neq 0 (
    py --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python was not found on your system!
        echo.
        echo To run Jarvis, please:
        echo 1. Download Python 3.8 or newer from: https://www.python.org/downloads/
        echo 2. Run the installer and CRITICALLY check the box that says:
        echo    "Add Python.exe to PATH" at the bottom of the setup screen.
        echo 3. Complete installation, reopen this file, and enjoy!
        echo.
        pause
        exit /b
    ) else (
        set PYTHON_EXE=py
        echo [SYSTEM] 'python' command not found, but 'py' launcher detected. Using 'py' fallback.
    )
)

echo [SYSTEM] Verifying backend dependencies (pip install)...
%PYTHON_EXE% -m pip install -r requirements.txt --user
if %errorlevel% neq 0 (
    echo.
    echo [Warning] Automatic package verification failed or returned warnings.
    echo We will attempt to boot the assistant anyway. If it crashes, please check your network connection.
    echo.
    timeout /t 3 >nul
)

echo [SYSTEM] Opening dashboard at http://localhost:5000...
timeout /t 1 /nobreak >nul
start http://localhost:5000

echo [SYSTEM] Launching Flask Local Server...
echo.
echo =======================================================================
echo           J.A.R.V.I.S. SERVER IS RUNNING IN TERMINAL
echo           Close this terminal window to shut down Jarvis.
echo =======================================================================
echo.
%PYTHON_EXE% main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] J.A.R.V.I.S. server crashed or terminated with error code %errorlevel%!
    echo Please review the traceback above for error details.
    echo.
    pause
)
