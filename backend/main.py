from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import whisper_handler
import ollama_handler
import cv_handler
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
DEFAULT_SETTINGS = {
    "interview_mode": "technical",
    "use_cv": False,
    "always_show_question": False,
}

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_settings() -> dict:
    ensure_data_dir()
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, encoding="utf-8") as f:
            loaded = json.load(f)
        return {**DEFAULT_SETTINGS, **loaded}
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict):
    ensure_data_dir()
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f)


# ── Root ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return FileResponse(os.path.join(frontend_path, "index.html"))


# ── Settings ─────────────────────────────────────────────────────────────────
@app.get("/settings")
def get_settings():
    return load_settings()


class SettingsRequest(BaseModel):
    interview_mode: str
    use_cv: bool
    always_show_question: bool = False


@app.post("/settings")
def update_settings(req: SettingsRequest):
    if req.interview_mode not in ("technical", "screening"):
        raise HTTPException(status_code=400, detail="interview_mode must be 'technical' or 'screening'")
    settings = {
        "interview_mode": req.interview_mode,
        "use_cv": req.use_cv,
        "always_show_question": req.always_show_question,
    }
    save_settings(settings)
    return settings


# ── CV ────────────────────────────────────────────────────────────────────────
@app.post("/cv/upload")
async def upload_cv(file: UploadFile = File(...)):
    allowed = {".pdf", ".docx", ".txt"}
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Use: {', '.join(allowed)}")
    try:
        file_bytes = await file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        text = cv_handler.extract_text(file_bytes, file.filename)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file — try a different format")
        meta = cv_handler.save_cv(text, file.filename)
        try:
            summary = await cv_handler.summarise_cv(text)
            cv_handler.save_summary(summary)
        except Exception:
            cv_handler.delete_cv()
            raise HTTPException(
                status_code=503,
                detail="CV uploaded but summarisation failed — is Ollama running?",
            )
        settings = load_settings()
        settings["use_cv"] = True
        save_settings(settings)
        return {"loaded": True, **meta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cv/status")
def cv_status():
    status = cv_handler.get_cv_status()
    if status:
        return {"loaded": True, **status}
    return {"loaded": False}


@app.delete("/cv")
def delete_cv():
    cv_handler.delete_cv()
    settings = load_settings()
    settings["use_cv"] = False
    save_settings(settings)
    return {"loaded": False}


# ── Interview ─────────────────────────────────────────────────────────────────
class JobDescRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    use_cv: bool = False


class AnalyzeRequest(BaseModel):
    question: str
    transcript: str
    interview_mode: str = "technical"


class SimulationRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    use_cv: bool = False


class AnalyzeSimulationRequest(BaseModel):
    question_obj: dict
    transcript: str
    interview_mode: str = "technical"


class SimulationAnswerItem(BaseModel):
    question_text: str
    phase: str
    competency: str
    evaluation_mode: str
    transcript: str
    result: dict


class SimulationReviewRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    answers: list[SimulationAnswerItem]


@app.post("/generate-questions")
async def generate_questions(req: JobDescRequest):
    try:
        cv_summary = None
        if req.use_cv:
            cv_summary = cv_handler.get_cv_summary()
        questions = await ollama_handler.generate_questions(
            req.job_description,
            req.interview_mode,
            cv_summary
        )
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-simulation")
async def generate_simulation_ep(req: SimulationRequest):
    try:
        cv_summary = None
        if req.use_cv:
            cv_summary = cv_handler.get_cv_summary()
        result = await ollama_handler.generate_simulation(
            req.job_description,
            req.interview_mode,
            cv_summary
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        transcript = whisper_handler.transcribe(audio_bytes)
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-simulation")
async def analyze_simulation_ep(req: AnalyzeSimulationRequest):
    try:
        result = await ollama_handler.analyze_simulation_response(
            req.question_obj,
            req.transcript,
            req.interview_mode
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulation-review")
async def simulation_review_ep(req: SimulationReviewRequest):
    try:
        answers = [a.dict() for a in req.answers]
        result = await ollama_handler.generate_holistic_review(
            req.job_description,
            req.interview_mode,
            answers
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        result = await ollama_handler.analyze_response(
            req.question,
            req.transcript,
            req.interview_mode
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
