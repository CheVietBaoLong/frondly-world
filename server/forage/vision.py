"""Vision backend seam: Gemini in production, a stub for offline testing.

identify_wild_plant depends only on the VisionBackend protocol, so scope 2 swaps
StubVision -> GeminiVision with no change to the safety logic.
"""
from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel

from google.genai import errors as genai_errors


@dataclass
class Candidate:
    name: str
    scientific_name: str
    confidence: float  # 0.0-1.0, the model's confidence in this identification


class VisionBackend(Protocol):
    def identify(self, image) -> list[Candidate]:
        """Return candidate identifications (any order; caller sorts by confidence)."""
        ...


class StubVision:
    """Deterministic backend for local testing.

    Pass a flat list (used for every image) or a dict keyed by the image value
    (e.g. a filename) for per-input control.
    """

    def __init__(self, candidates):
        self._candidates = candidates

    def identify(self, image) -> list[Candidate]:
        c = self._candidates
        if isinstance(c, dict):
            c = c.get(image, [])
        return sorted(c, key=lambda x: x.confidence, reverse=True)


# --- Scope 2: real Gemini backend -------------------------------------------

_MODEL = "gemini-2.5-flash"
_PROMPT = (
    "Identify the wild plant in this photo for a Pacific Northwest foraging app. "
    "Return up to 3 candidate species, ranked most-to-least likely. For each, give the "
    "common name, the scientific (Latin binomial) name, and your confidence from 0.0 to 1.0. "
    "Identify the plant only. Never state or imply whether it is safe to eat."
)


class _GeminiCandidate(BaseModel):
    name: str
    scientific_name: str
    confidence: float


class _GeminiResponse(BaseModel):
    candidates: list[_GeminiCandidate]


def _read_image(image) -> tuple[bytes, str]:
    """Accept raw bytes (assumed JPEG) or a path/str (mime guessed from suffix)."""
    if isinstance(image, (bytes, bytearray)):
        return bytes(image), "image/jpeg"  # ponytail: assume JPEG for raw bytes; pass a path if it isn't
    p = Path(image)
    return p.read_bytes(), mimetypes.guess_type(p.name)[0] or "image/jpeg"


class GeminiVision:
    """Real backend: Gemini 2.5 vision -> structured candidate list.

    The prompt is identification-only; all safety/foraging facts come from the dataset
    layer downstream, never from the model.
    """

    def __init__(self, client=None, model: str = _MODEL, prompt: str = _PROMPT):
        if client is None:
            from google import genai  # lazy: keeps vision.py importable without the SDK
            client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._client = client
        self._model = model
        self._prompt = prompt

    def identify(self, image) -> list[Candidate]:
        from google.genai import types

        image_bytes, mime = _read_image(image)
        try:
            resp = self._client.models.generate_content(
                model=self._model,
                contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), self._prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_GeminiResponse,
                ),
            )
        except genai_errors.ClientError as exc:
            if getattr(exc, "status_code", None) == 429:
                return []
            raise

        parsed: _GeminiResponse = resp.parsed
        cands = [Candidate(c.name, c.scientific_name, c.confidence) for c in parsed.candidates]
        return sorted(cands, key=lambda x: x.confidence, reverse=True)
