"""Local Piper TTS handler.

Lazy-loads the en_US-lessac-high voice on first call (thread-safe).
Auto-downloads the .onnx and .onnx.json voice files if missing.
Exposes synthesize(text) -> bytes (WAV).
"""

import io
import threading
import urllib.request
import wave
from pathlib import Path

_VOICES_DIR = Path(__file__).parent / "voices"
_MODEL_NAME = "en_US-lessac-high"
_ONNX_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
    "/en/en_US/lessac/high/en_US-lessac-high.onnx"
)
_JSON_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
    "/en/en_US/lessac/high/en_US-lessac-high.onnx.json"
)

_lock = threading.Lock()
_voice = None  # PiperVoice, loaded on first call


def _ensure_voice_files() -> Path:
    """Download voice files into the voices directory if not already present."""
    _VOICES_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = _VOICES_DIR / f"{_MODEL_NAME}.onnx"
    json_path = _VOICES_DIR / f"{_MODEL_NAME}.onnx.json"

    if not onnx_path.exists():
        print(f"[tts_handler] Downloading {onnx_path.name} …", flush=True)
        urllib.request.urlretrieve(_ONNX_URL, onnx_path)
        print(f"[tts_handler] Downloaded {onnx_path.name}", flush=True)

    if not json_path.exists():
        print(f"[tts_handler] Downloading {json_path.name} …", flush=True)
        urllib.request.urlretrieve(_JSON_URL, json_path)
        print(f"[tts_handler] Downloaded {json_path.name}", flush=True)

    return onnx_path


def _get_voice():
    """Return the (lazily loaded) PiperVoice instance."""
    global _voice
    if _voice is not None:
        return _voice

    with _lock:
        if _voice is None:
            from piper.voice import PiperVoice  # deferred import

            onnx_path = _ensure_voice_files()
            print(f"[tts_handler] Loading voice {_MODEL_NAME} …", flush=True)
            _voice = PiperVoice.load(str(onnx_path))
            print("[tts_handler] Voice loaded.", flush=True)

    return _voice


def synthesize(text: str) -> bytes:
    """Synthesize *text* and return raw WAV bytes."""
    voice = _get_voice()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    return buf.getvalue()
