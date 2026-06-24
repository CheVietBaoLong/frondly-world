# Forage — Wild-Plant ID for Hikers

**Feature spec · v1 · 2026-06-23**
Plant-care iOS capstone (SwiftUI + Python ADK / Gemini 2.5)

---

## 1. One-liner
A camera-first mode that identifies wild plants on the trail and surfaces expert
information and toxic lookalikes — **as an educational field aid, never as a verdict
on whether something is safe to eat.**

## 2. Motivation
The Pacific Northwest has a strong hiking and foraging culture. Hikers regularly
encounter edible berries and greens — and dangerous lookalikes. The core app already
does photo → AI analysis for owned plants; the same vision pipeline extends naturally
to wild-plant ID. The gap it fills: instant, grounded, *honest* identification in the
field, with the safety framing most consumer plant apps get wrong.

## 3. Guiding principle: educational ID only
The feature **never says "safe to eat."** It identifies, informs, and warns; the eat/
don't-eat decision always stays with the user plus a field guide.

> **The confidence inversion.** In plant care, high confidence reassures and low
> confidence is a minor caveat. In Forage this flips: **low confidence is the safety
> feature.** A confident wrong answer can put someone in the hospital, so below a
> threshold the app suppresses the species name and says so plainly. The same
> "Confidence X%" chip that builds trust elsewhere does the opposite emotional job here.

## 4. Scope
**In:** berries, fruit, and edible greens/plants (salmonberry, huckleberry,
thimbleberry, salal, stinging nettle, miner's lettuce, etc.) and their toxic lookalikes.
**Out (deliberately):** mushrooms — deadly *Amanita* and false morels make verdicts
irresponsible even for expert apps. Excluded from v1.

## 5. Knowledge source — curated PNW dataset
Identity is matched and grounded against a curated **Pacific Northwest bioregion**
dataset (WA + OR + ID + S. BC — one shared Cascadia flora, so regional framing adds
coverage at near-zero extra species cost). This curated, citable dataset is the
"data from scientists" and a defensible artifact for the capstone.

Per-species schema:
```
name, scientific_name, edible_part, season, habitat,
range,                       e.g. "WA · OR · ID · S.BC — coast & Cascades"
toxic_lookalikes: [ { name, scientific_name, how_to_tell_apart } ],
source                       e.g. "Pojar & MacKinnon, Plants of the PNW Coast"
```
Target: ~30–50 common species for v1.

## 6. Information architecture
- **New 4th tab: Forage** (nav was Garden · Add · Care). Tapping it opens camera-first.
- **Separate memory store.** Forage finds live in their own "Your finds" history and do
  NOT enter the Garden. Garden memory is for *owned* plants (per-plant history, decline
  detection, watering); a one-off wild ID has none of that and would pollute the
  garden's signal (e.g. care counts). The boundary is consistent across both layers:
  separate tab AND separate data store.
- **One sanctioned crossover (future, not v1):** a deliberate one-way "I want to grow
  this → add to Garden" action that *creates* a new owned plant from a find; the find
  stays in Forage.

## 7. Screens (mocked in `green-ish.pen`)
1. **Forage Capture** — camera viewfinder, capture hint, shutter, standing safety line.
2. **Forage Result** — species + confidence chip, mandatory toxic-lookalike block (rust
   register), non-dismissable safety strip, link to full info.
3. **Species Detail** — quick facts (edible part / season / habitat / range),
   side-by-side "Tell it apart" comparison vs. the lookalike, how-to-tell bullets,
   source citation.
4. **Low-Confidence state** — name suppressed; "Not confident — too risky to guess";
   unconfirmed possibilities marked *do not eat*; Retake CTA. Neutral/humble register.
5. **Your finds** — history of identified wild plants by hike/date, with triage chips
   (Edible / Cook first / Caution / Unconfirmed).

## 8. Safety mechanisms (baked into UI, not left to the model)
- Never the words "safe to eat."
- A standing, non-dismissable safety strip on every result.
- Mandatory, prominent toxic-lookalike block (rust `#C8553D` on `#F2DDD4`) when one exists.
- Confidence threshold: below it, the species name is hidden and the low-confidence
  state is shown instead.
- Source citation always visible — every claim traces to the dataset.

## 9. Backend sketch
A new ADK tool, `identify_wild_plant(image)`:
1. Gemini Vision proposes candidates from the image.
2. Candidates matched/grounded against the curated PNW dataset.
3. Returns: best match + confidence, lookalikes, and dataset fields — or, below
   threshold, an explicit low-confidence response with unconfirmed candidates.
The tool is forbidden from emitting an edibility verdict; it returns facts + warnings.

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Misidentification → harm | Educational-only framing; lookalike block; confidence threshold; never "safe to eat" |
| Over-trust in the AI | Standing safety strip; citation; humble low-confidence state |
| Dataset gaps | Curated, bounded species list; unknown → low-confidence path, never a guess |
| Scope creep into mushrooms | Explicitly out of v1 |

## 11. Open questions
- Exact confidence threshold (needs tuning against real photos).
- Offline behavior — trails have poor signal; cache dataset on-device?
- Geotagging finds (privacy of forage locations).
