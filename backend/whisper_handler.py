from faster_whisper import WhisperModel
import tempfile
import threading
import os

_model = None
_force_cpu = False
# Serialize all transcription calls — the GPU model is not safe for concurrent use
_lock = threading.Lock()

def get_model():
    global _model, _force_cpu
    if _model is None:
        if _force_cpu:
            print("Loading Whisper base model on CPU...")
            _model = WhisperModel("base", device="cpu", compute_type="int8")
            print("Whisper model ready (CPU / int8).")
            return _model
        try:
            print("Loading Whisper base model on CUDA...")
            _model = WhisperModel("base", device="cuda", compute_type="int8")
            print("Whisper model ready (CUDA / int8).")
        except Exception as e:
            print(f"CUDA load failed ({e}), falling back to CPU...")
            _model = WhisperModel("base", device="cpu", compute_type="int8")
            print("Whisper model ready (CPU / int8).")
    return _model

def transcribe(audio_bytes: bytes) -> str:
    global _model, _force_cpu
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    print(f"[Whisper] received {len(audio_bytes)} bytes")
    try:
        with _lock:  # Serializes both model init and inference — no concurrent GPU use
            model = get_model()
            try:
                segments, _ = model.transcribe(
                    tmp_path,
                    beam_size=5,
                    language="en",
                    vad_filter=False,
                    condition_on_previous_text=False,
                )
                # IMPORTANT: segments is a generator — evaluate it inside this
                # try block so any CUDA errors during inference are caught here.
                return " ".join(seg.text.strip() for seg in segments)
            except Exception as e:
                if not any(keyword in str(e).lower() for keyword in ("cublas", "cuda", "cudnn")):
                    raise
                print(f"WARNING: CUDA transcription failed ({e}), forcing CPU fallback...")
                _model = None
                _force_cpu = True
                model = WhisperModel("base", device="cpu", compute_type="int8")
                _model = model
                segments, _ = model.transcribe(
                    tmp_path,
                    beam_size=5,
                    language="en",
                    vad_filter=False,
                    condition_on_previous_text=False,
                )
                return " ".join(seg.text.strip() for seg in segments)
    finally:
        os.unlink(tmp_path)
