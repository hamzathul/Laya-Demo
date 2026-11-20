@echo off
setlocal
cd /d "%~dp0"
set USE_TF=0
set OMP_NUM_THREADS=8

if not exist ".venv\Scripts\python.exe" (
  echo No .venv found. Run setup first:
  echo   python -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
  echo   .venv\Scripts\python.exe tools\make_samples.py
  exit /b 1
)

start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 4; Start-Process 'http://127.0.0.1:8000'"
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
