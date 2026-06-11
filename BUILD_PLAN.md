# InterviewAI — Build Plan

Deferred features and ideas, in rough priority order. Nothing here is started.

## Show questions during Full Simulation (real-time)

The old "Always show question" checkbox was removed (v7.5.2) — it was pointless:
practice ("Generate Questions") has no TTS so it must always show the question, and
Full Simulation reads the question via TTS so it deliberately hides it.

Instead, add a dedicated toggle **on the Full Simulation window itself**:
- A switch that enables the question to be shown **in real time** as the interviewer asks it.
- Persists to memory (settings.json `always_show_question` or a new key) so the choice
  sticks across sessions.
- Only relevant to the Full Simulation / intense flow (the TTS-driven one), not practice.

## Two-interviewer simulation

Alternate between two named interviewer voices with different focus areas
(e.g. Interviewer A = product/design/process, Interviewer B = engineering/legacy/code).
Adds panel pressure and realism. TTS voice switching required.

## Topic map (dynamic JD-derived coverage plan) — "P2"

Before Q1, generate a hidden interview plan: a short JSON list of topics to cover,
derived from the JD + CV, each with `topic_key`, `evidence_from_jd`, `priority`,
`confidence`. Questions are then drawn from this plan rather than invented freeform.
Keep the fixed phase_map skeleton; the plan drives *substance*, the phase drives *shape*.
Cap ~8–12 topics, validate server-side, fall back to broad defaults if parsing fails.
AI-literacy topics surface only when the JD earns it (explicit or labeled inference).
