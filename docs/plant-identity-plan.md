# Agent-Assisted Plant Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a photo, suggest a plant's name + species and prefill the editable fields on the Edit and Add-manual screens.

**Architecture:** A new stateless `POST /plantcare/identify` endpoint reuses the existing `GeminiVision` backend with a houseplant prompt (no dataset gate, no safety states) and returns the top candidate. A shared client `IdentifyButton` uploads a photo via `lib/identify.ts` (XHR multipart) and prefills the name/species fields on both screens; the user reviews before saving.

**Tech Stack:** FastAPI + google-genai (server), Expo/React Native + expo-image-picker + WatermelonDB (client), pytest (server tests).

## Global Constraints

- Spec: `docs/plant-identity-spec.md`.
- No edibility / safety output on this path — that is Forage's job (`/forage/identify`) and stays there. No dataset gate.
- No new confirm screen; the existing editable fields are the confirm step. Nothing auto-saves — the user always reviews prefilled fields before Save.
- Best-guess prefill only (top candidate). No multi-candidate picker.
- Client base URL is the hardcoded `http://localhost:8000` inherited from `forage/api.ts` (repo-wide deferred item — do not add config here).
- Client XHR upload is not unit-tested, consistent with `forage/api.ts` (already-logged gap). Server logic is tested with `StubVision`.
- Follow existing patterns: server tests are plain `assert` functions runnable under pytest *and* `python tests/test_x.py`; client screens use NativeWind classes + `tokens` from `@/constants/tokens`.

---

### Task 1: Server — `POST /plantcare/identify`

**Files:**
- Modify: `server/forage/vision.py` (add optional `prompt` param to `GeminiVision`)
- Create: `server/plantcare/identify.py` (`HOUSEPLANT_PROMPT`)
- Modify: `server/main.py` (add `get_houseplant_vision()` + endpoint)
- Test: `server/tests/test_plantcare_identify.py`

**Interfaces:**
- Consumes: `forage.vision.VisionBackend`, `Candidate`, `StubVision`, `GeminiVision`.
- Produces: `POST /plantcare/identify` (multipart `file`) → JSON `{ "name": str|null, "scientific_name": str|null, "confidence": float }`. `get_houseplant_vision()` dependency (overridable in tests). `plantcare.identify.HOUSEPLANT_PROMPT: str`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_plantcare_identify.py`:

```python
"""Offline self-check for POST /plantcare/identify. Stubs vision; no API call.

Run: python tests/test_plantcare_identify.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from forage.vision import Candidate, StubVision
from main import app, get_houseplant_vision

client = TestClient(app)


def test_identify_returns_top_candidate():
    app.dependency_overrides[get_houseplant_vision] = lambda: StubVision(
        [
            Candidate("Snake Plant", "Dracaena trifasciata", 0.88),
            Candidate("ZZ Plant", "Zamioculcas zamiifolia", 0.40),
        ]
    )
    r = client.post("/plantcare/identify", files={"file": ("p.jpg", b"\xff\xd8x", "image/jpeg")})
    app.dependency_overrides.pop(get_houseplant_vision, None)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {
        "name": "Snake Plant",
        "scientific_name": "Dracaena trifasciata",
        "confidence": 0.88,
    }


def test_identify_empty_candidates_returns_null_name():
    app.dependency_overrides[get_houseplant_vision] = lambda: StubVision([])
    r = client.post("/plantcare/identify", files={"file": ("p.jpg", b"\xff\xd8x", "image/jpeg")})
    app.dependency_overrides.pop(get_houseplant_vision, None)
    assert r.status_code == 200, r.text
    assert r.json() == {"name": None, "scientific_name": None, "confidence": 0.0}


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nall {len(tests)} passed")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && uv run python tests/test_plantcare_identify.py`
Expected: FAIL — `ImportError: cannot import name 'get_houseplant_vision' from 'main'`.

- [ ] **Step 3: Add the `HOUSEPLANT_PROMPT` constant**

Create `server/plantcare/identify.py`:

```python
"""Houseplant identification prompt for POST /plantcare/identify.

Reuses the generic GeminiVision backend (forage/vision.py) with a houseplant
prompt. Deliberately identification-only: no edibility, no care advice, and NO
curated-dataset gate — unlike Forage, a wrong houseplant name is harmless and
the user edits the prefilled field before saving.
"""
from __future__ import annotations

HOUSEPLANT_PROMPT = (
    "Identify the houseplant or indoor/garden ornamental plant in this photo. "
    "Return up to 3 candidate species, ranked most-to-least likely. For each, give the "
    "common name, the scientific (Latin binomial) name, and your confidence from 0.0 to 1.0. "
    "Identify the plant only — do not give care advice or say anything about edibility."
)
```

- [ ] **Step 4: Parameterize the vision prompt**

In `server/forage/vision.py`, change `GeminiVision.__init__` and `identify()` to accept a prompt (default keeps current forage behavior):

```python
    def __init__(self, client=None, model: str = _MODEL, prompt: str = _PROMPT):
        if client is None:
            from google import genai  # lazy: keeps vision.py importable without the SDK
            client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._client = client
        self._model = model
        self._prompt = prompt
```

And in `identify()`, replace the `_PROMPT` reference in the `contents=[...]` list with `self._prompt`:

```python
                contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), self._prompt],
```

- [ ] **Step 5: Add the dependency + endpoint**

In `server/main.py`, add the import near the other forage/plantcare imports:

```python
from plantcare.identify import HOUSEPLANT_PROMPT
```

After `get_vision()`, add:

```python
@lru_cache(maxsize=1)
def get_houseplant_vision() -> VisionBackend:
    """GeminiVision with the houseplant prompt. Overridden with a stub in tests."""
    return GeminiVision(prompt=HOUSEPLANT_PROMPT)
```

After the `/forage/identify` route, add:

```python
@app.post("/plantcare/identify")
async def plantcare_identify(
    file: UploadFile, vision: VisionBackend = Depends(get_houseplant_vision)
) -> dict:
    image = await file.read()
    candidates = vision.identify(image)  # sorted best-first by the backend
    top = candidates[0] if candidates else None
    return {
        "name": top.name if top else None,
        "scientific_name": top.scientific_name if top else None,
        "confidence": top.confidence if top else 0.0,
    }
```

- [ ] **Step 6: Run the new test + the existing suite (regression)**

Run: `cd server && uv run python tests/test_plantcare_identify.py && uv run python tests/test_api.py`
Expected: both print "all N passed". `test_api.py`'s forage tests still pass (the `prompt` default is unchanged behavior).

- [ ] **Step 7: Commit**

```bash
git add server/forage/vision.py server/plantcare/identify.py server/main.py server/tests/test_plantcare_identify.py
git commit -m "feat(server): POST /plantcare/identify houseplant identification"
```

---

### Task 2: Client — `lib/identify.ts`

**Files:**
- Create: `client/src/lib/identify.ts`

**Interfaces:**
- Consumes: `POST /plantcare/identify` from Task 1.
- Produces: `identifyHouseplant(uri: string): Promise<PlantIdentity | null>` and `type PlantIdentity = { name: string; scientificName: string; confidence: number }`.

> No unit test — the XHR upload is untestable without a mock-XHR harness the repo doesn't have, matching `forage/api.ts` (already-logged gap). Verification is `tsc` + `eslint`.

- [ ] **Step 1: Write the module**

Create `client/src/lib/identify.ts`:

```ts
// Client for houseplant identification (server/main.py: POST /plantcare/identify).
// Sibling of forage/api.ts — same local-dev base URL and XHR upload trick.
//
// dev-note: base URL hardcoded for local dev; shares forage/api.ts's deferred
// env/EAS-config follow-up. XHR (not fetch) because RN 0.85's fetch rejects the
// classic { uri } FormData file part.
const API_BASE = "http://localhost:8000";

export type PlantIdentity = {
  name: string;
  scientificName: string;
  confidence: number;
};

// Server response shape (snake_case, name null when Gemini couldn't name it).
type IdentifyResponse = {
  name: string | null;
  scientific_name: string | null;
  confidence: number;
};

// Upload the photo and return the top identity, or null when the server
// couldn't name the plant. Throws on network/timeout/HTTP errors.
export async function identifyHouseplant(uri: string): Promise<PlantIdentity | null> {
  const form = new FormData();
  form.append("file", { uri, name: "capture.jpg", type: "image/jpeg" } as any);

  const body = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/plantcare/identify`);
    xhr.timeout = 20_000;
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new Error(`Identify failed (${xhr.status}).`));
    xhr.onerror = () =>
      reject(new Error("Network error — is the server running and adb reverse tcp:8000 set?"));
    xhr.ontimeout = () =>
      reject(new Error("Identify timed out. Check the server and adb reverse tcp:8000."));
    xhr.send(form);
  });

  const data = JSON.parse(body) as IdentifyResponse;
  if (!data.name) return null;
  return {
    name: data.name,
    scientificName: data.scientific_name ?? "",
    confidence: data.confidence,
  };
}
```

- [ ] **Step 2: Verify types + lint**

Run: `cd client && npx tsc --noEmit && npx eslint src/lib/identify.ts`
Expected: no errors on `src/lib/identify.ts` (pre-existing `__tests__`/web-only lint errors noted in ROADMAP are unrelated).

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/identify.ts
git commit -m "feat(client): identifyHouseplant API client"
```

---

### Task 3: Client — shared `IdentifyButton` component

**Files:**
- Create: `client/src/components/identify-button.tsx`

**Interfaces:**
- Consumes: `identifyHouseplant`, `PlantIdentity` from Task 2; `expo-image-picker`; `tokens` from `@/constants/tokens`.
- Produces: default-exported `IdentifyButton` component with props `{ photoUri: string | null; onPhotoPicked?: (uri: string) => void; onIdentified: (identity: PlantIdentity) => void }`.

> No unit test — the repo has no RN-component test harness (jest covers `lib/` pure logic only). Verification is `tsc` + `eslint`.

- [ ] **Step 1: Write the component**

Create `client/src/components/identify-button.tsx`:

```tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { tokens } from "@/constants/tokens";
import { identifyHouseplant, type PlantIdentity } from "@/lib/identify";

type Props = {
  photoUri: string | null;
  // Fired when the button picks a photo itself (no photoUri was set yet), so the
  // parent can persist it (e.g. as heroPhoto / the manual-form photo).
  onPhotoPicked?: (uri: string) => void;
  onIdentified: (identity: PlantIdentity) => void;
};

// "Identify from photo" — shared by Add-manual and Edit. Uses the current photo,
// or picks one if none is set. Prefill only; never writes to the database.
export function IdentifyButton({ photoUri, onPhotoPicked, onIdentified }: Props) {
  const [identifying, setIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (identifying) return;
    setError(null);

    let uri = photoUri;
    if (!uri) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      uri = result.assets[0].uri;
      onPhotoPicked?.(uri);
    }

    setIdentifying(true);
    try {
      const identity = await identifyHouseplant(uri);
      if (identity) onIdentified(identity);
      else setError("Couldn't identify — enter details manually.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identify failed.");
    } finally {
      setIdentifying(false);
    }
  }

  return (
    <View className="gap-1.5">
      <Pressable
        onPress={run}
        disabled={identifying}
        className="flex-row items-center justify-center gap-2 rounded-[14px] bg-citron py-3"
        style={{ opacity: identifying ? 0.6 : 1 }}
      >
        {identifying ? (
          <ActivityIndicator color={tokens.forest} />
        ) : (
          <Ionicons name="sparkles" size={16} color={tokens.forest} />
        )}
        <Text className="font-body text-[15px] font-semibold text-forest">
          {identifying ? "Identifying…" : "Identify from photo"}
        </Text>
      </Pressable>
      {error ? <Text className="font-body text-xs text-secondary">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `cd client && npx tsc --noEmit && npx eslint src/components/identify-button.tsx`
Expected: no errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/identify-button.tsx
git commit -m "feat(client): shared IdentifyButton component"
```

---

### Task 4: Wire Add-manual screen

**Files:**
- Modify: `client/src/app/(tabs)/add/manual.tsx`

**Interfaces:**
- Consumes: `IdentifyButton` (Task 3).

- [ ] **Step 1: Add the Species field state + import**

In `client/src/app/(tabs)/add/manual.tsx`, add the import (with the other `@/` imports):

```tsx
import { IdentifyButton } from "@/components/identify-button";
```

Add species state next to `name`:

```tsx
  const [species, setSpecies] = useState("");
```

- [ ] **Step 2: Use the species field on save**

Change the hardcoded species line in `save()`:

```tsx
          plant.species = species.trim() || "Unknown species";
```

- [ ] **Step 3: Render the identify button + Species input**

Immediately after the photo control (the `photoUri ? … : …` block) and before the `<View className="gap-4">` details block, add:

```tsx
      <IdentifyButton
        photoUri={photoUri}
        onPhotoPicked={setPhotoUri}
        onIdentified={({ name: n, scientificName }) => {
          setName(n);
          setSpecies(scientificName);
        }}
      />
```

Inside the `<View className="gap-4">` block, after the Nickname field `</View>`, add a Species input:

```tsx
        <View>
          <Text className="font-body text-[13px] text-secondary">Species</Text>
          <TextInput
            value={species}
            onChangeText={setSpecies}
            placeholder="Monstera deliciosa"
            placeholderTextColor={tokens.secondary}
            className="mt-2 rounded-[18px] border border-border bg-surface px-4 py-3 font-body text-[15px] text-forest"
            autoCapitalize="words"
          />
        </View>
```

- [ ] **Step 4: Verify types + lint**

Run: `cd client && npx tsc --noEmit && npx eslint "src/app/(tabs)/add/manual.tsx"`
Expected: no errors on the file.

- [ ] **Step 5: Commit**

```bash
git add "client/src/app/(tabs)/add/manual.tsx"
git commit -m "feat(client): identify button + species field on Add-manual"
```

---

### Task 5: Wire Edit screen

**Files:**
- Modify: `client/src/app/plant/edit.tsx`

**Interfaces:**
- Consumes: `IdentifyButton` (Task 3).

- [ ] **Step 1: Add the import + heroPhoto state**

In `client/src/app/plant/edit.tsx`, add the import (with the other `@/` imports):

```tsx
import { IdentifyButton } from "@/components/identify-button";
```

Add heroPhoto state next to `species`:

```tsx
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
```

- [ ] **Step 2: Load heroPhoto from the plant**

In the `useEffect` `.then((plant) => { … })`, after `setSpecies(plant.species);`, add:

```tsx
        setHeroPhoto(plant.heroPhoto);
```

- [ ] **Step 3: Persist heroPhoto on save**

In `save()`, inside `plant.update((p) => { … })`, after the species line, add:

```tsx
          p.heroPhoto = heroPhoto;
```

- [ ] **Step 4: Render the identify button**

After the header `</View>` (the back-button row) and before the `<View className="gap-4">` fields block, add:

```tsx
      <IdentifyButton
        photoUri={heroPhoto}
        onPhotoPicked={setHeroPhoto}
        onIdentified={({ name: n, scientificName }) => {
          setName(n);
          setSpecies(scientificName);
        }}
      />
```

- [ ] **Step 5: Update the stale dev-note**

Remove the header comment line that says agent-assisted prefill is deferred (it's now implemented):

Delete:
```tsx
// dev-note: species is free-text for now; an agent-assisted "identify this
// plant" prefill (like Forage) is the deferred next-milestone item.
```

- [ ] **Step 6: Verify types + lint**

Run: `cd client && npx tsc --noEmit && npx eslint src/app/plant/edit.tsx`
Expected: no errors on the file.

- [ ] **Step 7: Commit**

```bash
git add client/src/app/plant/edit.tsx
git commit -m "feat(client): identify button on Edit screen, persist hero photo"
```

---

### Task 6: Update roadmap

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Move item 1 of the next milestone to Implemented**

In `docs/ROADMAP.md`, under "## Next milestone", remove the "Agent-assisted name/species" bullet (item 1) and leave the diagnose message thread as the remaining next-milestone item. Add an Implemented-table row:

```markdown
| **Agent-assisted plant identity** — photo → Gemini suggests name+species, prefills the editable fields on Edit + Add-manual; new `POST /plantcare/identify` (reuses the vision layer, no dataset gate) | `frondly/plant-identity` (local) |
```

Update the header line's "Updated:" date/note to mention the plant-identity branch.

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: roadmap — agent-assisted plant identity done"
```

---

## Self-Review

**Spec coverage:**
- Server endpoint + prompt param + `HOUSEPLANT_PROMPT` + no-gate + top-candidate/null → Task 1. ✓
- `lib/identify.ts` (`identifyHouseplant`, `PlantIdentity`, XHR) → Task 2. ✓
- Shared `IdentifyButton` (pick-if-none, spinner, prefill, inline errors) → Task 3. ✓
- Add-manual: Species field + button + freshly-picked photo → Task 4. ✓
- Edit: heroPhoto state + button + save heroPhoto → Task 5. ✓
- Error cases (cancel/network/timeout/empty/low-confidence) → covered by Task 2 mapping + Task 3 handling; server null-name path tested in Task 1. ✓
- Tests: server pytest with StubVision (top + empty) → Task 1; client XHR untested by design → noted in Tasks 2/3. ✓
- Roadmap update → Task 6 (implicit in "update the roadmap" project convention). ✓

**Type consistency:** `PlantIdentity` = `{ name, scientificName, confidence }` used identically in Tasks 2/3/4/5. `IdentifyButton` props (`photoUri`, `onPhotoPicked`, `onIdentified`) match across Tasks 3/4/5. Server JSON `{name, scientific_name, confidence}` mapped in Task 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓
