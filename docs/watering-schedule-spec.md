# Watering Schedule — Design Spec

**Date:** 2026-07-02 · **Status:** approved

Roadmap item #1: wire the existing `watering_schedule` agent tool into two
places that currently fake it — Care tab (`ComingSoon` placeholder) and Plant
Detail's static "Water Thursday" card
(`client/src/app/plant/[id].tsx`, `dev-note` on that card marks this as the
deferred work).

## Decisions (made during brainstorm)

- **Compute location — hybrid, server-primary:** a new
  `POST /plantcare/watering_schedule` endpoint is the runtime source of
  truth. The client also carries a ported TS copy of the same pure algorithm
  as an offline fallback when the request fails or times out — never blocks
  the UI, never shows nothing.
- **Drift protection:** a shared golden-vector fixture
  (`fixtures/watering-schedule.golden.json`, repo root — array of
  `{species, precip_7d, history, expected}`) is asserted against by both the
  pytest suite and the jest suite, so the server (canonical) and client
  (fallback) implementations can't silently diverge.
- **Mark as watered:** `Plant.lastWatered` exists on the schema/model but
  nothing currently writes it (Add Plant only sets `dateAdded`). Add a
  "mark watered" action so the schedule can actually advance past the
  initial guess; falls back to `dateAdded` as the baseline when
  `lastWatered` is still null.
- **Care tab scope:** garden-wide list (not just the Plant Detail card),
  sorted soonest/overdue first, each row tap-to-mark-watered.
- **Precip source:** Open-Meteo `daily=precipitation_sum&past_days=7`,
  fetched client-side via device location — same pattern as
  `lib/weather.ts`, but a separate leaner fetch (no reverse-geocode, Care
  doesn't need a city name) so the existing tested weather module stays
  untouched.
- **Scope cut:** no per-plant location (every `Plant.latitude/longitude` is
  currently always null — capture flows don't set it), so one device-location
  rain reading is reused across all plants, same as the weather card. Base
  URL config (roadmap #6) stays the existing hardcoded
  `http://localhost:8000` — not this spec's problem to fix.

## Components

### `server/main.py` (edit)

- `POST /plantcare/watering_schedule` — deterministic route alongside
  `/forage/identify`, no ADK session involved. Body
  `{species: str, precip_7d: float, history: [{date: str}]}` → calls the
  existing `watering_schedule(species, {"precip_7d": precip_7d}, history)`
  straight, returns its dict (`next_water_date`, `interval_days`, `reason`).

### `client/src/lib/care.ts` (new)

- `nextWaterDate(species, precip7d, history): ScheduleResult` — TS port of
  `server/plantcare/tools/schedule.py`'s pure function (species interval
  table + rain adjustment + last-watered lookup). Fallback path only.
- `fetchWateringSchedule(species, precip7d, history): Promise<ScheduleResult>`
  — POST to `${API_BASE}/plantcare/watering_schedule` (same `API_BASE`
  constant pattern as `forage/api.ts`), short timeout (~5s).
- `getWateringSchedule(species, precip7d, history): Promise<ScheduleResult>`
  — tries `fetchWateringSchedule`, falls back to `nextWaterDate` on any
  failure (network error, timeout, non-2xx). Never throws.
- `markWatered(plant: Plant): Promise<void>` — `database.write` wrapping
  `plant.update(p => { p.lastWatered = new Date() })`.

### `client/src/hooks/use-recent-rainfall.ts` (new)

- `useRecentRainfall(): number | null` — mirrors `use-weather.ts`'s
  module-level 30-minute TTL cache. Flow: foreground location permission →
  `getCurrentPositionAsync` (low accuracy) → Open-Meteo
  `daily=precipitation_sum&past_days=7`, summed. Any failure → `null` (schedule
  falls back to no rain-adjustment, never blocks).

### `client/src/hooks/use-garden.ts` (edit)

- `PlantVM` gains `species`, `lastWatered`, `dateAdded` — already on the
  `Plant` model, just not surfaced through `toVM`.

### `client/src/hooks/use-plant-detail.ts` (edit)

- Currently only subscribes to `plant.observations`; a `markWatered` write
  wouldn't re-render this screen. Add a `plant.observe()` subscription
  alongside the observations one, merge `lastWatered` into
  `PlantDetailVM`.

### `client/src/app/(tabs)/care.tsx` (edit)

- Replaces `ComingSoon`. Reactive list from `useGarden()` +
  `useRecentRainfall()`; each row resolves its schedule via
  `getWateringSchedule()`, sorted overdue/soonest-first. Row: photo, name,
  "Water today" / "Water in Xd" / "Overdue by Xd", tap → `markWatered()`.

### `client/src/app/plant/[id].tsx` (edit)

- Static `AssistantCard` (lines 103–108) becomes live: title/detail sourced
  from `getWateringSchedule()`'s result for this plant. Adds a small
  "Mark watered" affordance near the card. Removes the `dev-note`.

## Error handling

Every failure path (server unreachable, location denied, weather fetch
failure) collapses to the local TS fallback or a `null`
rain-adjustment — never an error state surfaced to the user, consistent with
the weather card's silent-degradation approach.

## Testing

- pytest: endpoint test for `POST /plantcare/watering_schedule`; existing
  `watering_schedule` unit tests extended to also run the shared golden
  fixture.
- jest: `care.ts` (`nextWaterDate` against the golden fixture,
  `getWateringSchedule` fallback behavior on fetch failure);
  `use-recent-rainfall` mirrors existing `use-weather` test patterns; render
  tests for the new Care tab list states and the live Plant Detail card.

## Known ceilings (dev-notes in code)

- One device-location rain reading reused for every plant — accurate enough
  for a single-household garden; per-plant location needs
  `Plant.latitude/longitude` to actually be populated first (currently
  always null).
- Base URL hardcoded (`localhost:8000`) — roadmap item #6, not addressed
  here.
