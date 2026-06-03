"""
Isolated Whisper test harness for InterviewAI.
Tests the transcribe() function end-to-end without needing the browser or FastAPI.

Usage (from C:\\InterviewAI):
  .\\venv\\Scripts\\python.exe test_whisper.py

What it does:
  1. Generates TTS audio via Windows SAPI (no mic needed)
  2. Saves it as WAV (or WebM if ffmpeg available)
  3. Runs transcribe() on each clip and reports pass/fail
  4. Runs 3 clips back-to-back to confirm no hang on Q2/Q3
"""
import sys
import os
import time
import subprocess
import tempfile

# Add backend to path so we can import whisper_handler directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

# Single import — one module instance, one CUDA context, one _force_cpu flag
import whisper_handler

# ──────────────────────────────────────────────
# 1.  Audio generation via Windows SAPI TTS
# ──────────────────────────────────────────────

TEST_PHRASES = [
    "I have three years of experience working with Python and FastAPI building REST APIs for financial services companies.",
    "In my previous role I led a team of five engineers to deliver a real-time data pipeline that processed over one million events per day.",
    "I am passionate about clean code and I always write unit tests before shipping any feature to production.",
]

def generate_wav_sapi(text: str, out_path: str) -> bool:
    """Use Windows SAPI via PowerShell to synthesise speech to a WAV file."""
    ps_script = f"""
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile('{out_path}')
$synth.Speak('{text.replace("'", "''")}')
$synth.SetOutputToDefaultAudioDevice()
"""
    result = subprocess.run(
        ["powershell.exe", "-NonInteractive", "-Command", ps_script],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        print(f"  [SAPI ERROR] {result.stderr.strip()}")
        return False
    if not os.path.exists(out_path) or os.path.getsize(out_path) < 1000:
        print(f"  [SAPI ERROR] Output file missing or too small: {out_path}")
        return False
    return True


def wav_to_webm(wav_path: str, webm_path: str) -> bool:
    """Re-encode WAV → WebM/Opus using ffmpeg (matching what Chrome sends)."""
    # Try common ffmpeg locations on Windows
    ffmpeg_candidates = [
        "ffmpeg",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ]
    ffmpeg_exe = None
    for candidate in ffmpeg_candidates:
        try:
            r = subprocess.run([candidate, "-version"], capture_output=True, timeout=5)
            if r.returncode == 0:
                ffmpeg_exe = candidate
                break
        except (FileNotFoundError, OSError):
            continue

    if ffmpeg_exe is None:
        return False  # ffmpeg not available — caller will use WAV

    result = subprocess.run(
        [ffmpeg_exe, "-y", "-i", wav_path, "-c:a", "libopus", "-b:a", "64k", webm_path],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        return False
    return os.path.exists(webm_path) and os.path.getsize(webm_path) > 0


# ──────────────────────────────────────────────
# 2.  Test runner
# ──────────────────────────────────────────────

def run_test(idx: int, phrase: str) -> dict:
    print(f"\n{'='*60}")
    print(f"  TEST {idx+1}/{len(TEST_PHRASES)}")
    print(f"  Expected: {phrase[:70]}...")
    print(f"{'='*60}")

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path  = os.path.join(tmpdir, f"test_{idx}.wav")
        webm_path = os.path.join(tmpdir, f"test_{idx}.webm")

        # Generate speech
        t0 = time.time()
        print(f"  [1/3] Generating TTS audio...")
        if not generate_wav_sapi(phrase, wav_path):
            return {"idx": idx, "status": "FAIL", "reason": "TTS generation failed"}
        wav_size = os.path.getsize(wav_path)
        print(f"  [1/3] WAV ready: {wav_size:,} bytes ({time.time()-t0:.1f}s)")

        # Try to convert to WebM; fall back to WAV bytes if ffmpeg unavailable
        print(f"  [2/3] Converting to WebM...")
        if wav_to_webm(wav_path, webm_path):
            audio_path = webm_path
            fmt = "WebM"
        else:
            audio_path = wav_path
            fmt = "WAV (ffmpeg unavailable)"
        audio_bytes = open(audio_path, "rb").read()
        print(f"  [2/3] {fmt}: {len(audio_bytes):,} bytes")

        # Transcribe
        print(f"  [3/3] Transcribing (this may take 30-120s on first call)...")
        t1 = time.time()
        try:
            result = whisper_handler.transcribe(audio_bytes)
            elapsed = time.time() - t1
            print(f"  [3/3] Done in {elapsed:.1f}s")
            print(f"  RESULT: {result!r}")
            # Very loose correctness check — a few key words must appear
            key_words = phrase.lower().split()[:3]
            hit = any(w in result.lower() for w in key_words)
            status = "PASS" if result.strip() and hit else ("PARTIAL" if result.strip() else "EMPTY")
            return {"idx": idx, "status": status, "transcript": result, "elapsed": elapsed}
        except Exception as e:
            elapsed = time.time() - t1
            print(f"  [3/3] EXCEPTION after {elapsed:.1f}s: {e}")
            return {"idx": idx, "status": "FAIL", "reason": str(e), "elapsed": elapsed}


# ──────────────────────────────────────────────
# 3.  Main
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  InterviewAI — Whisper isolation test")
    print("="*60)

    print("\n[PRE-FLIGHT] Loading Whisper model...")
    t_load = time.time()
    model = whisper_handler.get_model()
    print(f"[PRE-FLIGHT] Model loaded in {time.time()-t_load:.1f}s")
    print(f"[PRE-FLIGHT] _force_cpu={whisper_handler._force_cpu}")

    results = []
    for i, phrase in enumerate(TEST_PHRASES):
        results.append(run_test(i, phrase))

    # Summary
    print("\n" + "="*60)
    print("  SUMMARY")
    print("="*60)
    for r in results:
        status  = r["status"]
        elapsed = r.get("elapsed", 0)
        transcript = r.get("transcript", r.get("reason", ""))[:80]
        print(f"  Q{r['idx']+1}: {status:8s}  {elapsed:5.1f}s  {transcript!r}")

    passed  = sum(1 for r in results if r["status"] in ("PASS", "PARTIAL"))
    failed  = sum(1 for r in results if r["status"] in ("FAIL", "EMPTY"))
    print(f"\n  {passed}/{len(results)} passed  |  {failed} failed")
    sys.exit(0 if failed == 0 else 1)
