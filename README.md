# InterviewAI

A fully local, offline AI-powered interview coach. No API costs, no data leaving your machine.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![Ollama](https://img.shields.io/badge/Ollama-qwen2.5:7b-purple)

---

## What it does

1. Paste a job description
2. Choose **Screening** or **Technical** interview mode
3. Optionally load your CV to get personalised questions
4. Record your spoken answers — Whisper transcribes them locally
5. Get scored feedback on every answer: overall score, formality, specificity, relevance, STAR coverage, filler word count
6. Review a full summary at the end and export it as a PDF

Everything runs on your own machine — Whisper for speech-to-text, Ollama + qwen2.5:7b for question generation and analysis.

---

## Stack

| Component | Technology |
|-----------|-----------|
| Speech-to-text | faster-whisper (large-v2, CPU) |
| LLM | Ollama — qwen2.5:7b |
| Backend | FastAPI (Python) |
| Frontend | Vanilla HTML / CSS / JS |

---

## Requirements

- Windows 10/11
- Python 3.11+
- [Ollama](https://ollama.com) installed with `qwen2.5:7b` pulled
- A microphone

---

## Setup (first time only)

1. Clone the repo:
   ```
   git clone https://github.com/YOUR_USERNAME/InterviewAI.git
   cd InterviewAI
   ```

2. Run the setup script (creates venv + installs dependencies):
   ```
   setup.bat
   ```

3. Pull the Ollama model if you haven't already:
   ```
   ollama pull qwen2.5:7b
   ```

---

## Running the app

Double-click **`launch.vbs`** on your desktop (or `start.bat` from the project root).

This starts:
- Ollama in the background (if not already running)
- FastAPI backend on port 8000

Then open **http://localhost:8000** in your browser.

To stop the backend: double-click **`stop.vbs`** (or run `stop.bat`). Ollama keeps running as a service.

---

## CV support

Upload a PDF, DOCX, or TXT version of your CV on the main screen. It gets extracted to text, summarised by the LLM, and saved locally in `data/`. Enable the **Use CV** toggle to have questions tailored to your background. Your CV persists between sessions — remove it with the ✕ button.

---

## Interview modes

| Mode | Focus |
|------|-------|
| **Technical** | Stack-specific questions, STAR structure expected, depth and specificity scored |
| **Screening** | Motivation, communication, culture fit — recruiter framing, no deep technical questions |

The scoring rubric, feedback style, and result display automatically adapt to the selected mode.

---

## Scoring

Each answer is scored across five dimensions:

| Metric | Description |
|--------|-------------|
| **Overall** | Holistic interviewer rating /10 |
| **Relevance** | Did they answer what was actually asked? |
| **Specificity** | Concrete examples, numbers, named projects |
| **Formality** | Professional communication standard |
| **Filler Words** | Count of um, uh, like, you know, etc. |

Technical mode also shows **STAR coverage** (Situation / Task / Action / Result).

---

## Project structure

```
InterviewAI/
├── backend/
│   ├── main.py             # FastAPI routes
│   ├── whisper_handler.py  # Speech-to-text
│   ├── ollama_handler.py   # Question generation + analysis
│   ├── cv_handler.py       # CV extraction + summarisation
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/                   # CV + settings (gitignored)
├── start.bat               # Launch script
├── stop.bat                # Stop backend
├── launch.vbs              # Silent desktop launcher
└── setup.bat               # One-time setup
```

---

## Notes

- Whisper `large-v2` downloads ~1.5 GB on first transcription (cached after that)
- Both models run fully on CPU — no GPU required (GPU will be used automatically if available)
- The `data/` directory is gitignored — your CV and settings are never committed
