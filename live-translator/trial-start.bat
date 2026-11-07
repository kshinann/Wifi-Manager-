@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Please run install.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python run.py --preset presets\trial-en-zh.json %*
pause
