@echo off
REM Run this AFTER installing an NVIDIA graphics card and its latest driver (nvidia.com/drivers).
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Please run install.bat first.
  pause
  exit /b 1
)
where nvidia-smi >nul 2>nul
if not %errorlevel%==0 (
  echo No NVIDIA driver found. Install the card's driver from nvidia.com/drivers, restart, then run this again.
  pause
  exit /b 1
)
nvidia-smi
call .venv\Scripts\activate.bat
echo Installing GPU (CUDA) PyTorch and GPU libraries for Whisper...
pip uninstall -y torch
pip install torch --index-url https://download.pytorch.org/whl/cu128 || goto :error
pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*" || goto :error
echo.
echo Done. Now run trial-check.bat - it should say "GPU: <your card>" and download the larger Whisper model.
pause
exit /b 0

:error
echo GPU upgrade failed. See the messages above. The app keeps working on the CPU.
pause
exit /b 1
