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
  // Simulation fields
  sessionType: "practice",
  interviewer: null,
  jobDescription: "",
  alwaysShowQuestion: false,
  questionVisible: false,
  questionDelivered: true,
  holisticReview: null,
  // Intense Mode fields
  analyses: [],
  simulationRunId: null,
  intense: {
    sections: [],
    activeExchangeId: null,
  },
  recorder: { mediaRecorder: null, stream: null, chunks: [], timerInterval: null, seconds: 0 }
};

const SECTIONS = [
  { id: 'intro',      label: 'Introduction', questionIndices: [0] },
  { id: 'background', label: 'Background',   questionIndices: [1, 2] },
  { id: 'behavioral', label: 'Behavioural',  questionIndices: [3, 4] },
  { id: 'technical',  label: 'Technical',    questionIndices: [5, 6] },
  { id: 'closing',    label: 'Closing',      questionIndices: [7] },
];

function getSectionForQuestion(qIdx) {
  return SECTIONS.findIndex(s => s.questionIndices.includes(qIdx));
}

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
    jd:                  renderJdCard,
    question:            renderQuestionCard,
    recording:           renderQuestionCard,
    transcribing:        renderQuestionCard,
    transcript:          renderQuestionCard,
    analyzing:           renderQuestionCard,
    sim_analyzing:       renderQuestionCard,
    results:             renderResultsCard,
    done:                renderDoneCard,
    sim_loading:         renderSimLoadingCard,
    sim_between:         renderSimBetweenCard,
    sim_review_loading:  renderSimReviewLoadingCard,
    sim_holistic_review: renderSimHolisticReviewCard,
    // Intense Mode phases
    intense_question:    renderIntenseQuestionCard,
    intense_recording:   renderIntenseQuestionCard,
    intense_transcribing: renderIntenseQuestionCard,
    intense_thinking:     renderIntenseQuestionCard,
    intense_finalizing:  renderIntenseFinalizingCard
  };
  (map[state.phase] || renderJdCard)();

  const progress = document.getElementById("progress");
  const hideProgressPhases = ["jd", "done", "sim_loading", "sim_between", "sim_review_loading", "sim_holistic_review", "intense_transcribing", "intense_thinking", "intense_finalizing"];
  if (hideProgressPhases.includes(state.phase)) {
    progress.classList.add("hidden");
  } else {
    let progressText;
    if (state.sessionType === "simulation") {
      progressText = `Simulation — Question ${state.currentIndex + 1} of 8`;
    } else if (state.sessionType === "intense") {
      progressText = `Intense Mode — Question ${state.currentIndex + 1} of ${state.questions.length}`;
    } else {
      const modeLabel = state.interviewMode === "screening" ? "Screening" : "Technical";
      progressText = `${modeLabel} — Question ${state.currentIndex + 1} of ${state.questions.length}`;
    }
    progress.textContent = progressText;
    progress.classList.remove("hidden");
  }
}

// ── Card: Job Description ─────────────────────────────────────────────────────
function renderJdCard() {
  const isScreening = state.interviewMode === "screening";
  const cvLoaded = state.cvLoaded;
  const useCvDisabled = !cvLoaded ? "disabled" : "";
  const useCvChecked = cvLoaded && state.useCv ? "checked" : "";
  const alwaysShowChecked = state.alwaysShowQuestion ? "checked" : "";

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

      <div class="settings-row">
        <span class="mode-toggle-label">Display</span>
        <label class="toggle-label">
          <input type="checkbox" class="toggle-input" data-action="toggleAlwaysShow" ${alwaysShowChecked}>
          <span class="toggle-track"></span>
          <span class="toggle-text">Always show question</span>
        </label>
      </div>

      <div class="card-actions">
        <button class="btn primary" data-action="generate">Generate Questions</button>
        <button class="btn secondary" data-action="startSimulation">Full Simulation</button>
        <button class="btn danger" data-action="startIntense">Intense Simulation</button>
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
  const qObj = state.questions[state.currentIndex] || {};
  const q = qObj.text || "";
  const answer = state.answers[state.currentIndex] || {};
  const isSim = state.sessionType === "simulation";

  const isRecording = phase === "recording";
  const isBusy = phase === "transcribing" || phase === "analyzing" || phase === "sim_analyzing";
  const showTranscript = ["transcript", "analyzing"].includes(phase) && answer.transcript;
  const showAnalyse = phase === "transcript" && !isSim;
  const showRetry = (phase === "question" || phase === "transcript") && !isSim;
  const showTimer = isRecording;

  let recordLabel = "Start Recording";
  if (isRecording) recordLabel = "Stop Recording";
  if (isBusy) {
    if (phase === "transcribing") recordLabel = `<span class="spinner"></span> Transcribing...`;
    else if (phase === "sim_analyzing") recordLabel = `<span class="spinner"></span> Processing...`;
    else recordLabel = `<span class="spinner"></span> Analysing...`;
  }

  let statusText = "";
  if (phase === "transcribing") statusText = "Transcribing with Whisper...";
  if (phase === "analyzing") statusText = "Analysing — this may take 15–30 seconds...";
  if (phase === "sim_analyzing") statusText = "Interviewer is noting your response...";
  if (answer.error) statusText = answer.error;

  // Build question box HTML
  let questionBoxHtml;
  if (isSim) {
    const hidden = !state.alwaysShowQuestion && !state.questionVisible;
    const framingHtml = qObj.framing ? `<div class="sim-framing">${escHtml(qObj.framing)}</div>` : "";
    const eyeBtnHtml = !state.alwaysShowQuestion
      ? `<div class="eye-btn-row">
          <button class="eye-btn" id="eye-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Hold to reveal
          </button>
        </div>`
      : "";
    questionBoxHtml = `
      ${framingHtml}
      <div class="question-box${hidden ? " question-hidden" : ""}">${escHtml(q)}</div>
      ${eyeBtnHtml}
    `;
  } else {
    questionBoxHtml = `<div class="question-box">${escHtml(q)}</div>`;
  }

  setCard(`
    <div class="card">
      ${questionBoxHtml}
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
          <p class="transcript-text">${highlightTranscript(answer.transcript)}</p>
          ${showAnalyse ? `<button class="btn primary" data-action="analyze">Analyse Response</button>` : ""}
          ${(isBusy && !isSim) ? `<button class="btn primary" disabled><span class="spinner"></span> Analysing...</button>` : ""}
        </div>
      ` : ""}
      <div class="status">${escHtml(statusText)}</div>
    </div>
  `);

  // Wire up eye button for simulation
  if (isSim && !state.alwaysShowQuestion) {
    const eyeBtn = document.getElementById("eye-btn");
    if (eyeBtn) {
      const show = () => { state.questionVisible = true; render(); };
      const hide = () => { state.questionVisible = false; render(); };
      eyeBtn.addEventListener("pointerdown", show);
      eyeBtn.addEventListener("pointerup", hide);
      eyeBtn.addEventListener("pointercancel", hide);
      eyeBtn.addEventListener("pointerleave", hide);
    }
  }
}

// ── Card: Results ─────────────────────────────────────────────────────────────
function renderResultsCard() {
  const q = (state.questions[state.currentIndex] || {}).text || "";
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
        ${scoreCard("Overall", d.overall_score, d.overall_why)}
        ${scoreCard("Relevance", d.relevance_score, d.relevance_why)}
        ${scoreCard("Specificity", d.specificity_score, d.specificity_why)}
        ${scoreCard("Formality", d.formality_score, d.formality_why)}
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

  const sections = state.questions.map((qObj, i) => {
    const q = qObj.text || "";
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
          ${scoreCard("Overall", r.overall_score, r.overall_why)}
          ${scoreCard("Relevance", r.relevance_score, r.relevance_why)}
          ${scoreCard("Specificity", r.specificity_score, r.specificity_why)}
          ${scoreCard("Formality", r.formality_score, r.formality_why)}
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
            <p>${highlightTranscript(answer.transcript)}</p>
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
      <p class="done-avg">Average overall score: <strong>${avg}/10</strong> &nbsp;&middot;&nbsp; <span class="done-mode-inline">${modeLabel}</span></p>
      ${sections}
      <div class="results-actions">
        <button class="btn secondary" data-action="restart">Start Over</button>
        <button class="btn primary" data-action="download">Download PDF</button>
      </div>
    </div>
  `);
}

// ── Card: Simulation Loading ──────────────────────────────────────────────────
function renderSimLoadingCard() {
  setCard(`
    <div class="card">
      <h2>Preparing Your Interview</h2>
      <p class="sim-loading-text">Setting up your personalised simulation...</p>
      <div class="sim-loading-steps" id="sim-loading-steps">
        <div class="sim-loading-step active">Analysing the role...</div>
      </div>
      <div class="status"><span class="spinner"></span> This usually takes 20–30 seconds</div>
    </div>
  `);
}

// ── Card: Simulation Between Questions ───────────────────────────────────────
function renderSimBetweenCard() {
  const interviewer = state.interviewer || {};
  const justAnswered = state.questions[state.currentIndex];
  const phase = justAnswered ? justAnswered.phase : "intro";
  const isNextToLast = state.currentIndex === state.questions.length - 2;

  const acknowledgments = {
    intro: "Good, thanks for that. Let me ask about your background.",
    background: "Understood. Let me dig into something more specific.",
    behavioral: "Thank you. I want to explore your technical experience.",
    technical: isNextToLast
      ? "Great. I just have one final question for you."
      : "Noted. Let me ask you one more thing.",
    closing: null
  };
  const ackText = acknowledgments[phase] !== undefined ? acknowledgments[phase] : "Thank you. Let us continue.";
  const finalAck = ackText || "Thank you. Let us continue.";

  const isLastQuestion = state.currentIndex === state.questions.length - 1;

  setCard(`
    <div class="card sim-between-card">
      <div class="sim-interviewer-tag">${escHtml(interviewer.name || "Interviewer")} &middot; ${escHtml(interviewer.role || "")}</div>
      <p class="sim-ack-text">${escHtml(finalAck)}</p>
      <button class="btn primary" data-action="simContinue">${isLastQuestion ? "See Results" : "Continue"}</button>
    </div>
  `);
}

// ── Card: Simulation Review Loading ──────────────────────────────────────────
function renderSimReviewLoadingCard() {
  setCard(`
    <div class="card">
      <h2>Compiling Your Review</h2>
      <p class="sim-loading-text">Analysing your performance across all questions...</p>
      <div class="status"><span class="spinner"></span> This may take 30–45 seconds</div>
    </div>
  `);
}

// ── Card: Simulation Holistic Review ─────────────────────────────────────────
function renderSimHolisticReviewCard() {
  const r = state.holisticReview || {};

  if (r.error) {
    setCard(`
      <div class="card">
        <h2>Review Error</h2>
        <p style="color:var(--danger);margin-bottom:16px">${escHtml(r.error)}</p>
        <button class="btn secondary" data-action="restart">Start Over</button>
      </div>
    `);
    return;
  }

  // Hire signal badge class
  const signalMap = {
    "Strong Hire": "hire-strong",
    "Lean Hire": "hire-lean",
    "Mixed": "hire-mixed",
    "Lean No-Hire": "hire-lean-no",
    "No-Hire": "hire-no"
  };
  const hireClass = signalMap[r.hire_signal] || "hire-mixed";
  const avgScore = r.avg_score != null ? r.avg_score : "—";

  // Competency grid
  const competencyItems = (r.competencies || []).map(c => {
    const lvl = (c.evidence_level || "missing").toLowerCase().replace(/\s+/g, "-");
    return `
      <div class="competency-item">
        <div class="competency-name">${escHtml(c.name || c.competency || "")}</div>
        <span class="evidence-badge evidence-${lvl}">${escHtml(c.evidence_level || "Missing")}</span>
      </div>`;
  }).join("");

  // Strengths
  const strengths = (r.strengths || []).slice(0, 3).map(s => {
    const idxArr = s.question_indices || s.question_refs || [];
    const refs = Array.isArray(idxArr) ? idxArr.map(i => `Q${i + 1}`).join(", ") : "";
    return `
      <div class="sim-finding">
        <div class="sim-finding-title">${escHtml(s.title || s.strength || "")}</div>
        <div class="sim-finding-detail">${escHtml(s.detail || s.description || "")}</div>
        ${refs ? `<div class="sim-finding-refs">${escHtml(refs)}</div>` : ""}
      </div>`;
  }).join("");

  // Risks
  const risks = (r.risks || []).slice(0, 3).map(risk => {
    const idxArr = risk.question_indices || risk.question_refs || [];
    const refs = Array.isArray(idxArr) ? idxArr.map(i => `Q${i + 1}`).join(", ") : "";
    return `
      <div class="sim-finding">
        <div class="sim-finding-title">${escHtml(risk.title || risk.risk || "")}</div>
        <div class="sim-finding-detail">${escHtml(risk.detail || risk.description || "")}</div>
        ${refs ? `<div class="sim-finding-refs">${escHtml(refs)}</div>` : ""}
      </div>`;
  }).join("");

  // Best / worst answer
  const bestIdx = r.best_answer_idx;
  const worstIdx = r.worst_answer_idx;
  const bestQ = (bestIdx != null && state.questions[bestIdx]) ? state.questions[bestIdx].text : "";
  const worstQ = (worstIdx != null && state.questions[worstIdx]) ? state.questions[worstIdx].text : "";

  setCard(`
    <div class="card done-card">
      <div class="done-mode-badge">Simulation Complete</div>
      <h2>Interview Review</h2>

      <div style="text-align:center;margin-bottom:16px">
        <span class="hire-badge ${hireClass}">${escHtml(r.hire_signal || "Mixed")}</span>
        <p class="hire-reasoning" style="font-size:14px;color:var(--muted);margin-top:8px">${escHtml(r.hire_reasoning || "")}</p>
        ${r.next_round_probability != null ? `
          <div class="next-round-bar-wrap">
            <div class="next-round-label">Next Round Probability</div>
            <div class="next-round-bar"><div class="next-round-bar-fill" style="width:${r.next_round_probability}%"></div></div>
            <div class="next-round-pct">${r.next_round_probability}%</div>
            ${r.probability_reasoning ? `<div class="next-round-reason">${escHtml(r.probability_reasoning)}</div>` : ""}
          </div>
        ` : ""}
        <p class="done-avg" style="margin-top:8px">Average score: <strong>${avgScore}/10</strong> across ${state.questions.length} questions</p>
      </div>

      ${competencyItems ? `
        <div class="review-section-label">Competencies</div>
        <div class="competency-grid">${competencyItems}</div>
      ` : ""}

      ${strengths ? `
        <div class="review-section-label">Strengths</div>
        ${strengths}
      ` : ""}

      ${risks ? `
        <div class="review-section-label">Risks</div>
        ${risks}
      ` : ""}

      ${bestQ ? `
        <div class="review-section-label">Standout Answers</div>
        <div class="sim-answer-highlight best">
          <div class="sim-answer-highlight-label">Strongest answer — Q${(bestIdx + 1)}</div>
          <div style="font-size:13px;color:var(--muted)">${escHtml(bestQ)}</div>
        </div>
      ` : ""}

      ${worstQ ? `
        <div class="sim-answer-highlight worst">
          <div class="sim-answer-highlight-label">Needs work — Q${(worstIdx + 1)}</div>
          <div style="font-size:13px;color:var(--muted)">${escHtml(worstQ)}</div>
        </div>
      ` : ""}

      ${r.closing_question_notes ? `
        <div class="review-section-label">Closing Notes</div>
        <div class="sim-finding">
          <div class="sim-finding-detail">${escHtml(r.closing_question_notes)}</div>
        </div>
      ` : ""}

      ${r.coaching_focus ? `
        <div class="coaching-box">
          <h3>Coaching Focus</h3>
          <p>${escHtml(r.coaching_focus)}</p>
        </div>
      ` : ""}

      ${state.sessionType === "intense" ? (() => {
        const sections = (state.intense && state.intense.sections) ? state.intense.sections : [];
        if (!sections.length) return "";
        const failedSections = sections.filter(s => s.status === "failed");
        const errorsHtml = failedSections.length ? `
          <div class="intense-errors-box">
            <div class="intense-errors-title">⚠ ${failedSections.length} section${failedSections.length > 1 ? "s" : ""} could not be analysed</div>
            ${failedSections.map(s => `<div class="intense-error-item">${escHtml(s.label)}</div>`).join("")}
          </div>
        ` : "";
        const sectionCardsHtml = sections.map(sec => {
          const res = sec.result || {};
          const score = res.section_score;
          const exchanges = sec.exchanges || [];
          const exchangeHtml = exchanges.map(ex => {
            const isFollowUp = ex.kind === "follow_up";
            return `
              <div class="exchange-item ${isFollowUp ? "exchange-item--followup" : "exchange-item--question"}">${escHtml((isFollowUp ? "↳ " : "") + (ex.question || ""))}</div>
              <div class="exchange-item exchange-item--answer">${escHtml(ex.answer || "(no answer recorded)")}</div>
            `;
          }).join("");
          return `
            <div class="section-review-card">
              <div class="section-review-header">
                <span class="section-review-label">${escHtml(sec.label)}</span>
                ${score != null ? `<span class="section-score-badge">${score}/10</span>` : ""}
              </div>
              <div class="exchange-thread">${exchangeHtml || `<div class="exchange-item" style="color:var(--muted)">No exchanges recorded</div>`}</div>
              ${res.feedback ? `<div class="summary-feedback"><div class="transcript-label">Feedback</div><p>${escHtml(res.feedback)}</p></div>` : ""}
              ${res.section_why ? `<p style="font-size:12px;color:var(--muted);margin-top:4px">${escHtml(res.section_why)}</p>` : ""}
            </div>
          `;
        }).join("");
        return errorsHtml + `<div class="review-section-label">Section Breakdown</div>` + sectionCardsHtml;
      })() : ""}

      <div class="results-actions">
        <button class="btn secondary" data-action="restart">Start Over</button>
        <button class="btn primary" data-action="download">Download PDF</button>
      </div>
    </div>
  `);
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function scoreCard(label, value, why = null) {
  const v = Math.min(10, Math.max(0, Number(value) || 0));
  const whyHtml = why ? `<div class="score-why">${escHtml(why)}</div>` : "";
  return `
    <div class="score-card">
      <div class="score-label">${label}</div>
      <div class="score-value">${value != null ? v + "/10" : "—"}</div>
      <div class="score-bar"><div class="score-fill" style="width:${v * 10}%"></div></div>
      ${whyHtml}
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

const FILLER_RE = /\b(um+|uh+|like|you know|sort of|kind of|basically|whatever|stuff|i guess|i mean|okay|alright|right)\b/gi;

function highlightTranscript(text) {
  if (!text) return "";
  return escHtml(text).replace(
    // Re-run on escaped text — filler words contain no special chars so safe
    new RegExp(FILLER_RE.source, "gi"),
    match => `<mark class="filler-word">${match}</mark>`
  );
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCard(html, skipAnimation = false) {
  const container = document.getElementById("card-container");
  container.innerHTML = html;
  if (!skipAnimation) {
    container.classList.remove("fade-in");
    void container.offsetWidth;
    container.classList.add("fade-in");
  }
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

async function startRecording(targetPhase = "recording", onStopFn = stopAndTranscribe) {
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
    mr.onstop = onStopFn;
    mr.onerror = () => {
      stopTimer();
      setStatus("Recording error — please try again.");
      setState({ phase: "question" });
    };
    mr.start();
    startTimer();
    setState({ phase: targetPhase });
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
    state.answers = answers;

    if (state.sessionType === "simulation") {
      await autoAnalyzeSimulation();
    } else {
      setState({ phase: "transcript", answers });
    }
  } catch (e) {
    setState({ phase: "question" });
    setAnswerError("Transcription error: " + e.message);
  }
}

// ── Intense Mode ─────────────────────────────────────────────────────────────

// TTS helpers
function abortIntenseRun() {
  state.simulationRunId = null;
  cancelSpeech();
  stopTimer();
  const { mediaRecorder, stream } = state.recorder;
  // Detach onstop so if the recorder stop event fires, nothing advances
  if (mediaRecorder) mediaRecorder.onstop = null;
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (stream) stream.getTracks().forEach(t => t.stop());
  state.recorder.mediaRecorder = null;
  state.recorder.stream = null;
  state.recorder.chunks = [];
}

function speakText(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

function cancelSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// Deliver question via TTS then auto-start recording
function initIntenseSections() {
  state.intense.sections = SECTIONS.map(s => ({
    ...s,
    exchanges: [],
    result: null,
    status: 'pending',
    followUpCount: 0,
  }));
}

async function deliverQuestion(qIdx, runId) {
  if (state.simulationRunId !== runId) return;
  const exchangeId = Date.now() + '-' + Math.random();
  state.intense.activeExchangeId = exchangeId;

  const qObj = state.questions[qIdx] || {};
  const framing = qObj.framing ? qObj.framing + ' ' : '';
  const qText = qObj.text || '';

  const sIdx = getSectionForQuestion(qIdx);
  if (sIdx >= 0) state.intense.sections[sIdx].status = 'active';

  setState({ phase: 'intense_question', currentIndex: qIdx, questionVisible: false });
  await speakText(framing + qText);
  if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;
  await startRecordingIntense(qIdx, sIdx, runId, exchangeId, qText, 'original');
}

async function startRecordingIntense(qIdx, sIdx, runId, exchangeId, questionText, kind) {
  if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;
  if (_recordingStarting) return;
  _recordingStarting = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    state.recorder.stream = stream;
    state.recorder.mediaRecorder = mr;
    state.recorder.chunks = [];
    const localChunks = [];
    mr.ondataavailable = e => { if (e.data.size > 0) localChunks.push(e.data); };
    mr.onstop = () => {
      if (state.simulationRunId === runId && state.intense.activeExchangeId === exchangeId) {
        stopAndTranscribeIntense(qIdx, sIdx, runId, exchangeId, localChunks, questionText, kind);
      }
    };
    mr.onerror = () => { stopTimer(); };
    mr.start();
    startTimer();
    setState({ phase: 'intense_recording' });
  } catch (e) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (qIdx === 0 && kind === 'original') {
      setState({ phase: 'jd', sessionType: 'practice' });
      const statusEl = document.getElementById('jd-status');
      if (statusEl) statusEl.textContent = 'Microphone access denied -- Intense Mode requires mic access.';
      return;
    }
    advanceIntense(qIdx, sIdx, runId);
  } finally {
    _recordingStarting = false;
  }
}

async function stopAndTranscribeIntense(qIdx, sIdx, runId, exchangeId, localChunks, questionText, kind) {
  if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;

  const { stream } = state.recorder;
  if (stream) stream.getTracks().forEach(t => t.stop());

  const blob = localChunks && localChunks.length ? new Blob(localChunks, { type: 'audio/webm' }) : null;

  if (!blob || blob.size === 0) {
    advanceIntense(qIdx, sIdx, runId);
    return;
  }

  setState({ phase: 'intense_transcribing' });
  let transcript = '';
  try {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    const data = await requestJson(API + '/transcribe', { method: 'POST', body: formData });
    transcript = (data.transcript || '').trim();
  } catch (e) {
    console.error('[Intense] Transcription failed:', e.message);
    advanceIntense(qIdx, sIdx, runId);
    return;
  }

  if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;

  const section = state.intense.sections[sIdx];
  section.exchanges.push({ kind, question: questionText, answer: transcript });

  const answers = [...state.answers];
  answers[qIdx] = { ...(answers[qIdx] || {}), transcript, audioBlob: blob };
  state.answers = answers;

  await checkFollowUp(transcript, questionText, qIdx, sIdx, runId, exchangeId, kind);
}

async function checkFollowUp(transcript, questionText, qIdx, sIdx, runId, exchangeId, kind) {
  if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;

  const section = state.intense.sections[sIdx];
  const followUpCount = section.followUpCount;

  if (kind === 'follow_up' || followUpCount >= 2 || section.id === 'closing') {
    advanceIntense(qIdx, sIdx, runId);
    return;
  }

  setState({ phase: 'intense_thinking' });

  try {
    const conversation = section.exchanges.slice(0, -1).map(ex => ({
      question: ex.question,
      answer: ex.answer,
    }));

    const data = await requestJson(API + '/follow-up-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_description: state.jobDescription,
        interview_mode: state.interviewMode,
        section_id: section.id,
        section_label: section.label,
        original_question: section.exchanges.find(e => e.kind === 'original')?.question || questionText,
        conversation,
        latest_answer: transcript,
        follow_up_count: followUpCount,
        max_follow_ups: 2,
      })
    });

    if (state.simulationRunId !== runId || state.intense.activeExchangeId !== exchangeId) return;

    if (data.decision === 'follow_up' && data.text) {
      section.followUpCount++;
      const followUpText = data.text;
      const newExchangeId = Date.now() + '-' + Math.random();
      state.intense.activeExchangeId = newExchangeId;

      setState({ phase: 'intense_question' });
      await speakText(followUpText);
      if (state.simulationRunId !== runId || state.intense.activeExchangeId !== newExchangeId) return;
      await startRecordingIntense(qIdx, sIdx, runId, newExchangeId, followUpText, 'follow_up');
    } else {
      if (data.text) await speakText(data.text);
      if (state.simulationRunId !== runId) return;
      advanceIntense(qIdx, sIdx, runId);
    }
  } catch (e) {
    console.error('[Intense] Follow-up check failed:', e.message);
    advanceIntense(qIdx, sIdx, runId);
  }
}

function advanceIntense(qIdx, sIdx, runId) {
  if (state.simulationRunId !== runId) return;

  const section = state.intense.sections[sIdx];
  const questionIndices = section.questionIndices;
  const posInSection = questionIndices.indexOf(qIdx);
  const nextQIdxInSection = posInSection >= 0 && posInSection < questionIndices.length - 1
    ? questionIndices[posInSection + 1]
    : null;

  if (nextQIdxInSection !== null) {
    deliverQuestion(nextQIdxInSection, runId);
    return;
  }

  section.status = 'complete';
  const nextSIdx = sIdx + 1;
  if (nextSIdx < SECTIONS.length) {
    const nextSection = state.intense.sections[nextSIdx];
    deliverQuestion(nextSection.questionIndices[0], runId);
  } else {
    setState({ phase: 'intense_finalizing' });
    finalizeIntense(runId);
  }
}

async function finalizeIntense(runId) {
  if (state.simulationRunId !== runId) return;

  state.analyses = state.questions.map(() => null);
  render();

  for (let sIdx = 0; sIdx < state.intense.sections.length; sIdx++) {
    if (state.simulationRunId !== runId) return;
    const section = state.intense.sections[sIdx];

    if (!section.exchanges.length) {
      section.status = 'failed';
      section.questionIndices.forEach(qi => {
        const analyses = [...state.analyses];
        analyses[qi] = { status: 'failed', result: null, error: 'No exchanges recorded' };
        state.analyses = analyses;
      });
      render();
      continue;
    }

    section.questionIndices.forEach(qi => {
      const analyses = [...state.analyses];
      analyses[qi] = { status: 'pending', result: null, error: null };
      state.analyses = analyses;
    });
    render();

    try {
      const result = await requestJson(API + '/analyze-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: state.jobDescription,
          interview_mode: state.interviewMode,
          section_id: section.id,
          section_label: section.label,
          exchanges: section.exchanges,
        })
      });
      section.result = result;
      section.status = 'complete';
      section.questionIndices.forEach(qi => {
        const analyses = [...state.analyses];
        analyses[qi] = { status: 'success', result: { result }, error: null };
        state.analyses = analyses;
      });
    } catch (e) {
      section.status = 'failed';
      section.questionIndices.forEach(qi => {
        const analyses = [...state.analyses];
        analyses[qi] = { status: 'failed', result: null, error: e.message };
        state.analyses = analyses;
      });
    }
    render();
  }

  if (state.simulationRunId !== runId) return;

  try {
    const sectionsPayload = state.intense.sections.map(s => ({
      id: s.id,
      label: s.label,
      exchanges: s.exchanges,
      result: s.result,
    }));
    const review = await requestJson(API + '/intense-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_description: state.jobDescription,
        interview_mode: state.interviewMode,
        sections: sectionsPayload,
      })
    });
    if (state.simulationRunId !== runId) return;
    setState({ phase: 'sim_holistic_review', holisticReview: review });
  } catch (e) {
    if (state.simulationRunId !== runId) return;
    setState({ phase: 'sim_holistic_review', holisticReview: { error: e.message } });
  }
}
function renderIntenseQuestionCard() {
  const phase = state.phase;
  const idx   = state.currentIndex;
  const qObj  = state.questions[idx] || {};
  const total = state.questions.length;
  const isRecording    = phase === 'intense_recording';
  const isTranscribing = phase === 'intense_transcribing';
  const isThinking     = phase === 'intense_thinking';
  const isSpeaking     = phase === 'intense_question';
  const interviewer = state.interviewer || {};
  const interviewerLabel = [interviewer.name, interviewer.role].filter(Boolean).join(' - ') || 'Interviewer';

  const sectionDotsHtml = state.intense.sections.map((s, i) => {
    const isCurrent = getSectionForQuestion(idx) === i;
    let cls = 'section-dot';
    if (s.status === 'complete') cls += ' section-dot--complete';
    else if (s.status === 'failed') cls += ' section-dot--failed';
    else if (isCurrent) cls += ' section-dot--active';
    return '<div class="' + cls + '"><div class="section-dot-circle"></div><div class="section-dot-label">' + escHtml(s.label) + '</div></div>';
  }).join('');

  let stateIndicator = '';
  if (isSpeaking) {
    stateIndicator = '<div class="intense-status tts-speaking"><span class="tts-pulse"></span> Interviewer speaking...</div>';
  } else if (isTranscribing) {
    stateIndicator = '<div class="intense-transcribing-indicator"><div class="transcribing-bar"></div><div class="transcribing-bar"></div><div class="transcribing-bar"></div><div class="transcribing-bar"></div><div class="transcribing-bar"></div><span style="margin-left:4px">Transcribing...</span></div>';
  } else if (isThinking) {
    stateIndicator = '<div class="intense-thinking-indicator"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div><span style="margin-left:4px">Interviewer is thinking...</span></div>';
  }

  const container = document.getElementById('card-container');
  const existing = container.querySelector('.intense-card');

  if (existing) {
    const secDots = existing.querySelector('.intense-sections');
    if (secDots) secDots.innerHTML = sectionDotsHtml;

    const progressEl = existing.querySelector('.intense-progress');
    if (progressEl) progressEl.textContent = 'Q' + (idx + 1) + ' of ' + total;

    const qBox = existing.querySelector('.question-box');
    if (qBox) qBox.textContent = qObj.text || '';

    const stateEl = existing.querySelector('.intense-state-indicator');
    if (stateEl) stateEl.innerHTML = stateIndicator;

    let recState  = existing.querySelector('.intense-recording-state');
    let waitState = existing.querySelector('.intense-waiting-state');

    if (isRecording && !recState) {
      if (waitState) waitState.remove();
      const div = document.createElement('div');
      div.className = 'intense-recording-state';
      div.innerHTML =
        '<div class="intense-status">Listening...</div>' +
        '<div class="record-controls">' +
          '<button class="btn record recording intense-stop-btn" data-action="intenseStop">Stop</button>' +
          '<div class="timer" id="timer">' + formatTime(state.recorder.seconds) + '</div>' +
        '</div>' +
        '<p class="intense-status">Your answer is being recorded.</p>';
      existing.appendChild(div);
    } else if (!isRecording && recState) {
      recState.remove();
    }

    if (!isRecording && !waitState) {
      const div = document.createElement('div');
      div.className = 'intense-waiting-state';
      div.innerHTML = '<p class="intense-status">Recording starts automatically when speaking finishes.</p>';
      existing.appendChild(div);
    } else if (isRecording && waitState) {
      waitState.remove();
    }
    return;
  }

  setCard(
    '<div class="card intense-card">' +
      '<div class="intense-interviewer">' + escHtml(interviewerLabel) + '</div>' +
      '<div class="intense-header">' +
        '<span class="intense-mode-badge">Intense Mode</span>' +
        '<span class="intense-progress">Q' + (idx + 1) + ' of ' + total + '</span>' +
      '</div>' +
      '<div class="intense-sections">' + sectionDotsHtml + '</div>' +
      '<div class="intense-state-indicator">' + stateIndicator + '</div>' +
      '<div class="question-box">' + escHtml(qObj.text || '') + '</div>' +
      (isRecording
        ? '<div class="intense-recording-state">' +
            '<div class="intense-status">Listening...</div>' +
            '<div class="record-controls">' +
              '<button class="btn record recording intense-stop-btn" data-action="intenseStop">Stop</button>' +
              '<div class="timer" id="timer">' + formatTime(state.recorder.seconds) + '</div>' +
            '</div>' +
            '<p class="intense-status">Your answer is being recorded.</p>' +
          '</div>'
        : '<div class="intense-waiting-state">' +
            '<p class="intense-status">Recording starts automatically when speaking finishes.</p>' +
          '</div>') +
    '</div>'
  );
}

function renderIntenseFinalizingCard() {
  const sections = state.intense.sections;
  const total    = sections.length;
  const done     = sections.filter(s => s.status === 'complete' || s.status === 'failed').length;
  const current  = sections.findIndex(s => s.status === 'active' || s.status === 'pending');

  const sectionDotsHtml = sections.map(s => {
    let cls = 'section-dot';
    if (s.status === 'complete') cls += ' section-dot--complete';
    else if (s.status === 'failed') cls += ' section-dot--failed';
    else if (s.status === 'active') cls += ' section-dot--active';
    return '<div class="' + cls + '"><div class="section-dot-circle"></div><div class="section-dot-label">' + escHtml(s.label) + '</div></div>';
  }).join('');

  const statusLine = current >= 0
    ? 'Analysing: ' + escHtml(sections[current].label) + ' (' + (done + 1) + ' of ' + total + ')'
    : done < total
      ? 'Finishing up...'
      : 'Compiling your interview review...';

  setCard(
    '<div class="card">' +
      '<h2>Analysing your interview</h2>' +
      '<div class="intense-sections" style="margin:20px 0">' + sectionDotsHtml + '</div>' +
      '<p class="sim-loading-text">' + statusLine + '</p>' +
      '<div class="status"><span class="spinner"></span> ' + done + ' of ' + total + ' sections analysed</div>' +
    '</div>'
  );
}
async function autoAnalyzeSimulation() {
  const idx = state.currentIndex;
  const answer = state.answers[idx];
  const q = state.questions[idx] || {};

  setState({ phase: "sim_analyzing" });

  try {
    const data = await requestJson(`${API}/analyze-simulation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_obj: {
          phase: q.phase,
          question: q.text,
          framing: q.framing,
          competency: q.competency,
          evaluation_mode: q.evaluationMode
        },
        transcript: answer.transcript,
        interview_mode: state.interviewMode
      })
    });
    if (state.currentIndex !== idx) return;
    const answers = [...state.answers];
    answers[idx] = { ...answer, result: data };
    setState({ answers, phase: "sim_between", questionVisible: false });
  } catch (e) {
    if (state.currentIndex !== idx) return;
    const answers = [...state.answers];
    answers[idx] = { ...answer, error: "Analysis failed: " + e.message };
    setState({ phase: "sim_between", answers, questionVisible: false });
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
      body: JSON.stringify({
        interview_mode: state.interviewMode,
        use_cv: state.useCv && state.cvLoaded,
        always_show_question: state.alwaysShowQuestion
      })
    });
  } catch (e) { console.error("saveSettings failed:", e); }
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
      const rawQuestions = data.questions || [];
      if (!rawQuestions.length) throw new Error("No questions returned.");
      const questions = rawQuestions.map(q => ({
        text: q,
        phase: null,
        framing: null,
        competency: null,
        evaluationMode: "star"
      }));
      setState({ phase: "question", questions, currentIndex: 0, answers: [], sessionType: "practice", jobDescription: jd });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Generate Questions";
      document.getElementById("jd-status").textContent = "Error: " + e.message;
    }
  },

  startSimulation: async () => {
    const textarea = document.getElementById("jd-input");
    const jd = textarea ? textarea.value.trim() : "";
    if (!jd) {
      document.getElementById("jd-status").textContent = "Please paste a job description first.";
      return;
    }

    setState({ phase: "sim_loading", sessionType: "simulation", jobDescription: jd });

    try {
      const data = await requestJson(`${API}/generate-simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jd,
          interview_mode: state.interviewMode,
          use_cv: state.useCv && state.cvLoaded
        })
      });

      const questions = (data.questions || []).map(q => ({
        text: q.question,
        phase: q.phase,
        framing: q.framing,
        competency: q.competency,
        evaluationMode: q.evaluation_mode
      }));

      if (!questions.length) throw new Error("No questions returned");

      setState({
        phase: "question",
        questions,
        currentIndex: 0,
        answers: [],
        interviewer: data.interviewer || {},
        questionVisible: false
      });
    } catch (e) {
      setState({ phase: "jd", sessionType: "practice" });
      const statusEl = document.getElementById("jd-status");
      if (statusEl) statusEl.textContent = "Simulation error: " + e.message;
    }
  },

  simContinue: async () => {
    const isLast = state.currentIndex === state.questions.length - 1;
    if (isLast) {
      setState({ phase: "sim_review_loading" });
      try {
        const answersPayload = state.answers.map((a, i) => ({
          question_text: (state.questions[i] || {}).text || "",
          phase: (state.questions[i] || {}).phase || "general",
          competency: (state.questions[i] || {}).competency || "general",
          evaluation_mode: (state.questions[i] || {}).evaluationMode || "star",
          transcript: a.transcript || "",
          result: a.result || {}
        }));
        const review = await requestJson(`${API}/simulation-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_description: state.jobDescription,
            interview_mode: state.interviewMode,
            answers: answersPayload
          })
        });
        setState({ phase: "sim_holistic_review", holisticReview: review });
      } catch (e) {
        setState({ phase: "sim_holistic_review", holisticReview: { error: e.message } });
      }
    } else {
      setState({ phase: "question", currentIndex: state.currentIndex + 1, questionVisible: false });
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
          question: (state.questions[idx] || {}).text || "",
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
    abortIntenseRun();
    window.location.reload();
  },

  shutdown: async () => {
    abortIntenseRun();
    setCard(`
      <div class="card">
        <h2>InterviewAI Stopped</h2>
        <p class="sim-loading-text">You can close this tab now. Run start.bat when you want to use it again.</p>
      </div>
    `);
    fetch(`${API}/shutdown`, { method: "POST", keepalive: true }).catch(() => {});
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
  },

  toggleAlwaysShow: async (e) => {
    state.alwaysShowQuestion = e.target.checked;
    await saveSettings();
  },

  uploadCv: handleCvUpload,

  startIntense: async () => {
    const textarea = document.getElementById("jd-input");
    const jd = textarea ? textarea.value.trim() : "";
    if (!jd) {
      document.getElementById("jd-status").textContent = "Please paste a job description first.";
      return;
    }

    const runId = Date.now();
    setState({
      phase: "sim_loading",
      sessionType: "intense",
      jobDescription: jd,
      simulationRunId: runId,
      analyses: [],
      questions: [],
      answers: []
    });

    try {
      const data = await requestJson(`${API}/generate-simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jd,
          interview_mode: state.interviewMode,
          use_cv: state.useCv && state.cvLoaded
        })
      });

      const questions = (data.questions || []).map(q => ({
        text: q.question,
        phase: q.phase,
        framing: q.framing,
        competency: q.competency,
        evaluationMode: q.evaluation_mode
      }));

      if (!questions.length) throw new Error("No questions returned");
      if (state.simulationRunId !== runId) return;

      state.questions = questions;
      state.analyses  = questions.map(() => null);
      state.currentIndex = 0;
      state.answers = [];
      state.interviewer = data.interviewer || {};
      initIntenseSections();

      deliverQuestion(0, runId);
    } catch (e) {
      if (state.simulationRunId !== runId) return;
      setState({ phase: "jd", sessionType: "practice" });
      const statusEl = document.getElementById("jd-status");
      if (statusEl) statusEl.textContent = "Intense Mode error: " + e.message;
    }
  },

  intenseStop: () => {
    stopTimer();
    const { mediaRecorder } = state.recorder;
    // Do NOT stop stream tracks here — stopping them synchronously before onstop fires
    // causes the MediaRecorder to flush an empty/header-only WebM blob.
    // Stream tracks are stopped inside stopAndTranscribeIntense after onstop fires.
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  },

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
    state.alwaysShowQuestion = settings.always_show_question ?? false;

    if (cvStatus.loaded) {
      state.cvLoaded = true;
      state.cvFilename = cvStatus.filename || null;
    }
  } catch (_) { /* fall through with defaults */ }

  render();
}

boot();
