"""Live smoke test: real Gemini call through the ADK Runner. Costs a token or two.

Run: GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' ../.env | cut -d= -f2-) \\
     .venv/bin/python tests/smoke_plantcare.py

NOT part of the offline test suite — manual/live only.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google.adk.runners import InMemoryRunner
from google.genai import types

from plantcare.agent import root_agent

# ADK 2.3 API notes (verified by inspection):
#   - InMemoryRunner(agent, app_name) takes those exact kwargs
#   - runner.session_service.create_session is async; requires app_name + user_id
#   - run_async requires user_id + session_id + new_message
#   - event.get_function_calls() -> list[FunctionCall] (each has .name)
#   - event.is_final_response() -> bool; final text lives in event.content.parts[*].text


async def main():
    runner = InMemoryRunner(agent=root_agent, app_name="plant_care")
    session = await runner.session_service.create_session(
        app_name="plant_care", user_id="smoke"
    )
    msg = types.Content(
        role="user",
        parts=[types.Part.from_text(
            text="My snake plant in Seattle (lat 47.6, lon -122.3) — when should I water "
                 "it next? Last watered 2026-06-20. Use the weather."
        )],
    )
    saw_tool = False
    final = ""
    async for event in runner.run_async(
        user_id="smoke", session_id=session.id, new_message=msg
    ):
        for fc in event.get_function_calls():
            saw_tool = True
            print("tool call:", fc.name)
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    final = part.text

    print("\nfinal reply:\n", final)
    assert saw_tool, "expected the agent to call at least one tool"
    assert final, "expected a final text reply"
    print("\nsmoke OK")


if __name__ == "__main__":
    asyncio.run(main())
