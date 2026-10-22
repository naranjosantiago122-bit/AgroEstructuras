@echo off
chcp 65001 >nul
title AgroEstructura - Servidor local
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No encuentro Node.js en este computador.
  echo  Instalalo desde https://nodejs.org  y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
start "" "http://localhost:8080"
node herramientas\servidor.js 8080
pause
