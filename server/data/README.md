# Forage dataset — `forage_pnw.json`

Grounding data for the **Forage** feature (educational wild-plant ID for the Pacific Northwest / Cascadia bioregion: WA · OR · ID · S. BC).

## ⚠️ Safety contract
This data is an **educational field-ID aid only**. It must **never** be used to tell a user a plant is *safe to eat*. The eat/don't-eat decision always stays with the user and a qualified field guide. Below the model's confidence threshold, the app **suppresses the species name** and shows the low-confidence state.

## Shape
```jsonc
{
  "meta":   { bioregion, disclaimer, safety_notes[], sources_general[], verification_note },
  "species":         [ /* 10 edible / edible-with-prep / caution entries */ ],
  "toxic_reference": [ /* 5 standalone "deadly — do not eat" entries */ ]
}
```

### `species[]`
| field | notes |
|---|---|
| `id`, `common_name`, `scientific_name`, `synonyms[]` | identity |
| `edibility` | `edible` \| `edible-with-prep` \| `caution` |
| `edible_part`, `preparation` | `preparation` is machine-readable and **critical** (e.g. red elderberry: ripe + cooked + seed-strained) |
| `season`, `habitat`, `range` | range notes call out LOW-confidence Idaho coverage |
| `toxic_lookalikes[]` | `{ common_name, scientific_name, severity, why_confused, how_to_tell_apart }` |
| `benign_lookalikes[]` | edible/harmless confusions (don't alarm the user) |
| `safety_caveat`, `source[]` | |

### `toxic_reference[]`
Deadly plants as first-class records so the matcher can surface a warning even when they aren't a specific species' listed lookalike: `severity, toxin, why_dangerous, key_id, confused_with[], how_to_tell_apart, do_not_confuse, habitat, range, antidote, source[]`.

## Editing rules
- Keep lethal-dose language **qualitative** ("a small amount can be fatal"). Specific thresholds in the literature are low/moderate confidence.
- Don't conflate the two hemlocks: *Conium* (poison hemlock) = hairless purple-blotched stem, paralysis; *Cicuta* (water hemlock) = chambered yellow-oily root, seizures. **Purple stem mottling = Conium, not Cicuta.**
- Before relying on this in production, a human should open the WSU/OSU/BLM source URLs directly — several block automated fetch (HTTP 403), so those facts were cross-corroborated, not read first-hand. See `meta.verification_note`.

## Coverage status (v0.2.0)
**53 entries: 39 edible species (16 `edible` / 12 `edible-with-prep` / 11 `caution`) + 14 `toxic_reference` deadly/toxic plants.** 15 edible species carry a deadly lookalike. **Mushrooms are intentionally excluded.**

Cross-cutting safety findings baked into `meta.safety_notes`:
- **Red baneberry** is the #1 deadly lookalike for nearly every red/dark forest berry; its berries can be red OR white — ID by growth form, never color.
- **Common camas vs death camas** is the highest-stakes confusion — identical out of flower; harvest only in bloom (blue = camas, white = death camas); cooking does not detoxify a misID.
- **Apiaceae (carrot family)**: watercress & cow parsnip share habitat with deadly water/poison hemlock — never edible without expert confirmation.
- **Cattail vs yellow flag iris**: the toxic iris rhizome is exactly what's mistaken for the edible cattail rhizome.
- `youth-on-age` (*Tolmiea menziesii*) was deliberately excluded — only a single bitter tribal food record, not a credible edible.

> Note: the Pencil mockup uses red huckleberry as its worked example. Salmonberry (also in the data) has **no** deadly lookalike — its baneberry-style warning belongs to red huckleberry. The dataset is the source of truth.
