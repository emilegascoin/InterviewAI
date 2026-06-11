from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
import whisper_handler
import ollama_handler
import cv_handler
import cover_letter_handler
import tts_handler
import os
import json
import subprocess
import threading
import time

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


class NoCacheStaticFiles(StaticFiles):
    """Serve static assets with revalidation so edits show up without a hard refresh.

    This is a local-only dev tool, so always-revalidate is the right tradeoff —
    it removes any reliance on ?v= cache-busters staying in sync.
    """

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response


app.mount("/static", NoCacheStaticFiles(directory=frontend_path), name="static")

BUILD_INFO = {
    "simulation_normalizer": True,
    "simulation_questions": 8,
}


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
    return FileResponse(
        os.path.join(frontend_path, "index.html"),
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@app.get("/health")
def health():
    return BUILD_INFO


@app.post("/shutdown")
def shutdown():
    def _kill():
        time.sleep(0.8)
        os._exit(0)
    threading.Thread(target=_kill, daemon=True).start()
    return {"status": "shutting_down"}


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


# ── Cover Letter ──────────────────────────────────────────────────────────────
@app.post("/cover-letter/upload")
async def upload_cover_letter(file: UploadFile = File(...)):
    allowed = {".pdf", ".txt"}
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")
    try:
        file_bytes = await file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        text = cover_letter_handler.extract_text(file_bytes, file.filename)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file.")
        meta = cover_letter_handler.save_cover_letter(text, file.filename)
        try:
            summary = await cover_letter_handler.summarise_cover_letter(text)
            cover_letter_handler.save_cover_letter_summary(summary)
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="Cover letter uploaded but summarisation failed — is Ollama running?",
            )
        return {"loaded": True, **meta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/cover-letter/status")
def cover_letter_status():
    status = cover_letter_handler.get_cover_letter_status()
    if status:
        return {"loaded": True, **status}
    return {"loaded": False}

@app.delete("/cover-letter")
def delete_cover_letter_ep():
    cover_letter_handler.delete_cover_letter()
    return {"loaded": False}


# ── Interview ─────────────────────────────────────────────────────────────────
class JobDescRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    use_cv: bool = False
    use_cover_letter: bool = False
    interviewer_persona: str | None = None


class AnalyzeRequest(BaseModel):
    question: str
    transcript: str
    interview_mode: str = "technical"


class SimulationRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    use_cv: bool = False
    use_cover_letter: bool = False
    interviewer_persona: str | None = None


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


class FollowUpCheckRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    section_id: str
    section_label: str
    original_question: str
    conversation: list = []
    latest_answer: str
    follow_up_count: int = 0
    max_follow_ups: int = 2
    interviewer_persona: str | None = None


class NextQuestionRequest(BaseModel):
    job_description: str
    question_number: int
    total_questions: int = 8
    use_cv: bool = False
    use_cover_letter: bool = False
    interviewer_persona: str | None = None
    interview_round: str = "first"
    conversation_history: list = []
    used_topic_keys: list[str] = []


class SectionAnalyzeRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    section_id: str
    section_label: str
    exchanges: list


class IntenseReviewRequest(BaseModel):
    job_description: str
    interview_mode: str = "technical"
    sections: list


@app.post("/generate-questions")
async def generate_questions(req: JobDescRequest):
    try:
        cv_summary = None
        if req.use_cv:
            cv_summary = cv_handler.get_cv_summary()
        cover_letter = None
        if req.use_cover_letter:
            cover_letter = cover_letter_handler.get_cover_letter_summary()
        questions = await ollama_handler.generate_questions(
            req.job_description,
            req.interview_mode,
            cv_summary,
            cover_letter,
            req.interviewer_persona,
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
        cover_letter = None
        if req.use_cover_letter:
            cover_letter = cover_letter_handler.get_cover_letter_summary()
        result = await ollama_handler.generate_simulation(
            req.job_description,
            req.interview_mode,
            cv_summary,
            cover_letter,
            req.interviewer_persona,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-next-question")
async def generate_next_question_ep(req: NextQuestionRequest):
    try:
        cv_summary = None
        if req.use_cv:
            cv_summary = cv_handler.get_cv_summary()
        cover_letter_summary = None
        if req.use_cover_letter:
            cover_letter_summary = cover_letter_handler.get_cover_letter_summary()
        result = await ollama_handler.generate_next_question(
            job_description=req.job_description,
            question_number=req.question_number,
            total_questions=req.total_questions,
            cv_summary=cv_summary,
            cover_letter_summary=cover_letter_summary,
            interviewer_persona=req.interviewer_persona,
            interview_round=req.interview_round,
            conversation_history=req.conversation_history,
            used_topic_keys=req.used_topic_keys,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        # run_in_threadpool frees the event loop while Whisper runs;
        # the threading.Lock in whisper_handler serialises concurrent GPU calls.
        transcript = await run_in_threadpool(whisper_handler.transcribe, audio_bytes)
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


@app.post("/transcribe/analyze-simulation")
async def transcribe_analyze_simulation_ep(
    audio: UploadFile = File(...),
    question_obj: str = Form(...),
    interview_mode: str = Form("technical"),
):
    try:
        audio_bytes = await audio.read()
        transcript = (await run_in_threadpool(whisper_handler.transcribe, audio_bytes)).strip()
        if not transcript:
            raise HTTPException(status_code=400, detail="No speech detected")

        question = json.loads(question_obj)
        result = await ollama_handler.analyze_simulation_response(
            question,
            transcript,
            interview_mode
        )
        return {"transcript": transcript, "result": result}
    except HTTPException:
        raise
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


@app.post("/follow-up-check")
async def follow_up_check_ep(req: FollowUpCheckRequest):
    try:
        result = await ollama_handler.check_follow_up(
            req.job_description,
            req.interview_mode,
            req.section_id,
            req.section_label,
            req.original_question,
            req.conversation,
            req.latest_answer,
            req.follow_up_count,
            req.max_follow_ups,
            req.interviewer_persona,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-section")
async def analyze_section_ep(req: SectionAnalyzeRequest):
    try:
        result = await ollama_handler.analyze_section(
            req.job_description,
            req.interview_mode,
            req.section_id,
            req.section_label,
            req.exchanges,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intense-review")
async def intense_review_ep(req: IntenseReviewRequest):
    try:
        result = await ollama_handler.generate_holistic_review(
            job_description=req.job_description,
            interview_mode=req.interview_mode,
            sections=req.sections,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── TTS ───────────────────────────────────────────────────────────────────────
class TtsRequest(BaseModel):
    text: str


@app.post("/tts")
async def tts_ep(req: TtsRequest):
    try:
        wav_bytes = await run_in_threadpool(tts_handler.synthesize, req.text)
        from fastapi.responses import Response
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
