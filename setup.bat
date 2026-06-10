@echo off
echo ================================
echo  InterviewAI - First Time Setup
echo ================================
echo.

echo [1/4] Registering git hooks...
git config core.hooksPath ./hooks
echo Done.
echo.

echo [2/4] Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo [3/4] Installing dependencies...
pip install -r backend\requirements.txt

echo [4/4] Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo  Ollama not found. Please install it from https://ollama.com
  echo  Then run: ollama pull qwen2.5:7b
  pause
  exit /b 1
)

echo Pulling qwen2.5:7b model (this may take a few minutes on first run)...
ollama pull qwen2.5:7b

echo.
echo Setup complete! Run start.bat to launch InterviewAI.
pause
