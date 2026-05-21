import os
import json
import io
import httpx
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CV_TEXT_PATH = os.path.join(DATA_DIR, "cv.txt")
CV_SUMMARY_PATH = os.path.join(DATA_DIR, "cv_summary.txt")
CV_META_PATH = os.path.join(DATA_DIR, "cv_meta.json")

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".pdf":
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages).strip()

    elif ext in (".docx", ".doc"):
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()

    else:
        return file_bytes.decode("utf-8", errors="replace").strip()


async def summarise_cv(text: str) -> str:
    truncated = text[:6000]
    prompt = f"""Extract the key professional information from this CV into a concise structured summary.

Include exactly these sections:
- Name and current/most recent job title
- Total years of professional experience (estimate if not stated)
- Key technical skills, tools, and technologies
- Companies or organisations worked at (most recent first)
- Notable projects or achievements (3-5 bullet points)

Be factual — only include what is explicitly stated. Keep under 350 words. Plain text only, no markdown.

CV:
{truncated}"""

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        response.raise_for_status()
        return response.json()["response"].strip()


def save_cv(text: str, original_filename: str) -> dict:
    ensure_data_dir()
    with open(CV_TEXT_PATH, "w", encoding="utf-8") as f:
        f.write(text)
    meta = {
        "filename": original_filename,
        "uploaded_at": datetime.now().isoformat()
    }
    with open(CV_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta


def save_summary(summary: str):
    ensure_data_dir()
    with open(CV_SUMMARY_PATH, "w", encoding="utf-8") as f:
        f.write(summary)


def get_cv_status() -> dict | None:
    if not os.path.exists(CV_META_PATH):
        return None
    with open(CV_META_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_cv_summary() -> str | None:
    if not os.path.exists(CV_SUMMARY_PATH):
        return None
    with open(CV_SUMMARY_PATH, encoding="utf-8") as f:
        return f.read()


def delete_cv():
    for path in [CV_TEXT_PATH, CV_SUMMARY_PATH, CV_META_PATH]:
        if os.path.exists(path):
            os.remove(path)
