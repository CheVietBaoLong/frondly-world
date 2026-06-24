"""Offline self-check for GeminiVision's parse/map/sort. No API call.

Run: python tests/test_vision_gemini.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forage.vision import GeminiVision, _GeminiCandidate, _GeminiResponse, _read_image


class _FakeModels:
    def __init__(self, parsed):
        self._parsed = parsed
        self.last_kwargs = None

    def generate_content(self, **kwargs):
        self.last_kwargs = kwargs
        return type("Resp", (), {"parsed": self._parsed})()


class _FakeClient:
    def __init__(self, parsed):
        self.models = _FakeModels(parsed)


def test_maps_and_sorts_by_confidence():
    parsed = _GeminiResponse(candidates=[
        _GeminiCandidate(name="Trailing blackberry", scientific_name="Rubus ursinus", confidence=0.4),
        _GeminiCandidate(name="Salmonberry", scientific_name="Rubus spectabilis", confidence=0.9),
    ])
    v = GeminiVision(client=_FakeClient(parsed))
    out = v.identify(b"\xff\xd8fakejpeg")  # raw bytes path -> no file read
    assert [c.name for c in out] == ["Salmonberry", "Trailing blackberry"], out
    assert out[0].confidence == 0.9


def test_read_image_bytes_defaults_jpeg():
    data, mime = _read_image(b"abc")
    assert data == b"abc" and mime == "image/jpeg", (data, mime)


def test_read_image_path_guesses_mime():
    import tempfile, os
    fd, p = tempfile.mkstemp(suffix=".png")
    os.write(fd, b"x"); os.close(fd)
    try:
        data, mime = _read_image(p)
        assert data == b"x" and mime == "image/png", (data, mime)
    finally:
        os.remove(p)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nall {len(tests)} passed")
