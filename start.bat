@echo off
echo ================================
echo  InterviewAI
echo ================================
echo.

echo Starting Ollama in background...
start /B "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve

timeout /t 2 /nobreak >nul

echo Starting InterviewAI server...
start http://localhost:8000
cd backend
..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
