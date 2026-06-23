"""get_weather: current conditions + recent/forecast rain from Open-Meteo (free, no API key)."""
from __future__ import annotations

import httpx

_OPEN_METEO = "https://api.open-meteo.com/v1/forecast"


def get_weather(lat: float, lon: float) -> dict:
    """Fetch local weather for plant-care reasoning.

    Args:
        lat: latitude. lon: longitude.

    Returns:
        {"temp": °C|None, "humidity": %|None, "precip_7d": mm over last 7 days,
         "forecast": [mm per upcoming day]}
    """
    resp = httpx.get(
        _OPEN_METEO,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m",
            "daily": "precipitation_sum",
            "past_days": 7,
            "forecast_days": 3,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    cur = data.get("current", {})
    precip = data.get("daily", {}).get("precipitation_sum", []) or []
    return {
        "temp": cur.get("temperature_2m"),
        "humidity": cur.get("relative_humidity_2m"),
        "precip_7d": round(sum(p for p in precip[:7] if p is not None), 1),
        "forecast": precip[7:],
    }
