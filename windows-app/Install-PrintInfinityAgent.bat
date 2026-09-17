@echo off
title Print Infinity Agent Installer
echo ======================================================
echo    Print Infinity Agent — One-Click Setup
echo ======================================================
echo.
echo Installing Print Infinity Agent to your PC...
echo Please wait a moment...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

echo.
echo Setup finished. Press any key to close this window.
pause >nul
