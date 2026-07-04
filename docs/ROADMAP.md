# Frondly — Project Roadmap & Status

**Updated:** 2026-07-03 (after PRs #19 UI polish, #20 Forage Finds persistence,
#21 diagnose-note merged; two local branches open: `frondly/quick-fixes` +
`frondly/plant-detail`, stacked, pending PR)

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
│  ├─ (tabs)/care       Watering list (soonest/overdue first, mark-watered)   │
│  ├─ plant/[id]        Plant Detail + GrowthVine + DIAGNOSIS + watering card │
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
                                          │ ├─ POST /forage/identify        │
                                          │ │  (GeminiVision + PNW dataset) │
                                          │ └─ POST /plantcare/            │
                                          │    watering_schedule (PR #18)   │
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
| **Watering schedule** — Care tab list (soonest/overdue first) + live Plant Detail card; `POST /plantcare/watering_schedule` (source of truth) + TS offline fallback kept in sync via a shared golden fixture; mark-watered action finally writes `Plant.lastWatered` | PR #18 (open) |
| **Forage Finds persistence** — identified plants saved to a `finds` table + reactive finds list (was mock data) | PR #20 |
| **Diagnose → journal note** — save a chat reply as a plain Observation | PR #21 |
| UI polish (pixel-art placeholder, Leafy Pals header) | PR #19 |
| **Add-plant detail prompt** — "Choose from Photos" now routes into the manual form (name/species) instead of saving a bare "New plant" and bouncing home; manual form gained an optional inline photo picker | `frondly/quick-fixes` (local) |
| **Live garden score** — Home cards now re-render on observation inserts (observe the observations collection), so a fresh diagnosis updates the card, not just Plant Detail | `frondly/plant-detail` (local) |
| **Editable plant + journal note cards** — pencil → edit name/species; journal lists compact note cards opening a full-screen note view; never-watered plants show "Water when dry" not a dummy "Water in 7d" | `frondly/plant-detail` (local) |
| Backend: plantcare ADK agent + tools, forage identify, offline test suites (client jest 54, server 15) | — |

## Left for the app to fully work 🔨

Rough priority order:

1. **Room/Light persistence** — captured in Add Plant UI state, no columns on
   the Plant model yet (needs schema v3).
2. **Durable photo storage** — camera-cache URIs stored as-is for `heroPhoto`
   and diagnosis photos; migration plan calls for copying into app storage via
   `expo-file-system` (OS can evict cache).
3. **Base URL config** — `localhost:8000` hardcoded in `lib/api.ts`,
   `forage/api.ts`, and `lib/care.ts`; physical devices need a LAN IP
   (env/EAS config).

## Next milestone — AI-assisted plant identity + diagnose thread 🎯

Defined (deferred from the 2026-07-03 fixes round; the two big items the user
explicitly parked for "next milestone"):

1. **Agent-assisted name/species** — like Forage, let the agent suggest a
   plant's name + species from its photo and prefill the edit/add form (roadmap's
   old "Add Plant → Confirm & Save with AI prefill"). Edit screen
   (`plant/edit.tsx`) is the natural home for the "identify this plant" button.
2. **Diagnose message thread** — the diagnose screen is a single reply block, so
   a follow-up shows only the agent's answer, not the user's question
   (`plant/diagnose.tsx:35`, `:128`). Convert to a rendered user/agent thread.

Diagnose follow-ups (deliberate, listed in PR #17): severity not shown on the
result card; "Saved to journal ✓" renders before the async write confirms;
abnormal stream finishes (safety block / MAX_TOKENS) end as silent "done";
mock-XHR test for the SSE consume loop.

Watering schedule follow-ups (deliberate, listed in PR #18): endpoint doesn't
validate malformed `history[].date` (500 not 422 — no security risk, pure
computation); `useWateringSchedules` issues one request per plant rather than
a true batch endpoint; `scheduleStatus`'s "today" comparison is UTC-based;
golden fixture covers 5 of 8 species and no decimal rainfall case; manual
simulator verification of both screens (live sort/live mark-watered update)
still pending as of PR open; Plant Detail's "Watered in last 7d" card is
static copy shown whenever `lastWatered` is set, not a real days-since
countdown — add one once the offline fallback tracks watering history in a
way that renders down to a specific day count.

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
- Weather header shows no city/temp on a fresh simulator — `expo-location`
  returns no fix, and `lib/weather.ts` degrades to null by design. Set a
  simulator location (Xcode ▸ Features ▸ Location) or grant permission on
  device; a manual-city fallback is deferred to a settings screen.
- Adding a new Expo Router route needs a typegen pass (`expo start`) before
  `tsc` recognizes the typed `pathname`; stale `.expo/types/router.d.ts` shows
  up as false "not assignable" errors.
- Dev-machine note: ADK session state accumulates in gitignored
  `server/plantcare/.adk/`.
