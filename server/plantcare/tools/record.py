"""record_diagnosis: structured-output checkpoint. Stores nothing server-side.

When the model calls this, ADK emits the call (with its args) in the response stream;
the app reads those args and saves the record into on-device SwiftData. The tool
just confirms back to the model.
"""
from __future__ import annotations


def record_diagnosis(
    problem: str,
    severity: str,
    health_score: int,
    confidence: float,
    care_steps: list[str],
) -> str:
    """Record a concluded diagnosis for the user's app to save to the plant's history.

    Call this once you have reached a clear diagnosis worth keeping.

    Args:
        problem: short description of the diagnosed issue (e.g. "overwatering").
        severity: one of "low", "medium", "high".
        health_score: the plant's overall health right now, an integer 0-100
            (100 = thriving), judged from the photo and history.
        confidence: how confident you are in this diagnosis, 0.0-1.0.
        care_steps: ordered, concrete actions the user should take.

    Returns:
        "recorded" — confirmation only; the app persists the data from the call itself.
    """
    return "recorded"
