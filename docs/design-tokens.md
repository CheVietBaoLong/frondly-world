# Green-ish — Design Tokens

Cozy Botanical palette & type. Copy-paste reference to keep the app consistent.

## Color

| Token | Hex | Usage |
|---|---|---|
| Paper / background | `#EEF1E9` | App background |
| Surface / card | `#F7F8F3` | Cards, chips, surfaces |
| Forest (primary text) | `#20322A` | Primary text, dark cards, CTAs |
| Secondary text | `#7A7F76` | Subtitles, labels, captions |
| Citron (accent) | `#C7D64F` | Active tab, highlights, primary accent |
| Sage swatch | `#BFD0A8` | Photo placeholders, icon backgrounds |
| Mint (positive bg) | `#E4EAD8` | Confidence / edible chip background |
| Leaf (positive text) | `#5C7E4A` | Confidence / edible chip text |
| Rust (warning text) | `#C8553D` | Toxic-lookalike / caution text |
| Blush (warning bg) | `#F2DDD4` | Toxic-lookalike / caution card |
| Stone (neutral bg) | `#ECEEE8` | Unknown / low-confidence state |
| Border | `#DCE2D2` | Strokes, dividers, hairlines |
| On-dark secondary | `#C3CDBE` | Secondary text on dark (#20322A) cards |

## Type

| Role | Font | Weights | Used for |
|---|---|---|---|
| Display | **Fraunces** (serif) | 700 | Headings, plant names, scores |
| Body / UI | **Mulish** (humanist sans) | 400 / 500 / 600 | Body text, labels, chips, nav |

### Type scale (current usage)
| Style | Font | Size | Weight |
|---|---|---|---|
| Screen title | Fraunces | 26 | 700 |
| Card / plant name | Fraunces | 17 | 700 |
| Body | Mulish | 13–15 | 400 |
| Emphasis / chip | Mulish | 12 | 600 |
| Label (uppercase) | Mulish | 11 | 600 (letter-spacing ~0.5) |

## SwiftUI snippet

```swift
extension Color {
    static let paper      = Color(hex: "EEF1E9")
    static let surface    = Color(hex: "F7F8F3")
    static let forest     = Color(hex: "20322A")
    static let secondary  = Color(hex: "7A7F76")
    static let citron     = Color(hex: "C7D64F")
    static let sage       = Color(hex: "BFD0A8")
    static let mintBg     = Color(hex: "E4EAD8")
    static let leafText   = Color(hex: "5C7E4A")
    static let rust       = Color(hex: "C8553D")
    static let blushBg    = Color(hex: "F2DDD4")
    static let stoneBg    = Color(hex: "ECEEE8")
    static let border     = Color(hex: "DCE2D2")
}
// Fonts: "Fraunces" (display), "Mulish" (body/UI)
```
