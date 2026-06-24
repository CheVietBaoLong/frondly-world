"""assess_decline: trend over the plant's app-supplied observation history. Pure, offline."""
from __future__ import annotations

_HEALTH_ORDER = {"poor": 0, "fair": 1, "good": 2, "thriving": 3}


def assess_decline(history: list[dict]) -> dict:
    """Assess whether a plant is improving, stable, or declining.

    Args:
        history: observations, each {"date": "YYYY-MM-DD", "health": one of
            "poor"|"fair"|"good"|"thriving"}. Any order; <2 valid points -> "stable".

    Returns:
        {"trend": "improving"|"declining"|"stable", "signals": [str], "since": str|None}
    """
    obs = sorted(
        (h for h in history if h.get("date") and h.get("health") in _HEALTH_ORDER),
        key=lambda h: h["date"],
    )
    if len(obs) < 2:
        return {"trend": "stable", "signals": [], "since": obs[-1]["date"] if obs else None}

    scores = [_HEALTH_ORDER[h["health"]] for h in obs]
    delta = scores[-1] - scores[0]
    trend = "improving" if delta > 0 else "declining" if delta < 0 else "stable"
    signals = [
        f'{obs[i]["date"]}: {obs[i - 1]["health"]} -> {obs[i]["health"]}'
        for i in range(1, len(obs))
        if scores[i] < scores[i - 1]
    ]
    return {"trend": trend, "signals": signals, "since": obs[0]["date"]}
