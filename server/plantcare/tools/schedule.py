"""watering_schedule: next watering window from species + recent rain + history. Pure, offline."""
from __future__ import annotations

from datetime import date, timedelta

_DEFAULT_INTERVAL_DAYS = 7
# ponytail: small species table; swap for a per-species model only if accuracy needs it.
_SPECIES_INTERVALS = {
    "monstera": 7,
    "pothos": 7,
    "snake plant": 14,
    "succulent": 14,
    "cactus": 21,
    "fern": 4,
    "fiddle leaf fig": 7,
    "peace lily": 5,
}


def watering_schedule(species: str, weather: dict, history: list[dict]) -> dict:
    """Compute the next watering window.

    Args:
        species: common name (case-insensitive); unknown -> 7-day default.
        weather: {"precip_7d": mm of rain in the last 7 days, ...}. +1 day per 10mm,
            capped at 2x the base interval.
        history: observations with "date" keys; the latest date is treated as last-watered.

    Returns:
        {"next_water_date": "YYYY-MM-DD"|None, "interval_days": int, "reason": str}
    """
    base = _SPECIES_INTERVALS.get((species or "").lower().strip(), _DEFAULT_INTERVAL_DAYS)
    precip = float((weather or {}).get("precip_7d") or 0)
    interval = min(base + int(precip // 10), base * 2)

    last = max((h["date"] for h in history if h.get("date")), default=None)
    next_date = (
        (date.fromisoformat(last) + timedelta(days=interval)).isoformat() if last else None
    )
    extra = interval - base
    reason = f"{species or 'plant'}: base {base}d" + (
        f", +{extra}d for {precip:g}mm recent rain" if extra else ", no rain adjustment"
    )
    return {"next_water_date": next_date, "interval_days": interval, "reason": reason}
