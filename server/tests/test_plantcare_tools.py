"""Offline self-checks for plant-care tools. Run: python tests/test_plantcare_tools.py"""
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from plantcare.tools.decline import assess_decline
from plantcare.tools.record import record_diagnosis
from plantcare.tools.schedule import watering_schedule


def test_decline_detects_downward_trend():
    h = [
        {"date": "2026-06-01", "health": "thriving"},
        {"date": "2026-06-10", "health": "good"},
        {"date": "2026-06-20", "health": "fair"},
    ]
    r = assess_decline(h)
    assert r["trend"] == "declining", r
    assert r["signals"], r  # at least one step-down recorded


def test_decline_detects_improvement():
    h = [
        {"date": "2026-06-01", "health": "poor"},
        {"date": "2026-06-15", "health": "good"},
    ]
    assert assess_decline(h)["trend"] == "improving"


def test_decline_stable_and_insufficient():
    assert assess_decline([])["trend"] == "stable"
    assert assess_decline([{"date": "2026-06-01", "health": "good"}])["trend"] == "stable"


def test_schedule_base_interval_no_rain():
    h = [{"date": "2026-06-20", "health": "good"}]
    r = watering_schedule("monstera", {"precip_7d": 0}, h)
    assert r["interval_days"] == 7, r
    assert r["next_water_date"] == "2026-06-27", r


def test_schedule_rain_extends_interval():
    h = [{"date": "2026-06-20", "health": "good"}]
    r = watering_schedule("monstera", {"precip_7d": 30}, h)  # +3 days
    assert r["interval_days"] == 10, r
    assert r["next_water_date"] == "2026-06-30", r


def test_schedule_unknown_species_default_and_no_history():
    r = watering_schedule("mystery plant", {}, [])
    assert r["interval_days"] == 7
    assert r["next_water_date"] is None


import plantcare.tools.weather as weather_mod
from plantcare.tools.weather import get_weather


class _FakeResp:
    def __init__(self, payload):
        self._p = payload
    def raise_for_status(self):
        pass
    def json(self):
        return self._p


def test_get_weather_parses_and_sums_precip():
    payload = {
        "current": {"temperature_2m": 18.5, "relative_humidity_2m": 72},
        "daily": {"precipitation_sum": [2, 0, 5, 1, 0, 3, 0,  4, 0, 1]},  # 7 past + 3 forecast
    }
    orig = weather_mod.httpx.get
    weather_mod.httpx.get = lambda *a, **k: _FakeResp(payload)
    try:
        r = get_weather(47.6, -122.3)
    finally:
        weather_mod.httpx.get = orig
    assert r["temp"] == 18.5 and r["humidity"] == 72, r
    assert r["precip_7d"] == 11.0, r          # sum of first 7
    assert r["forecast"] == [4, 0, 1], r       # remaining days


def test_record_diagnosis_returns_confirmation():
    assert (
        record_diagnosis(
            "overwatering", "medium", 55, 0.85, ["let soil dry", "check drainage"]
        )
        == "recorded"
    )


def test_record_diagnosis_signature_matches_client_contract():
    # The RN client reads these exact snake_case arg names from the
    # functionCall event — order and names are a wire contract.
    assert list(inspect.signature(record_diagnosis).parameters) == [
        "problem",
        "severity",
        "health_score",
        "confidence",
        "care_steps",
    ]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nall {len(tests)} passed")
