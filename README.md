# InterviewAI

A fully local, offline AI-powered interview coach. No API costs, no cloud, no data leaving your machine.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![Ollama](https://img.shields.io/badge/Ollama-qwen2.5:7b-purple) ![Whisper](https://img.shields.io/badge/Whisper-large--v2-orange)

---

## What it does

1. Paste a job description
2. Choose **Practice** or **Full Simulation** mode, and **Screening** or **Technical** interview type
3. Optionally upload your CV for personalised questions
4. Record your spoken answers — Whisper transcribes them locally
5. Get scored feedback on every answer across five dimensions
6. Review a full results summary and export as PDF

Everything runs on your own hardware — no API keys, no subscriptions, no data sent anywhere.

---

## Stack

| Component | Technology | Why this choice |
|-----------|-----------|-----------------|
| Speech-to-text | faster-whisper (large-v2) | Highest open-source transcription accuracy; runs on CPU or CUDA |
| LLM | Ollama — qwen2.5:7b | Local inference, zero API cost, reliable JSON output via `format: "json"` |
| Backend | FastAPI (Python) | Async, lightweight, easy to extend |
| Frontend | Vanilla HTML / CSS / JS | No build step, no framework overhead, ships as static files served by FastAPI |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (localhost:8000)              │
│                                                              │
│   Job Description  ──►  Generate Questions / Simulation     │
│   Microphone audio ──►  Transcribe ──► Analyse ──► Display  │
│   CV upload        ──►  Extract ──► Summarise ──► Store      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP (FastAPI)
┌────────────────────────────▼────────────────────────────────┐
│                     FastAPI Backend (Python)                  │
│                                                              │
│  /generate-questions   ──► ollama_handler.generate_questions │
│  /generate-simulation  ──► ollama_handler.generate_simulation│
│  /transcribe           ──► whisper_handler.transcribe        │
│  /analyze              ──► ollama_handler.analyze_response   │
│  /analyze-simulation   ──► ollama_handler.analyze_simulation │
│  /simulation-review    ──► ollama_handler.holistic_review    │
│  /upload-cv            ──► cv_handler.extract + summarise    │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼──────────────────────┐
│   Ollama (local)     │   │   faster-whisper (local)          │
│   qwen2.5:7b         │   │   large-v2 model                  │
│   - question gen     │   │   - CPU or CUDA                   │
│   - scoring + why    │   │   - int8 quantised                │
│   - holistic review  │   │   - ~1.5 GB download, cached      │
└─────────────────────┘   └──────────────────────────────────┘
           │
┌──────────▼──────────┐
│   data/ (local only) │
│   - cv_summary.txt   │
│   - settings.json    │
│   (gitignored)       │
└─────────────────────┘
```

---

## Data flow — single answer

```
1. User speaks         → browser MediaRecorder captures WebM/Opus audio
2. Stop recording      → POST /transcribe (audio blob)
3. faster-whisper      → returns transcript string
4. POST /analyze       → {question, transcript, interview_mode}
5. Ollama (qwen2.5:7b) → returns structured JSON scores + feedback
6. Filler word count   → computed in Python with regex (not LLM — deterministic)
7. Frontend renders    → scores, why-lines, formality badge, STAR coverage, feedback, sample response
```

---

## Interview modes

| Mode | Focus |
|------|-------|
| **Technical** | Stack-specific questions, STAR structure expected, depth and specificity scored |
| **Screening** | Motivation, communication, culture fit — recruiter framing, no deep technical questions |

### Practice vs Simulation

**Practice** — generates 5 questions, scores each answer immediately, full summary at end.

**Full Simulation** — structured 8-question arc with an interviewer persona:

| # | Phase | Type |
|---|-------|------|
| Q1 | Intro | Tell me about yourself (role-specific) |
| Q2–Q3 | Background | Experience against JD requirements |
| Q4–Q5 | Behavioural | STAR questions — ownership, impact, collaboration |
| Q6–Q7 | Technical | Stack/system questions (or screening questions in Screening mode) |
| Q8 | Closing | "Do you have any questions for me?" — your question gets rated |

Scores are hidden during simulation and revealed in a **holistic hire/no-hire review** at the end, which includes a competency map, strengths and risks with question citations, and a single coaching focus.

---

## Scoring

Each answer is scored across five dimensions:

| Metric | Description | How scored |
|--------|-------------|------------|
| **Overall** | Holistic interviewer rating /10 | LLM |
| **Relevance** | Did they answer what was actually asked? | LLM |
| **Specificity** | Concrete examples, numbers, named projects | LLM |
| **Formality** | Professional communication standard | LLM |
| **Filler Words** | Count of um, uh, like, you know, etc. | Python regex (deterministic) |

Each score includes a one-sentence **why** explaining what specifically earned or cost points — not just the number.

Technical mode also shows **STAR coverage** (Situation / Task / Action / Result), with strict detection: "we did X" does not count for Action, "it went well" does not count for Result.

---

## Key design decisions

**Why local-only?**
Sensitive data — audio recordings, interview transcripts, job descriptions, CV content — never leaves the machine. Particularly important in financial services and enterprise contexts. Also means zero ongoing cost and no dependency on external API availability.

**Why `format: "json"` for Ollama?**
Forces the model to produce machine-readable output rather than prose JSON wrapped in markdown fences. Makes scoring deterministic and eliminates parsing failures from freetext responses.

**Why filler word counting in Python, not the LLM?**
LLMs hallucinate counts. A regex over the raw transcript is deterministic, fast, and correct every time. The counted value is injected into the prompt so the LLM references it rather than recounts it.

**Why upfront question generation (not dynamic)?**
Real interviews follow a script. Generating all questions before the interview starts means consistent arc structure, no latency mid-question, and a predictable simulation experience.

**Why deterministic between-question acknowledgments?**
Using Ollama between every question would add 5–10s of latency per transition. Template acknowledgments per phase (intro/background/behavioral/technical/closing) give a natural feel with zero wait time.

**Why compute best/worst/average scores in Python, not Ollama?**
Prevents hallucinated citations in the holistic review. Stats are computed deterministically; only narrative reasoning is sent to the LLM.

---

## Project structure

```
InterviewAI/
├── backend/
│   ├── main.py             # FastAPI routes + static file serving
│   ├── whisper_handler.py  # Loads Whisper model on CUDA/CPU, transcribes audio
│   ├── ollama_handler.py   # Question generation, scoring, holistic review
│   ├── cv_handler.py       # CV extraction (pdfplumber, python-docx) + summarisation
│   └── requirements.txt
├── frontend/
│   ├── index.html          # Shell — fixed red X exit button, print styles
│   ├── style.css           # Dark theme
│   └── app.js              # Vanilla JS state machine (~1050 lines)
├── data/                   # CV + settings — gitignored, never committed
├── start.bat               # Launches Ollama + FastAPI, opens browser
├── stop.bat                # Kills port 8000 process
└── setup.bat               # One-time venv + dependency install
```

---

## Requirements

- Windows 10/11
- Python 3.11+
- [Ollama](https://ollama.com) installed with `qwen2.5:7b` pulled
- A microphone

GPU optional — both Whisper and Ollama fall back to CPU automatically.

---

## Setup (first time only)

```
git clone https://github.com/YOUR_USERNAME/InterviewAI.git
cd InterviewAI
setup.bat
ollama pull qwen2.5:7b
```

---

## Running

Double-click **`start.bat`** — starts Ollama (if not running), starts FastAPI on port 8000, opens the browser.

To stop: click the red **X** button in the top-right corner of the app, or run `stop.bat`.

---

## CV support

Upload a PDF, DOCX, or TXT version of your CV on the main screen. It is extracted to text, summarised by the LLM, and saved locally in `data/`. Enable the **Use CV** toggle to personalise questions to your background. Your CV persists between sessions — remove it with the X button next to the filename.

---

## Notes

- Whisper `large-v2` downloads ~1.5 GB on first transcription (cached after that)
- `qwen2.5:7b` is already pulled and cached by Ollama
- The `data/` directory is gitignored — your CV and settings are never committed
- The app runs entirely offline after initial model downloads
