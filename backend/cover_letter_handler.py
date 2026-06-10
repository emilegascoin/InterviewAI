import os, json, io, httpx
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CL_TEXT_PATH = os.path.join(DATA_DIR, "cover_letter.txt")
CL_SUMMARY_PATH = os.path.join(DATA_DIR, "cover_letter_summary.txt")
CL_META_PATH = os.path.join(DATA_DIR, "cover_letter_meta.json")
MAX_CL_CHARS = 8000

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:7b"

def ensure_data_dir(): os.makedirs(DATA_DIR, exist_ok=True)

def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".pdf":
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages).strip()
    else:  # .txt
        return file_bytes.decode("utf-8", errors="replace").strip()

async def summarise_cover_letter(text: str) -> str:
    truncated = text[:6000]
    prompt = f"""Extract the key claims from this cover letter into a concise summary.

Include:
- The role the candidate is applying for
- Their strongest stated qualifications and why they want this role
- Specific projects, achievements, or skills they chose to highlight for this company
- Any claims that could be probed or tested in an interview

Be factual — only include what is explicitly stated. Keep under 250 words. Plain text only, no markdown.

Cover Letter:
{truncated}"""

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        response.raise_for_status()
        return response.json()["response"].strip()

def save_cover_letter(text: str, original_filename: str) -> dict:
    ensure_data_dir()
    with open(CL_TEXT_PATH, "w", encoding="utf-8") as f:
        f.write(text[:MAX_CL_CHARS])
    meta = {"filename": original_filename, "uploaded_at": datetime.now().isoformat()}
    with open(CL_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta

def save_cover_letter_summary(summary: str):
    ensure_data_dir()
    with open(CL_SUMMARY_PATH, "w", encoding="utf-8") as f:
        f.write(summary)

def get_cover_letter_status() -> dict | None:
    if not os.path.exists(CL_META_PATH): return None
    with open(CL_META_PATH, encoding="utf-8") as f:
        return json.load(f)

def get_cover_letter_summary() -> str | None:
    if not os.path.exists(CL_SUMMARY_PATH): return None
    with open(CL_SUMMARY_PATH, encoding="utf-8") as f:
        return f.read()

def delete_cover_letter():
    for path in [CL_TEXT_PATH, CL_SUMMARY_PATH, CL_META_PATH]:
        if os.path.exists(path): os.remove(path)
