@echo off
title ZP Dashboard Launcher
echo ========================================================
echo         Starting ZP Dashboard...
echo ========================================================
echo.

:: Check if Node is installed
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo Node.js detected. Starting local server on port 8000...
    start http://localhost:8000/index.html
    node server.js
    goto end
)

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python detected. Starting local web server on port 8000...
    start http://localhost:8000/index.html
    python -m http.server 8000
    goto end
)

:: Fallback if neither is installed: open directly in browser
echo Starting directly in browser...
start index.html

:end

