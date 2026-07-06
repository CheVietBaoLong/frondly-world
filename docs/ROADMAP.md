# Frondly — Project Roadmap & Status

**Updated:** 2026-07-05 (PRs #22 quick-fixes, #23 plant-detail, #24
plant-identity, #25 diagnose-thread, #26 weather-cf, #27 room-light-persistence
all merged; Durable photo storage built on `frondly/durable-photo-storage`,
pending PR)

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
                                          │ └─ POST /plantcare/             │
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
| **Watering schedule** — Care tab list (soonest/overdue first) + live Plant Detail card; `POST /plantcare/watering_schedule` (source of truth) + TS offline fallback kept in sync via a shared golden fixture; mark-watered action finally writes `Plant.lastWatered` | PR #18 |
| **Forage Finds persistence** — identified plants saved to a `finds` table + reactive finds list (was mock data) | PR #20 |
| **Diagnose → journal note** — save a chat reply as a plain Observation | PR #21 |
| UI polish (pixel-art placeholder, Leafy Pals header) | PR #19 |
| **Add-plant detail prompt** — "Choose from Photos" now routes into the manual form (name/species) instead of saving a bare "New plant" and bouncing home; manual form gained an optional inline photo picker | PR #22 |
| **Live garden score** — Home cards now re-render on observation inserts (observe the observations collection), so a fresh diagnosis updates the card, not just Plant Detail | PR #23 |
| **Editable plant + journal note cards** — pencil → edit name/species; journal lists compact note cards opening a full-screen note view; never-watered plants show "Water when dry" not a dummy "Water in 7d" | PR #23 |
| **Agent-assisted plant identity** — photo → Gemini suggests name+species, prefills the editable fields on Edit + Add-manual; new `POST /plantcare/identify` (reuses the vision layer, no dataset gate); a photo picked on Edit also becomes the hero | PR #24 |
| **Diagnose message thread** — follow-ups render as a scrollable user/assistant thread; each assistant reply carries its own diagnosis card, save-note button, and inline retry-on-error (concurrent sends guarded) | PR #25 |
| **Room/Light persistence** — Add/Edit forms' Room and Light pickers now actually save (schema v4, `Plant.room`/`Plant.light`); shared `RoomLightPicker` component used by both screens; Plant Detail shows the saved value (e.g. "Living room · Bright") | PR #27 |
| **Durable photo storage** — camera/picker photos are copied into durable app storage (`expo-file-system`'s new `File`/`Directory`/`Paths` API) before being saved, instead of the raw cache URI; shared `persistPhoto`/`deletePhoto` helper used by Add-manual, Edit (also cleans up the replaced photo), Diagnose, and Forage Find; one-time startup backfill migrates or nulls out existing rows | PR #30 |
| **Base URL config** — the backend base URL now lives in one shared `lib/config.ts` (`API_BASE`), read from the Expo-native `EXPO_PUBLIC_API_BASE` env var with a `localhost:8000` fallback; the four call sites (`lib/api.ts`, `lib/care.ts`, `lib/identify.ts`, `forage/api.ts`) import it. Physical devices set a LAN IP in gitignored `client/.env.local`; `client/.env.example` documents it | `frondly/base-url-config` (local) |
| **Account + cloud backup/restore** — Firebase email/password auth (`useAuth`, session persisted via AsyncStorage) gates a manual "back up now" / "restore from backup" flow on a new `/account` screen; backup serializes the garden (plants, observations, finds, and their photos) to `users/{uid}/snapshot.json` + `users/{uid}/photos/{basename}` in Firebase Storage, restore downloads and replaces the local WatermelonDB + re-persists photos; per-user isolation enforced by `client/firebase/storage.rules`; app stays local-first and fully usable signed-out (auth gates only backup/restore) | PR pending on `frondly/account-cloud-backup` |
| Backend: plantcare ADK agent + tools, forage identify, offline test suites (client jest 86, server 15) | — |

**One-time human console setup** (required before Account + cloud backup/restore
works on a device — the jest suites mock Firebase and need none of this):
create a Firebase project (free Spark plan) → enable **Authentication ▸
Email/Password** → enable **Storage** → copy the Web app config into
`client/.env.local` as the `EXPO_PUBLIC_FIREBASE_*` keys → publish
`client/firebase/storage.rules` (Firebase console ▸ Storage ▸ Rules, or
`firebase deploy --only storage`).

## Left for the app to fully work 🔨

Base URL config is DONE (see the Implemented table). Account + cloud
backup/restore is also DONE, in its scoped-down manual form (see the
Implemented table and the "Auth + multi-device sync" open question below,
which this addresses). The remaining gaps are tracked as follow-ups below and
in "Open questions on hold".

Base URL config follow-ups (deliberate): only the base URL is env-driven —
there's no EAS build profile that bakes a production URL yet (no production
backend exists to point at); the `localhost:8000` fallback still assumes the
adb-reverse / simulator flow when the env var is unset.

Account + cloud backup/restore follow-ups (deliberate, non-goals of this
milestone): no live/automatic sync — backup and restore are both manual,
explicit button presses; no conflict resolution (restore always replaces the
local garden wholesale); no password reset or email verification; no
Google/OAuth sign-in; no photo dedup by content hash (each backup re-uploads
every referenced photo); only one snapshot per user (overwritten each backup,
no history); restore doesn't clean up the app's temp/cache download directory
after re-persisting photos into durable storage.

Durable photo storage follow-ups (deliberate, listed in this PR): no cleanup
of a photo's durable file when its owning record (plant/observation/find) is
deleted — no delete-record feature exists anywhere in the app yet, so this is
unreachable code; `extensionOf` doesn't strip query/fragment suffixes from a
source URI (no current camera/picker call site produces those); `ensureDir`
has a benign TOCTOU race on two concurrent first-saves (no concurrency
requirement at this app's single-user scale); the backfill does 3 full-table
scans + one write-transaction per changed row with no batching (fine at a
personal-garden scale); manual simulator verification (add/edit a plant's
photo, confirm it persists across a simulated cache clear) still pending —
no simulator available in this environment, same as the prior two branches.

Diagnose message thread follow-ups (deliberate): thread state is ephemeral
(`useState` only, not persisted) — leaving the screen still ends the
session, the saved Observations remain the durable record; an empty
follow-up that errors before any text streams can still trigger "Save this
note," saving a blank journal entry (low-impact edge case, easy one-line
guard if it matters).

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

- **Auth + multi-device sync** — addressed in its scoped-down form by Account
  + cloud backup/restore (Firebase email/password auth + manual backup/restore
  to Firebase Storage; see the Implemented table). What's still open: this is
  backup/restore, not *live* sync — there's no conflict resolution and no
  automatic/background push. True live sync would still need WatermelonDB's
  own pull/push endpoints (FastAPI is the natural fit, but the server gains a
  DB — a big architectural shift from "stateless, all data on-device";
  Firestore is not a fit). Needs its own brainstorm/spec if pursued.
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
