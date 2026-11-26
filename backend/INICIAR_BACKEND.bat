@echo off
chcp 65001 >nul
title AgroEstructuras - Servidor (no cierres esta ventana)
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo  Primero ejecuta INSTALAR.bat
  pause
  exit /b 1
)
if not exist ".env" (
  echo  Falta el archivo .env. Ejecuta INSTALAR.bat
  pause
  exit /b 1
)
echo.
echo  Recuerda: MySQL debe estar encendido en el panel de XAMPP.
echo  Abriendo http://localhost:5000 ...
echo.
start "" "http://localhost:5000"
set PYTHONIOENCODING=utf-8
".venv\Scripts\python.exe" app.py
pause
