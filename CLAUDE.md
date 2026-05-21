# InterviewAI

Local AI-powered interview coach. Runs entirely offline on your machine — no API costs.

## Stack

- **faster-whisper** (CUDA) — transcribes mic audio using the Whisper large-v2 model on the RTX 3070 Ti
- **Ollama + qwen2.5:7b** — generates questions, scores responses, writes feedback
- **FastAPI** — backend server on port 8000
- **HTML/CSS/JS** — frontend served as static files by FastAPI

## Project structure

```
InterviewAI/
├── backend/
│   ├── main.py            # FastAPI routes + static file serving
│   ├── whisper_handler.py # Loads Whisper model on CUDA, transcribes audio
│   └── ollama_handler.py  # Calls Ollama API for question gen + analysis
├── frontend/
│   ├── index.html         # 4-step UI
│   ├── style.css          # Dark theme
│   └── app.js             # Recording, transcription, analysis logic
├── venv/                  # Python virtual environment (already set up)
├── start.bat              # Launch script
└── setup.bat              # One-time setup (already done)
```

## How to start

Two things need to be running:

**1. Ollama** (if not already running as a service):
```
C:\Users\Emile\AppData\Local\Programs\Ollama\ollama.exe serve
```

**2. FastAPI backend** (run from the `backend/` directory):
```
cd backend
..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open **http://localhost:8000** in the browser.

Or just double-click `start.bat` from the project root — it handles both.

## Model notes

- Whisper `large-v2` downloads ~1.5GB on first transcription (cached after that)
- `qwen2.5:7b` is already pulled and cached by Ollama
- Both models run fully on the RTX 3070 Ti (8GB VRAM fits both)

## What it analyses

Given a job description and a spoken answer it returns:
- Overall score, formality score, specificity score (all /10)
- Formality label: Informal / Neutral / Professional
- STAR method coverage (Situation, Task, Action, Result)
- Filler word count (um, uh, like)
- Written feedback (2-3 sentences)
- Sample response (polished version of the answer)

## Ollama model

The model is `qwen2.5:7b`. To swap it out edit `MODEL` in `backend/ollama_handler.py`.
Other options already pulled can be listed with:
```
C:\Users\Emile\AppData\Local\Programs\Ollama\ollama.exe list
```
