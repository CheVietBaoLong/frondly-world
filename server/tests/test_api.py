"""Offline self-check for the HTTP seam. Stubs vision; no API call.

Run: python tests/test_api.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from forage.vision import Candidate, StubVision
from main import app, get_vision

app.dependency_overrides[get_vision] = lambda: StubVision(
    [Candidate("Salmonberry", "Rubus spectabilis", 0.95)]
)
client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}  # ADK's built-in health route


def test_plantcare_app_name_discoverable():
    # app_name the iOS client must use is the folder name "plantcare", not the agent's internal name "plant_care"
    r = client.get("/list-apps")
    assert r.status_code == 200, r.text
    assert "plantcare" in r.json()


def test_identify_returns_state_without_safe_verdict():
    r = client.post("/forage/identify", files={"file": ("p.jpg", b"\xff\xd8x", "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "verified_edible", body
    assert body["name"] == "Salmonberry"
    assert "safe_to_eat" not in body  # contract survives serialization
    assert body["safety_strip"]       # standing educational-only line always present


def test_watering_schedule_endpoint():
    r = client.post(
        "/plantcare/watering_schedule",
        json={"species": "monstera", "precip_7d": 30, "history": [{"date": "2026-06-20"}]},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {
        "next_water_date": "2026-06-30",
        "interval_days": 10,
        "reason": "monstera: base 7d, +3d for 30mm recent rain",
    }


def test_watering_schedule_endpoint_defaults_empty_history():
    r = client.post("/plantcare/watering_schedule", json={"species": "unknown plant"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["next_water_date"] is None
    assert body["interval_days"] == 7


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nall {len(tests)} passed")
