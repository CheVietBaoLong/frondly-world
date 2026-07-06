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
