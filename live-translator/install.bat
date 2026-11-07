@echo off
REM One-time setup for Windows. Needs Python 3.10+ from python.org (tick "Add to PATH").
cd /d "%~dp0"
python -m venv .venv || goto :error
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || goto :error
pip install -r requirements-cloud-ai.txt || goto :error

REM Install the GPU build of PyTorch when an NVIDIA card is present, else the CPU build.
where nvidia-smi >nul 2>nul
if %errorlevel%==0 (
  echo NVIDIA GPU found - installing CUDA PyTorch and GPU libraries...
  pip install torch --index-url https://download.pytorch.org/whl/cu128 || goto :error
  pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*" || goto :error
) else (
  echo No NVIDIA GPU found - installing CPU PyTorch...
  pip install torch --index-url https://download.pytorch.org/whl/cpu || goto :error
)
pip install -r requirements-local-ai.txt || goto :error
echo.
echo Done. Double-click start.bat to run Live Translator.
pause
exit /b 0

:error
echo Setup failed. See the messages above.
pause
exit /b 1
