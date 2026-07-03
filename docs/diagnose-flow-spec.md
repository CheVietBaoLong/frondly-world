# Diagnose Flow — Design Spec

**Date:** 2026-07-02 · **Status:** approved

Wire Plant Detail's inert "Diagnose with a photo" CTA to the FastAPI plantcare
agent (Gemini via ADK): photo + plant context in, streamed reply out, diagnosis
auto-saved as an `Observation`. This is the app's headline feature and the last
big gap in the migration plan (`docs/react-native-migration-design.md`, "Data
flow — Diagnose").

## Decisions (made during brainstorm)

- **Flow shape:** one-shot diagnose + follow-up questions. Tap CTA → pick a
  photo → the agent's reply streams in → diagnosis card appears and the
  Observation is saved automatically → the user may keep asking text-only
  follow-ups in the same session.
- **Transport:** ADK's streaming route `POST /run_sse`, parsed client-side.
  RN's fetch cannot stream response bodies, so SSE rides on XHR `onprogress`
  (incremental `responseText`) — the same native-networking path
  `forage/api.ts` already uses for uploads. No new server endpoints.
- **Health score + confidence come from the agent:** extend
  `record_diagnosis` with `health_score` (0–100 int) and `confidence`
  (0.0–1.0 float). Gemini judges them from the photo. This makes diagnoses
  plottable on the GrowthVine and turns Plant Detail's hardcoded
  "Confidence 94%" chip into real data.
- **Photo source:** `expo-image-picker` (`launchCameraAsync` /
  `launchImageLibraryAsync` with `base64: true, quality: 0.7`) — already
  installed, returns base64 directly, no new dependencies, mirrors Add Plant.
- **Scope cut:** no full chat tab (the migration plan's `diagnose.tsx` tab is
  superseded by this per-plant flow), no durable photo copying (deferred
  alongside `heroPhoto`), no auth, base URL stays hardcoded like forage.

## Server changes

### `server/plantcare/tools/record.py` (edit)

Extend the signature — the tool remains a structured-output checkpoint that
stores nothing:

```python
def record_diagnosis(
    problem: str,
    severity: str,
    health_score: int,
    confidence: float,
    care_steps: list[str],
) -> str:
```

Docstring documents: `health_score` — overall plant health 0–100 judged from
the photo and history; `confidence` — how sure the diagnosis is, 0.0–1.0.
Update the `record_diagnosis` line in `plantcare/agent.py`'s instruction to
mention the two new args. Update `tests/test_plantcare_tools.py` accordingly.

## Client changes

### `client/src/lib/api.ts` (new)

The module the root README has referenced all along. Contents:

- `const API_BASE = "http://localhost:8000"` — same hardcoded-for-dev story
  and dev-note as `forage/api.ts`.
- `ADK_APP_NAME` — the agent app name as served by ADK. Deliberately NOT
  named `APP_NAME`: this is the agents-dir *package folder* name (expected
  `"plantcare"`), easy to confuse with the agent's `name` field
  (`"plant_care"`) — the constant's name and comment must say which one it
  is. **Verify during implementation** with `curl localhost:8000/list-apps`.
- `createSession(): Promise<string>` — `POST
  /apps/{ADK_APP_NAME}/users/frondly/sessions`, returns the session id.
  Single-user app → constant `user_id = "frondly"`.
- `type Diagnosis = { problem: string; severity: "low" | "medium" | "high";
  healthScore: number; confidence: number; careSteps: string[] }`.
- `sendMessage(sessionId, parts, { onText, onDiagnosis, onDone, onError })` —
  `POST /run_sse` with `{ app_name, user_id, session_id, new_message: { role:
  "user", parts }, streaming: true }`; XHR `onprogress` feeds an incremental
  SSE parser; each `data:` line is one ADK Event JSON. Text parts →
  `onText(fullTextSoFar)`; a `record_diagnosis` function-call event →
  validate/clamp args → `onDiagnosis(diagnosis)`. XHR timeout 90 s.
  **Verify during implementation** whether event JSON uses `functionCall` or
  `function_call` casing (one curl probe against the running server). Wrap
  the answer in one distinctly named helper, `functionCallsOfEvent(event)`,
  that accepts both casings — no other code touches the raw field name, so a
  future ADK upgrade can't silently break extraction.
- Pure, exported, jest-testable helpers (no network): `parseSseChunks(buffer)`
  → complete `data:` payloads + remainder, and `extractDiagnosis(event)` →
  `Diagnosis | null` (maps the tool call's snake_case args to the camelCase
  `Diagnosis`, clamps score to 0–100, confidence to 0–1, defaults severity
  to `"medium"` if out of enum).
- `buildDiagnoseParts(plant, observations, base64Jpeg)` — one text part
  (plant profile: name, species, lat/lon, last-watered + one history line per
  observation, oldest→newest: date, score, note — all of them; journals are
  small — ending with the ask to diagnose from the photo) + one
  `inline_data: { mime_type: "image/jpeg", data: base64 }` part.

### `client/src/db/` — schema v2 (edit)

- `schema.ts`: version 2; `observations` gains
  `{ name: "confidence", type: "number", isOptional: true }`.
- `migrations.ts` (new): `schemaMigrations` with `toVersion: 2`,
  `addColumns` for that column; wire `migrations` into the adapter in
  `db/index.ts`.
- `models/Observation.ts`: add the `confidence` field.

### `client/src/app/plant/diagnose.tsx` (new screen)

Route `app/plant/diagnose.tsx` with `?id=<plantId>` (static route beats the
`[id]` dynamic sibling in expo-router). Four states in one screen:

1. **pick** — two buttons: "Take photo" / "Choose from library"
   (ImagePicker). Preview the chosen image, "Diagnose" button sends.
2. **sending** — photo thumbnail + the agent's reply streaming into a text
   block (`onText`).
3. **diagnosed** — `onDiagnosis` fires: `db.write` creates the Observation
   `{ note: problem, severity, healthScore, confidence, careSteps:
   JSON, photo: pickedUri, date: now }`, linked to the plant. Show the
   diagnosis card (problem, severity, care steps, confidence) with a
   "Saved to journal" confirmation. Every `record_diagnosis` event saves one
   Observation — including any from follow-ups.
4. **follow-up** — text input pinned below; sends text-only parts on the
   same session, replies stream into the same conversation view.

Styling follows existing screens (paper background, `SectionLabel`,
`AssistantCard`/card idioms, tokens).

### `client/src/app/plant/[id].tsx` (edit)

- Enable the CTA: remove `disabled`/opacity, `onPress={() =>
  router.push(`/plant/diagnose?id=${id}`)}`; drop its dev-note.
- Confidence chip: replace the static `Confidence 94%` with
  `Confidence {Math.round(confidence * 100)}%` from the latest observation's
  stored value; hide the chip when the latest observation has none (seed
  data). Drop that dev-note. (`use-plant-detail.ts` VM gains `confidence:
  number | null`.)

## Error handling

- Session-create or SSE failure, HTTP ≥ 400, or timeout → error state on the
  diagnose screen with a retry button; **nothing is written to the DB**.
- Agent finishes without calling `record_diagnosis` (e.g., asks for a better
  photo) → show the reply, save nothing; the follow-up input lets the user
  answer.
- Malformed function-call args → clamp/default per `extractDiagnosis`, still
  save.

## Testing

- **Jest (`client/src/lib/__tests__/api.test.ts`):** `parseSseChunks`
  (partial chunk, multiple events in one chunk, event split across chunks)
  and `extractDiagnosis` (happy path, clamping, bad severity, non-diagnosis
  event → null) against fixture JSON. Pure functions, no network mocks.
- **Pytest:** updated `record_diagnosis` signature test in
  `tests/test_plantcare_tools.py`.
- **Live verification:** `uv run uvicorn main:app --reload` + simulator;
  diagnose a seeded plant, confirm the reply streams, the Observation lands
  on the GrowthVine, and the confidence chip shows the real value.

## Known ceilings (dev-notes in code)

- Base URL hardcoded `localhost:8000` (same as forage) — env/EAS config later.
- Photo URI stored as-is; durable copy via `expo-file-system` is its own
  deferred item alongside `heroPhoto`.
- One-shot + follow-ups, not a persistent chat: leaving the screen ends the
  session; history is the saved Observations.
