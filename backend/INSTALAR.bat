@echo off
chcp 65001 >nul
title AgroEstructuras - Instalacion del back-end
cd /d "%~dp0"
echo.
echo  === AgroEstructuras: instalacion (solo la primera vez) ===
echo  Antes: abre el panel de XAMPP y pulsa "Start" en MySQL.
echo.
where py >nul 2>nul
if errorlevel 1 (
  echo  No encuentro Python. Instalalo desde https://www.python.org/downloads/
  echo  y marca la casilla "Add python.exe to PATH".
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo  Creando el entorno de Python...
  py -m venv .venv || (echo  No se pudo crear el entorno. & pause & exit /b 1)
)
echo  Instalando Flask y PyMySQL...
".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt || (echo  Fallo la instalacion de paquetes. Revisa tu internet. & pause & exit /b 1)
echo  Creando la base de datos...
set PYTHONIOENCODING=utf-8
".venv\Scripts\python.exe" instalar.py || (pause & exit /b 1)
echo.
echo  Listo. Ahora abre INICIAR_BACKEND.bat
pause
