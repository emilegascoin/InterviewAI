from faster_whisper import WhisperModel
import tempfile
import os

_model = None

def get_model():
    global _model
    if _model is None:
        try:
            print("Loading Whisper large-v2 model on CUDA...")
            _model = WhisperModel("large-v2", device="cuda", compute_type="float16")
            print("Whisper model ready (CUDA / float16).")
        except Exception as e:
            print(f"CUDA load failed ({e}), falling back to CPU...")
            _model = WhisperModel("large-v2", device="cpu", compute_type="int8")
            print("Whisper model ready (CPU / int8).")
    return _model

def transcribe(audio_bytes: bytes) -> str:
    model = get_model()
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        segments, _ = model.transcribe(
            tmp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(seg.text.strip() for seg in segments)
    finally:
        os.unlink(tmp_path)
