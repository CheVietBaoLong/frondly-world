# Forage Finds persistence + live-test polish — design

**Date:** 2026-07-03
**Status:** Approved (brainstorm), pending implementation

Ships the next roadmap milestone (Forage Finds persistence, roadmap #1) plus
four polish findings from live testing. Split into **three PRs** so review stays
focused.

---

## PR 1 — UI polish

Two small, independent findings bundled together.

### Pixel-art plant placeholder (finding #1)

Plants with no `heroPhoto` currently render an empty sage box on garden cards
and a bare leaf icon on Plant Detail. Replace both with a shared pixel-art
placeholder.

- **Asset:** `assets/images/plant-placeholder.png` — a small potted-plant pixel
  sprite, generated in-repo (no external dependency).
- **Render:** garden card (`app/(tabs)/index.tsx`) and Plant Detail hero
  (`app/plant/[id].tsx`) show the placeholder image via `expo-image` when
  `heroPhoto` is null. `contentFit` chosen so the sprite reads as intentional
  art, not a stretched photo.

### Garden header (finding #5)

- Rename the header title "My Garden" → **"Leafy Pals"**.
- Surface temperature + location in the header subtitle. `useWeather()` already
  yields `city · tempF · label`; lift that string into the header subtitle (with
  the plant count) so it's visible at a glance. The `AssistantCard` keeps the
  care message.
- When weather hasn't loaded, fall back to the existing plant-count subtitle.

---

## PR 2 — Forage Finds persistence (roadmap milestone #1)

Identified plants are saved to a durable on-device log and browsable in "Your
finds", replacing the mock data.

### Data model — new `Find` (schema v3)

New WatermelonDB table `finds`, migration follows the existing v1→v2 pattern
(`createTable` step in `migrations.ts`, model registered in `db/index.ts`).

Columns:

| column | type | notes |
|---|---|---|
| `common_name` | string, optional | suppressed for low_confidence |
| `scientific_name` | string, optional | |
| `state` | string | `verified_edible` / `verified_toxic` / `unverified` / `low_confidence` |
| `confidence` | number | 0–1 |
| `photo` | string, optional | capture URI (cache URI as-is, same deferred durability caveat as heroPhoto/diagnosis) |
| `result_json` | string | full `ForageResult` snapshot, stored via `@json` + sanitizer (mirrors `Observation.care_steps`) |
| `created_at` | number | save time |

**Cherry-pick decision:** the snapshot (`result_json`) is the source of truth
for *what the user saw* — durable, offline, never drifts. The existing
`/forage/species/[id]` screen stays reachable from the find detail for the
fresh/fuller server view. Complementary, not competing.

### Save trigger — explicit "Save to finds"

- A "Save to finds" button on `forage/result.tsx`, shown on all non-error,
  non-loading states (edible / toxic / unverified / low_confidence — foragers
  log cautionary finds too).
- On tap: write a `Find` from the current `ForageResult` + photo URI, then show
  a saved-confirmation state (button → "Saved ✓", disabled) so double-taps don't
  duplicate.

### Finds screen — reactive query

- `app/forage/finds.tsx`: replace `MOCK_FINDS` with a reactive query over
  `finds` (newest first). Delete `forage/data.ts` mock once nothing references
  it (keep the `Find` display type or derive from the model).
- Keep the All / Edible / Caution filter. Map `state` → status chip:
  `verified_edible` → `edible` (Edible chip), `verified_toxic` → `caution`
  (Caution chip), `unverified`/`low_confidence` → `unconfirmed` (Unconfirmed
  chip). The Caution filter matches `caution`; All shows everything. Reuses the
  existing `STATUS_CHIP` map.
- Cards become `Pressable` → navigate to the find detail.
- Empty state when there are no saved finds.

### Find detail — new `app/forage/finds/[id].tsx`

- Loads the `Find` by id, parses `result_json` back into a `ForageResult`.
- Re-renders the saved snapshot reusing `result.tsx`'s presentation (photo,
  confidence, facts, safety strip, lookalikes). Extract the shared render into a
  small presentational component so both screens use one implementation rather
  than duplicating JSX.
- Keeps the "View full species info" button → `/forage/species/[id]`
  (`buildForageSpeciesId`), the live server view.

### Forage capture button fix (finding #4)

- The bottom-right `images-outline` square on `app/(tabs)/forage.tsx` currently
  navigates to Finds — the glyph implies "choose a photo" but the behavior is
  "open Finds." Repurpose it to do what the icon promises: open the photo
  library (`expo-image-picker`, same flow as `plant/diagnose.tsx`), then run
  `identifyPhoto` on the selected image → `/forage/result`.
- Removes the redundant second Finds shortcut (header bookmark stays as the sole
  Finds entry) and gives Simulator users a camera-free way to test Forage.

---

## PR 3 — Diagnosis summary note (finding #3)

The diagnose follow-up chat is ephemeral — only the initial structured
`Diagnosis` auto-saves as an `Observation`; follow-up Q&A is lost on leaving the
screen.

- Add a "Save this note" action on the follow-up reply block in
  `plant/diagnose.tsx`. On tap: write an `Observation` with `note` = the reply
  text (no health score / severity — it's a note, not a re-diagnosis),
  `date` = now.
- Plant Detail's DIAGNOSIS card already renders the latest note via `latestNote`,
  so saved summaries surface there automatically. No Plant Detail change needed.

---

## Testing

- **PR 1:** placeholder renders when `heroPhoto` null (visual); header shows
  weather line when loaded, plant-count fallback otherwise. Manual simulator
  check.
- **PR 2:** unit-test the `Find` ↔ `ForageResult` snapshot round-trip
  (create → parse `result_json` → equals original), following the existing jest
  patterns. `state` → chip mapping covered. Manual: save from each result state,
  see it in Finds, open detail, species link works, library-picker identifies.
- **PR 3:** manual — save a follow-up note, confirm it appears on Plant Detail.

## Deferred (dev-notes, not this work)

- **Find location:** mockups show a location per find; the identify flow
  captures no GPS. Show date only for now; capturing coarse location (reuse the
  weather `expo-location` path) is a follow-up.
- **Durable photos:** find/diagnosis/hero photos still store cache URIs; the
  `expo-file-system` copy is the existing shared deferred item.
- **Base URL:** `localhost:8000` still hardcoded (existing roadmap item).
