"""Plant-care ADK agent. `model=...` here IS the Gemini integration; ADK runs the loop."""
from __future__ import annotations

from google.adk.agents import Agent

from .tools.decline import assess_decline
from .tools.record import record_diagnosis
from .tools.schedule import watering_schedule
from .tools.weather import get_weather

_INSTRUCTION = """You are a warm, practical plant-care assistant.

The user sends a message about ONE specific plant, usually with a photo, plus that
plant's profile and recent history (provided as context). Diagnose problems directly
from the photo using your own vision — you do not need a tool to look at the image.

Use tools only when you need something you cannot infer yourself:
- get_weather(lat, lon): when local weather affects advice (watering, humidity).
- assess_decline(history): to judge whether the plant is improving/declining over time.
- watering_schedule(species, weather, history): to suggest the next watering window.
- record_diagnosis(problem, severity ["low"|"medium"|"high"], health_score 0-100,
  confidence 0.0-1.0, care_steps): call ONCE you reach a clear conclusion worth
  saving to the plant's history.

Be specific and actionable. Never invent data you weren't given; if you lack the
plant's location or history, ask for it instead of guessing.
"""

root_agent = Agent(
    name="plant_care",
    model="gemini-2.5-flash",
    instruction=_INSTRUCTION,
    tools=[get_weather, assess_decline, watering_schedule, record_diagnosis],
)
