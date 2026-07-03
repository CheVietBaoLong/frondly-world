# Frondly — Project Roadmap & Status

**Updated:** 2026-07-02 (after PR #17, Diagnose flow)

One-page tracker: what's built, what's left for the app to fully work, and what's
parked. Details live in the per-feature specs (`docs/*-spec.md`) and the
migration plan (`docs/react-native-migration-design.md`).

## System sketch

```
┌────────────────────────── iPhone / Android device ──────────────────────────┐
│                                                                             │
│  Expo Router UI (NativeWind)                                                │
│  ├─ (tabs)/index      Garden Home (reactive cards + live weather card)      │
│  ├─ (tabs)/add        Add Plant (camera / library / manual)                 │
│  ├─ (tabs)/forage     Forage capture → forage/result, finds, species        │
│  ├─ (tabs)/care       ── ComingSoon placeholder ──                          │
│  ├─ plant/[id]        Plant Detail + GrowthVine + DIAGNOSIS card            │
│  └─ plant/diagnose    photo → streamed agent reply → saved diagnosis        │
│         │                                      │                            │
│         │ observe() (reactive)                 │ lib/api.ts                 │
│  ┌──────▼──────────┐   ┌──────────────┐        │ (ADK session + /run_sse    │
│  │ WatermelonDB v2 │   │ lib/weather  │        │  SSE-over-XHR streaming)   │
│  │ Plant           │   │ (Open-Meteo, │        │ forage/api.ts              │
│  │ Observation     │   │  direct)     │        │ (multipart upload)         │
│  └─────────────────┘   └──────┬───────┘        │                            │
└───────────────────────────────┼────────────────┼────────────────────────────┘
                                │ https          │ http://localhost:8000 (dev)
                        ┌───────▼──────┐  ┌──────▼──────────────────────────┐
                        │  Open-Meteo  │  │ FastAPI (server/, uv + uvicorn) │
                        │  (no key)    │  │ ├─ ADK routes: sessions, run_sse│
                        └──────────────┘  │ │   plantcare agent (Gemini 2.5)│
                                          │ │   tools: weather, decline,    │
                                          │ │   schedule, record_diagnosis  │
                                          │ └─ POST /forage/identify        │
                                          │    (GeminiVision + PNW dataset) │
                                          │ Stateless — persists nothing;   │
                                          │ all user data stays on-device.  │
                                          └─────────────────────────────────┘
```

## Implemented ✅

| Piece | Where / PR |
|---|---|
| Expo scaffold, NativeWind tokens, fonts, tab bar | Slice 1 |
| WatermelonDB models (Plant, Observation), seed garden, reactive hooks | Slice 1 |
| Plant Detail + GrowthVine timeline | Slice 2 |
| Camera capture: Forage + Add Plant flows | PR #13, #14 |
| Real plant identification (`/forage/identify`, safety states, lookalikes) | PR #13 |
| Android dev build (RN 0.85 / SDK 56) | PR #11 |
| iOS dev build (simdjson/CocoaPods autolinking fix) | PR #16 |
| Live weather card (Open-Meteo + expo-location, 30-min cache) | PR #16 |
| **Diagnose flow** — photo → Gemini agent → streamed reply → Observation auto-saved (health score + confidence), follow-ups on same session; schema v2 migration | PR #17 |
| Backend: plantcare ADK agent + tools, forage identify, offline test suites (client jest 36, server 21) | — |

## Left for the app to fully work 🔨

Rough priority order:

1. **Care tab** — still a `ComingSoon` placeholder. Natural home for watering
   schedule (the agent's `watering_schedule` tool exists server-side; the
   "Water Thursday" card on Plant Detail is still static copy).
2. **Forage Finds persistence** — finds screen reads mock data
   (`forage/data.ts`); identified plants aren't saved anywhere.
3. **Add Plant → Confirm & Save with AI prefill** — mockup shows AI-suggested
   name/room/light; current flow saves a bare Plant + photo.
4. **Room/Light persistence** — captured in Add Plant UI state, no columns on
   the Plant model yet (needs schema v3).
5. **Durable photo storage** — camera-cache URIs stored as-is for `heroPhoto`
   and diagnosis photos; migration plan calls for copying into app storage via
   `expo-file-system` (OS can evict cache).
6. **Base URL config** — `localhost:8000` hardcoded in `lib/api.ts` and
   `forage/api.ts`; physical devices need a LAN IP (env/EAS config).

Diagnose follow-ups (deliberate, listed in PR #17): severity not shown on the
result card; "Saved to journal ✓" renders before the async write confirms;
abnormal stream finishes (safety block / MAX_TOKENS) end as silent "done";
mock-XHR test for the SSE consume loop.

## Open questions on hold ❓

- **Auth + multi-device sync** — Firebase Auth for identity is plausible, but
  WatermelonDB sync needs its own pull/push endpoints: FastAPI is the natural
  fit (server gains a DB — a big architectural shift from "stateless, all data
  on-device"), Firestore is not. Needs its own brainstorm/spec.
- **EAS project ownership** — whose Expo account owns builds so the non-Mac
  teammate can produce iOS builds (open since the collaboration started).
- **Workflow** — main has branch protection ("changes via PR"); admin pushes
  have bypassed it twice for doc-fix commits. Decide: PRs for everything?

## Repo health / chores 🧹

- `tsc --noEmit` fails in all `__tests__` files (jest globals missing from
  tsconfig types) — pre-existing, repo-wide, needs a small tsconfig chore.
- One pre-existing lint error in `use-color-scheme.web.ts` (web-only).
- jest doesn't exit after passing (WatermelonDB open handles) — use
  `--forceExit` or kill after the summary.
- Two moderate Dependabot alerts open on GitHub.
- Teammate note: after pulling config-plugin changes, stale `ios/` dirs need
  `npx expo prebuild --platform ios --clean`.
- Dev-machine note: ADK session state accumulates in gitignored
  `server/plantcare/.adk/`.
