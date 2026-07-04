# Agent-Assisted Plant Identity — Design

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Milestone:** Next milestone item 1 of 2 (the diagnose message thread is a
separate spec).

## Problem

A plant added via a photo or quick-add is saved as a bare record — name "New
plant", species "Unknown species" — and the only way to fix it is to type both
by hand on the Edit screen. Users don't know the Latin binomial, so plants stay
mislabelled (surfaced directly in the eyeball test: "no way to modify plant
info", "stuck at New plant / Unknown species").

Forage already identifies wild plants from a photo. This milestone brings the
same "point a camera, get a name" affordance to houseplants, prefilling the
editable name/species fields so the user can confirm or tweak and save.

## Non-goals

- No safety / edibility output. That is Forage's job and stays there.
- No new "confirm" screen. The existing editable fields on Edit / Add-manual
  *are* the confirm step.
- No multi-candidate picker. Top guess prefills; the fields are editable.
- No durable photo storage change (still a repo-wide deferred item).
- Diagnose message thread — separate spec.

## Why not reuse `/forage/identify`

`/forage/identify` is deliberately foraging-tuned: it identifies against a
curated Pacific-Northwest dataset, returns four edibility states, carries toxic
lookalikes, and **suppresses the species name below a 0.70 confidence
threshold** (safety contract). A Monstera isn't in that dataset, so it would
return `low_confidence` / "still researching". The endpoint is the wrong brain
for houseplants.

The reusable seam is one layer down: `forage/vision.py`'s `VisionBackend`
protocol and `GeminiVision` return a plain `Candidate {name, scientific_name,
confidence}` list. Only the *prompt* and the *downstream dataset gate* make
Forage foraging-specific. Houseplant ID reuses the vision layer with a different
prompt and no gate.

## Architecture

### Server — `POST /plantcare/identify`

New stateless endpoint alongside `/forage/identify` and
`/plantcare/watering_schedule` in `server/main.py`.

1. **`forage/vision.py`** — add an optional `prompt` parameter to
   `GeminiVision.__init__(self, client=None, model=_MODEL, prompt=_PROMPT)`,
   defaulting to the current forage prompt. `identify()` uses `self._prompt`
   instead of the module constant. No behavior change for the existing Forage
   path (default keeps the same prompt).
2. **`server/plantcare/identify.py`** (new) — define `HOUSEPLANT_PROMPT` here, a
   plantcare-owned constant so the forage namespace stays foraging-only (mirrors
   `forage/identify.py` as the feature's server module). Prompt intent: *identify the
   houseplant / indoor or garden ornamental plant in this photo; return up to 3
   candidates ranked most-to-least likely, each with common name, scientific
   (Latin binomial) name, and confidence 0.0–1.0; identification only, no
   edibility or care advice.*
3. **`main.py`** — add `get_houseplant_vision()` (`lru_cache(maxsize=1)`,
   returns `GeminiVision(prompt=HOUSEPLANT_PROMPT)`) and:

   ```python
   @app.post("/plantcare/identify")
   async def plantcare_identify(
       file: UploadFile, vision: VisionBackend = Depends(get_houseplant_vision)
   ) -> dict:
       image = await file.read()
       candidates = vision.identify(image)          # sorted, best first
       top = candidates[0] if candidates else None
       return {
           "name": top.name if top else None,
           "scientific_name": top.scientific_name if top else None,
           "confidence": top.confidence if top else 0.0,
       }
   ```

   No dataset gate, no safety states. Empty candidate list (429 / model
   returned nothing) → `{name: null, scientific_name: null, confidence: 0.0}`,
   HTTP 200. The client treats a null name as "couldn't identify".

### Client — shared identify path

1. **`src/lib/identify.ts`** (new)

   ```ts
   export type PlantIdentity = {
     name: string;
     scientificName: string;
     confidence: number;
   };

   // null when the server couldn't name the plant.
   export async function identifyHouseplant(uri: string): Promise<PlantIdentity | null>
   ```

   Uploads the photo to `POST /plantcare/identify` with the same
   XMLHttpRequest-multipart approach as `forage/api.ts` (RN 0.85's fetch rejects
   `{ uri }` FormData file parts). Same `API_BASE`, timeout, and error messages
   as `forage/api.ts`. Maps the response to `PlantIdentity`; returns `null` when
   `name` is null/empty.

2. **`src/components/identify-button.tsx`** (new, shared by both screens)

   Props:
   ```ts
   {
     photoUri: string | null;                       // current photo, if any
     onPhotoPicked?: (uri: string) => void;         // fired if the button picks one
     onIdentified: (identity: PlantIdentity) => void;
   }
   ```

   Behavior on tap:
   - If `photoUri` is null, launch `ImagePicker.launchImageLibraryAsync`; if the
     user cancels, stop. Otherwise call `onPhotoPicked(uri)` and continue with
     that uri.
   - Set a local `identifying` state; render an `ActivityIndicator` + "Identifying…"
     while the request is in flight.
   - `await identifyHouseplant(uri)`. On a non-null result call
     `onIdentified(identity)`. On `null`, set inline error "Couldn't identify —
     enter details manually." On a thrown error, show the caught message.
   - Never writes to the database. Prefill only.

### Wiring

- **`add/manual.tsx`**
  - Add a `species` state field + a Species `TextInput` (the screen currently
    hardcodes `"Unknown species"` on save). Save uses `species.trim() ||
    "Unknown species"`.
  - Render `<IdentifyButton photoUri={photoUri} onPhotoPicked={setPhotoUri}
    onIdentified={({name, scientificName}) => { setName(name);
    setSpecies(scientificName); }} />` near the photo control.

- **`plant/edit.tsx`**
  - Track `heroPhoto` in state (loaded from the plant, may be null).
  - Render `<IdentifyButton photoUri={heroPhoto} onPhotoPicked={setHeroPhoto}
    onIdentified={({name, scientificName}) => { setName(name);
    setSpecies(scientificName); }} />`.
  - `save()` also writes `p.heroPhoto = heroPhoto` (one added line), so a photo
    picked for identification becomes the plant's hero. Existing name/species
    writes unchanged.

## Data flow

```
[Edit / Add-manual screen]
   tap Identify ─▶ IdentifyButton
                     │  (photoUri ?? pick one → onPhotoPicked)
                     ▼
                 identifyHouseplant(uri)   lib/identify.ts
                     │  XHR multipart POST
                     ▼
   POST /plantcare/identify   main.py
                     │  get_houseplant_vision().identify(image)
                     ▼
   GeminiVision(prompt=HOUSEPLANT_PROMPT)  forage/vision.py
                     │  Gemini 2.5 flash, structured JSON
                     ▼
   top candidate → { name, scientific_name, confidence }
                     │
   onIdentified ─▶ setName / setSpecies (prefill; user reviews)
                     │
   user taps Save ─▶ database.write (existing paths)
```

## Error handling

| Case | Behavior |
|---|---|
| User cancels the picker | No-op, no error. |
| Network / server down | Inline error, same copy as `forage/api.ts` ("is the server running and adb reverse tcp:8000 set?"). |
| Timeout (20s) | Inline "Identify timed out…". |
| Gemini returns nothing / 429 | Server returns `{name: null}`; client shows "Couldn't identify — enter details manually." |
| Low confidence | Still prefills the top guess. Fields are editable; user corrects. A "low confidence, double-check" hint is deferred (YAGNI). |

Nothing auto-saves. The user always reviews prefilled fields before Save.

## Testing

- **Server (pytest, `server/tests/`)** — mirror `test_api.py`: override
  `get_houseplant_vision` with `StubVision`. Assert (a) top candidate is
  returned as `{name, scientific_name, confidence}`, (b) empty candidate list →
  `{name: null, confidence: 0.0}`, (c) candidates are returned best-confidence
  first (StubVision already sorts).
- **Client** — the XHR upload in `lib/identify.ts` is not unit-tested,
  consistent with `forage/api.ts` (the missing mock-XHR test is an already-logged
  gap, not new debt). No pure mapping logic complex enough to warrant its own
  test beyond the null-name guard, which the server test covers end-to-end.

## Files touched

New:
- `server/plantcare/identify.py` — `HOUSEPLANT_PROMPT` constant.
- `client/src/lib/identify.ts`
- `client/src/components/identify-button.tsx`
- `server/tests/test_plantcare_identify.py`

Modified:
- `server/forage/vision.py` — optional `prompt` param on `GeminiVision`.
- `server/main.py` — `get_houseplant_vision()` + `POST /plantcare/identify`.
- `client/src/app/(tabs)/add/manual.tsx` — Species field + identify button.
- `client/src/app/plant/edit.tsx` — heroPhoto state + identify button.

## Deferred / follow-ups

- Multi-candidate picker.
- Low-confidence hint on the prefill.
- Durable photo storage (repo-wide, unchanged here).
- Base-URL config (repo-wide; `identify.ts` inherits the hardcoded
  `localhost:8000` like its siblings).
- Client mock-XHR test for the upload loop (shared gap with `forage/api.ts`).
