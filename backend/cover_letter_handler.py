import os, json, io
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CL_TEXT_PATH = os.path.join(DATA_DIR, "cover_letter.txt")
CL_META_PATH = os.path.join(DATA_DIR, "cover_letter_meta.json")
MAX_CL_CHARS = 8000

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

def save_cover_letter(text: str, original_filename: str) -> dict:
    ensure_data_dir()
    with open(CL_TEXT_PATH, "w", encoding="utf-8") as f:
        f.write(text[:MAX_CL_CHARS])
    meta = {"filename": original_filename, "uploaded_at": datetime.now().isoformat()}
    with open(CL_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta

def get_cover_letter_status() -> dict | None:
    if not os.path.exists(CL_META_PATH): return None
    with open(CL_META_PATH, encoding="utf-8") as f:
        return json.load(f)

def get_cover_letter_text() -> str | None:
    if not os.path.exists(CL_TEXT_PATH): return None
    with open(CL_TEXT_PATH, encoding="utf-8") as f:
        return f.read()

def delete_cover_letter():
    for path in [CL_TEXT_PATH, CL_META_PATH]:
        if os.path.exists(path): os.remove(path)
