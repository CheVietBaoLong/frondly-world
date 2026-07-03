"""Forage + plant-care analysis service. Stateless: persists nothing.

- ADK plant-care agent mounted via get_fast_api_app (routes: /run, /sessions, ...).
- Forage identify is a deterministic endpoint added onto the same app.

Run: uv run uvicorn main:app --reload
"""
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, UploadFile
from google.adk.cli.fast_api import get_fast_api_app
from pydantic import BaseModel

from forage.identify import identify_wild_plant
from forage.vision import GeminiVision, VisionBackend
from plantcare.tools.schedule import watering_schedule

load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # GEMINI_API_KEY

# The 'plantcare' agent package lives directly under this directory.
# get_fast_api_app already provides a /health route ({"status": "ok"}); we reuse it.
_AGENTS_DIR = str(Path(__file__).resolve().parent)
app = get_fast_api_app(agents_dir=_AGENTS_DIR, web=False)


@lru_cache(maxsize=1)
def get_vision() -> VisionBackend:
    """Single GeminiVision for the process. Overridden with a stub in tests."""
    return GeminiVision()


@app.post("/forage/identify")
async def forage_identify(file: UploadFile, vision: VisionBackend = Depends(get_vision)) -> dict:
    image = await file.read()
    return identify_wild_plant(image, vision).to_dict()


class WateringScheduleRequest(BaseModel):
    species: str
    precip_7d: float = 0
    history: list[dict] = []


@app.post("/plantcare/watering_schedule")
async def plantcare_watering_schedule(body: WateringScheduleRequest) -> dict:
    return watering_schedule(body.species, {"precip_7d": body.precip_7d}, body.history)
