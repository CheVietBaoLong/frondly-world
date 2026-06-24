"""record_diagnosis: structured-output checkpoint. Stores nothing server-side.

When the model calls this, ADK emits the call (with its args) in the response stream;
the iOS app reads those args and saves the record into on-device SwiftData. The tool
just confirms back to the model.
"""
from __future__ import annotations


def record_diagnosis(problem: str, severity: str, care_steps: list[str]) -> str:
    """Record a concluded diagnosis for the user's app to save to the plant's history.

    Call this once you have reached a clear diagnosis worth keeping.

    Args:
        problem: short description of the diagnosed issue (e.g. "overwatering").
        severity: one of "low", "medium", "high".
        care_steps: ordered, concrete actions the user should take.

    Returns:
        "recorded" — confirmation only; the app persists the data from the call itself.
    """
    return "recorded"
