const API = "http://localhost:8000";

const state = {
  phase: "jd",
  questions: [],
  currentIndex: 0,
  answers: [],
  interviewMode: "technical",
  useCv: false,
  cvLoaded: false,
  cvFilename: null,
  recorder: { mediaRecorder: null, stream: null, chunks: [], timerInterval: null, seconds: 0 }
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ── Fetch helper ─────────────────────────────────────────────────────────────
async function requestJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || res.statusText);
  return data;
}

// ── Render dispatcher ─────────────────────────────────────────────────────────
function render() {
  const map = {
    jd:          renderJdCard,
    question:    renderQuestionCard,
    recording:   renderQuestionCard,
    transcribing:renderQuestionCard,
    transcript:  renderQuestionCard,
    analyzing:   renderQuestionCard,
    results:     renderResultsCard,
    done:        renderDoneCard
  };
  (map[state.phase] || renderJdCard)();

  const progress = document.getElementById("progress");
  if (["jd", "done"].includes(state.phase)) {
    progress.classList.add("hidden");
  } else {
    const modeLabel = state.interviewMode === "screening" ? "Screening" : "Technical";
    progress.textContent = `${modeLabel} — Question ${state.currentIndex + 1} of ${state.questions.length}`;
    progress.classList.remove("hidden");
  }
}

// ── Card: Job Description ─────────────────────────────────────────────────────
function renderJdCard() {
  const isScreening = state.interviewMode === "screening";
  const cvLoaded = state.cvLoaded;
  const useCvDisabled = !cvLoaded ? "disabled" : "";
  const useCvChecked = cvLoaded && state.useCv ? "checked" : "";

  const cvSection = cvLoaded
    ? `<div class="cv-loaded">
        <svg class="cv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="cv-filename">${escHtml(state.cvFilename || "CV loaded")}</span>
        <button class="cv-delete" data-action="deleteCv" title="Remove CV">✕</button>
       </div>`
    : `<label class="btn secondary cv-upload-btn" for="cv-file-input">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload CV
       </label>
       <input type="file" id="cv-file-input" accept=".pdf,.docx,.txt" style="display:none">`;

  setCard(`
    <div class="card">
      <h2>Paste Job Description</h2>
      <textarea id="jd-input" placeholder="Paste the job description here..."></textarea>

      <div class="mode-toggle-row">
        <span class="mode-toggle-label">Interview Type</span>
        <div class="mode-toggle">
          <button class="mode-btn${isScreening ? " active" : ""}" data-action="setMode" data-mode="screening">Screening</button>
          <button class="mode-btn${!isScreening ? " active" : ""}" data-action="setMode" data-mode="technical">Technical</button>
        </div>
      </div>

      <div class="cv-row">
        <span class="mode-toggle-label">CV</span>
        <div class="cv-controls">
          ${cvSection}
          <label class="toggle-label ${!cvLoaded ? "toggle-label--disabled" : ""}">
            <input type="checkbox" class="toggle-input" data-action="toggleUseCv" ${useCvChecked} ${useCvDisabled}>
            <span class="toggle-track"></span>
            <span class="toggle-text">Use CV</span>
          </label>
        </div>
        <div class="cv-status" id="cv-status"></div>
      </div>

      <div class="card-actions">
        <button class="btn primary" data-action="generate">Generate Questions</button>
      </div>
      <div class="status" id="jd-status"></div>
    </div>
  `);

  // Wire up file input (not caught by delegation since it's a change event)
  const fileInput = document.getElementById("cv-file-input");
  if (fileInput) {
    fileInput.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (file) await actions.uploadCv(file);
      fileInput.value = "";
    });
  }
}

// ── Card: Question / Record / Transcribe / Analyse ───────────────────────────
function renderQuestionCard() {
  const phase = state.phase;
  const q = state.questions[state.currentIndex];
  const answer = state.answers[state.currentIndex] || {};

  const isRecording = phase === "recording";
  const isBusy = phase === "transcribing" || phase === "analyzing";
  const showTranscript = ["transcript", "analyzing"].includes(phase) && answer.transcript;
  const showAnalyse = phase === "transcript";
  const showRetry = phase === "question" || phase === "transcript";
  const showTimer = isRecording;

  let recordLabel = "Start Recording";
  if (isRecording) recordLabel = "Stop Recording";
  if (isBusy) recordLabel = `<span class="spinner"></span> ${phase === "transcribing" ? "Transcribing..." : "Analysing..."}`;

  let statusText = "";
  if (phase === "transcribing") statusText = "Transcribing with Whisper...";
  if (phase === "analyzing") statusText = "Analysing — this may take 15–30 seconds...";
  if (answer.error) statusText = answer.error;

  setCard(`
    <div class="card">
      <div class="question-box">${escHtml(q)}</div>
      <div class="record-controls">
        <button class="btn record${isRecording ? " recording" : ""}" data-action="record" ${isBusy ? "disabled" : ""}>
          ${recordLabel}
        </button>
        <div class="timer${showTimer ? "" : " hidden"}" id="timer">
          ${formatTime(state.recorder.seconds)}
        </div>
      </div>
      ${showRetry ? `<button class="btn secondary retry-btn" data-action="retry">Try Again</button>` : ""}
      ${showTranscript ? `
        <div class="transcript-box">
          <div class="transcript-label">Transcript</div>
          <p class="transcript-text">${escHtml(answer.transcript)}</p>
          ${showAnalyse ? `<button class="btn primary" data-action="analyze">Analyse Response</button>` : ""}
          ${isBusy ? `<button class="btn primary" disabled><span class="spinner"></span> Analysing...</button>` : ""}
        </div>
      ` : ""}
      <div class="status">${escHtml(statusText)}</div>
    </div>
  `);
}

// ── Card: Results ─────────────────────────────────────────────────────────────
function renderResultsCard() {
  const q = state.questions[state.currentIndex];
  const answer = state.answers[state.currentIndex] || {};
  const d = answer.result || {};
  const isLast = state.currentIndex === state.questions.length - 1;
  const isTechnical = state.interviewMode === "technical";

  const star = d.star_coverage || {};
  const rawLabel = (d.formality_label || "Neutral").toLowerCase();
  const formalityLabel = ["informal", "neutral", "professional"].includes(rawLabel) ? rawLabel : "neutral";

  const starBlock = isTechnical ? `
    <div class="star-grid">
      <div class="star-label">STAR Coverage</div>
      <div class="star-items">
        ${starItem("Situation", star.situation)}
        ${starItem("Task", star.task)}
        ${starItem("Action", star.action)}
        ${starItem("Result", star.result)}
      </div>
    </div>` : "";

  setCard(`
    <div class="card">
      <div class="question-box">${escHtml(q)}</div>

      <div class="scores-grid">
        ${scoreCard("Overall", d.overall_score)}
        ${scoreCard("Relevance", d.relevance_score)}
        ${scoreCard("Specificity", d.specificity_score)}
        ${scoreCard("Formality", d.formality_score)}
        ${fillerCard(d.filler_words ?? 0)}
      </div>

      <div class="formality-badge-row">
        <span class="formality-badge ${formalityLabel}">${escHtml(d.formality_label || "Neutral")}</span>
        <span class="formality-notes">${escHtml(d.formality_notes || "")}</span>
      </div>

      ${starBlock}

      <div class="feedback-box">
        <h3>Feedback</h3>
        <p>${escHtml(d.feedback || "")}</p>
      </div>

      <div class="sample-box">
        <h3>Sample Response</h3>
        <p>${escHtml(d.sample_response || "")}</p>
      </div>

      <div class="results-actions">
        <button class="btn secondary" data-action="retry">Try Again</button>
        <button class="btn primary" data-action="next">${isLast ? "Finish" : "Next Question"}</button>
      </div>
    </div>
  `);
}

// ── Card: Done ────────────────────────────────────────────────────────────────
function renderDoneCard() {
  const scores = state.answers.map(a => (a.result || {}).overall_score).filter(s => s != null);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const isTechnical = state.interviewMode === "technical";
  const modeLabel = isTechnical ? "Technical" : "Screening";

  const sections = state.questions.map((q, i) => {
    const answer = state.answers[i] || {};
    const r = answer.result || {};
    const rawLabel = (r.formality_label || "Neutral").toLowerCase();
    const formalityLabel = ["informal", "neutral", "professional"].includes(rawLabel) ? rawLabel : "neutral";
    const star = r.star_coverage || {};

    const starMini = isTechnical ? `
      <div class="star-items" style="margin-left:auto">
        ${starItem("S", star.situation)}
        ${starItem("T", star.task)}
        ${starItem("A", star.action)}
        ${starItem("R", star.result)}
      </div>` : "";

    return `
      <div class="summary-section">
        <div class="summary-q-header">
          <span class="summary-q-num">Q${i + 1}</span>
          <span class="summary-q-text">${escHtml(q)}</span>
        </div>

        <div class="scores-grid">
          ${scoreCard("Overall", r.overall_score)}
          ${scoreCard("Relevance", r.relevance_score)}
          ${scoreCard("Specificity", r.specificity_score)}
          ${scoreCard("Formality", r.formality_score)}
          ${fillerCard(r.filler_words ?? 0)}
        </div>

        <div class="summary-row-inline">
          <span class="formality-badge ${formalityLabel}">${escHtml(r.formality_label || "Neutral")}</span>
          <span class="formality-notes">${escHtml(r.formality_notes || "")}</span>
          ${starMini}
        </div>

        ${answer.transcript ? `
          <div class="summary-transcript">
            <div class="transcript-label">Your Answer</div>
            <p>${escHtml(answer.transcript)}</p>
          </div>
        ` : ""}

        ${r.feedback ? `
          <div class="summary-feedback">
            <div class="transcript-label">Feedback</div>
            <p>${escHtml(r.feedback)}</p>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  setCard(`
    <div class="card done-card">
      <div class="done-mode-badge">${modeLabel} Interview</div>
      <h2>Interview Complete</h2>
      <p class="done-avg">Average overall score: <strong>${avg}/10</strong> &nbsp;·&nbsp; <span class="done-mode-inline">${modeLabel}</span></p>
      ${sections}
      <div class="results-actions">
        <button class="btn secondary" data-action="restart">Start Over</button>
        <button class="btn primary" data-action="download">Download PDF</button>
      </div>
    </div>
  `);
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function scoreCard(label, value) {
  const v = Math.min(10, Math.max(0, Number(value) || 0));
  return `
    <div class="score-card">
      <div class="score-label">${label}</div>
      <div class="score-value">${value != null ? v + "/10" : "—"}</div>
      <div class="score-bar"><div class="score-fill" style="width:${v * 10}%"></div></div>
    </div>`;
}

function fillerCard(count) {
  return `
    <div class="score-card">
      <div class="score-label">Filler Words</div>
      <div class="score-value">${count}</div>
      <div class="score-sub">detected</div>
    </div>`;
}

function starItem(label, covered) {
  return `<span class="star-item ${covered ? "covered" : "missing"}">${label}</span>`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCard(html) {
  const container = document.getElementById("card-container");
  container.innerHTML = html;
  container.classList.remove("fade-in");
  void container.offsetWidth;
  container.classList.add("fade-in");
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(state.recorder.timerInterval);
  state.recorder.seconds = 0;
  state.recorder.timerInterval = setInterval(() => {
    state.recorder.seconds++;
    const el = document.getElementById("timer");
    if (el) el.textContent = formatTime(state.recorder.seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(state.recorder.timerInterval);
  state.recorder.timerInterval = null;
}

// ── Recording ─────────────────────────────────────────────────────────────────
let _recordingStarting = false;

async function startRecording() {
  if (_recordingStarting) return;
  _recordingStarting = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    state.recorder.stream = stream;
    state.recorder.mediaRecorder = mr;
    state.recorder.chunks = [];
    mr.ondataavailable = e => { if (e.data.size > 0) state.recorder.chunks.push(e.data); };
    mr.onstop = stopAndTranscribe;
    mr.onerror = () => {
      stopTimer();
      setStatus("Recording error — please try again.");
      setState({ phase: "question" });
    };
    mr.start();
    startTimer();
    setState({ phase: "recording" });
  } catch (e) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStatus("Microphone access denied: " + e.message);
  } finally {
    _recordingStarting = false;
  }
}

function stopRecording() {
  stopTimer();
  const { mediaRecorder, stream } = state.recorder;
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (stream) stream.getTracks().forEach(t => t.stop());
}

async function stopAndTranscribe() {
  const { chunks } = state.recorder;
  if (!chunks.length) {
    setState({ phase: "question" });
    setAnswerError("No audio captured — please try again.");
    return;
  }
  const blob = new Blob(chunks, { type: "audio/webm" });
  if (blob.size === 0) {
    setState({ phase: "question" });
    setAnswerError("No audio captured — please try again.");
    return;
  }

  setState({ phase: "transcribing" });

  try {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    const data = await requestJson(`${API}/transcribe`, { method: "POST", body: formData });
    const transcript = data.transcript?.trim();
    if (!transcript) {
      setState({ phase: "question" });
      setAnswerError("No speech detected — please try again.");
      return;
    }
    const answers = [...state.answers];
    answers[state.currentIndex] = { ...(answers[state.currentIndex] || {}), transcript, error: null };
    setState({ phase: "transcript", answers });
  } catch (e) {
    setState({ phase: "question" });
    setAnswerError("Transcription error: " + e.message);
  }
}

function setAnswerError(msg) {
  const answers = [...state.answers];
  answers[state.currentIndex] = { ...(answers[state.currentIndex] || {}), error: msg };
  state.answers = answers;
  const el = document.querySelector(".status");
  if (el) el.textContent = msg;
}

function setStatus(msg) {
  const el = document.querySelector(".status");
  if (el) el.textContent = msg;
}

// ── CV upload handler ─────────────────────────────────────────────────────────
async function handleCvUpload(file) {
  const statusEl = document.getElementById("cv-status");
  if (statusEl) statusEl.textContent = "Uploading and summarising CV…";

  // Disable upload button during upload
  const uploadBtn = document.querySelector(".cv-upload-btn");
  if (uploadBtn) uploadBtn.style.opacity = "0.5";

  try {
    const formData = new FormData();
    formData.append("file", file);
    const data = await requestJson(`${API}/cv/upload`, { method: "POST", body: formData });
    setState({ cvLoaded: true, cvFilename: data.filename, useCv: true });
    await saveSettings();
  } catch (e) {
    if (statusEl) statusEl.textContent = "Upload failed: " + e.message;
    if (uploadBtn) uploadBtn.style.opacity = "1";
  }
}

async function saveSettings() {
  try {
    await requestJson(`${API}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interview_mode: state.interviewMode, use_cv: state.useCv && state.cvLoaded })
    });
  } catch (e) { console.error('saveSettings failed:', e); }
}

// ── Actions ───────────────────────────────────────────────────────────────────
const actions = {
  generate: async () => {
    const textarea = document.getElementById("jd-input");
    const jd = textarea?.value.trim();
    if (!jd) { document.getElementById("jd-status").textContent = "Please paste a job description first."; return; }

    const btn = document.querySelector("[data-action='generate']");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';
    document.getElementById("jd-status").textContent = "Asking the model to generate questions...";

    try {
      const data = await requestJson(`${API}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jd,
          interview_mode: state.interviewMode,
          use_cv: state.useCv && state.cvLoaded
        })
      });
      const questions = data.questions || [];
      if (!questions.length) throw new Error("No questions returned.");
      // Lock mode once questions are generated
      setState({ phase: "question", questions, currentIndex: 0, answers: [] });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Generate Questions";
      document.getElementById("jd-status").textContent = "Error: " + e.message;
    }
  },

  record: async () => {
    if (state.phase === "question") {
      await startRecording();
    } else if (state.phase === "recording") {
      stopRecording();
    } else if (state.phase === "transcript") {
      stopRecording();
      const answers = [...state.answers];
      answers[state.currentIndex] = {};
      setState({ phase: "question", answers });
      await startRecording();
    }
  },

  analyze: async () => {
    const idx = state.currentIndex;
    const answer = state.answers[idx] || {};
    if (!answer.transcript) return;
    setState({ phase: "analyzing" });
    try {
      const data = await requestJson(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: state.questions[idx],
          transcript: answer.transcript,
          interview_mode: state.interviewMode
        })
      });
      if (state.currentIndex !== idx) return;
      const answers = [...state.answers];
      answers[idx] = { ...answer, result: data };
      setState({ phase: "results", answers });
    } catch (e) {
      if (state.currentIndex !== idx) return;
      const answers = [...state.answers];
      answers[idx] = { ...answer, error: "Analysis error: " + e.message };
      setState({ phase: "transcript", answers });
    }
  },

  retry: () => {
    stopRecording();
    const answers = [...state.answers];
    answers[state.currentIndex] = {};
    setState({ phase: "question", answers });
  },

  next: () => {
    if (state.currentIndex < state.questions.length - 1) {
      setState({ phase: "question", currentIndex: state.currentIndex + 1 });
    } else {
      setState({ phase: "done" });
    }
  },

  download: () => window.print(),

  restart: () => {
    stopRecording();
    window.location.reload();
  },

  setMode: async (e) => {
    const mode = e.target.closest("[data-mode]")?.dataset.mode;
    if (!mode || mode === state.interviewMode) return;
    state.interviewMode = mode;
    await saveSettings();
    render();
  },

  toggleUseCv: async (e) => {
    if (!state.cvLoaded) return;
    state.useCv = e.target.checked;
    await saveSettings();
    // No full re-render needed; checkbox is already in correct visual state
  },

  uploadCv: handleCvUpload,

  deleteCv: async () => {
    try {
      await requestJson(`${API}/cv`, { method: "DELETE" });
      setState({ cvLoaded: false, cvFilename: null, useCv: false });
    } catch (e) {
      const statusEl = document.getElementById("cv-status");
      if (statusEl) statusEl.textContent = "Failed to remove CV: " + e.message;
    }
  }
};

// ── Event delegation ──────────────────────────────────────────────────────────
document.getElementById("card-container").addEventListener("click", async e => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (actions[action]) await actions[action](e);
});

// Also handle checkbox change via delegation
document.getElementById("card-container").addEventListener("change", async e => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (actions[action]) await actions[action](e);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const [settings, cvStatus] = await Promise.all([
      requestJson(`${API}/settings`).catch(() => ({})),
      requestJson(`${API}/cv/status`).catch(() => ({}))
    ]);

    if (settings.interview_mode) state.interviewMode = settings.interview_mode;
    if (settings.use_cv != null) state.useCv = settings.use_cv;

    if (cvStatus.loaded) {
      state.cvLoaded = true;
      state.cvFilename = cvStatus.filename || null;
    }
  } catch (_) { /* fall through with defaults */ }

  render();
}

boot();
