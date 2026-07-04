"""Houseplant identification prompt for POST /plantcare/identify.

Reuses the generic GeminiVision backend (forage/vision.py) with a houseplant
prompt. Deliberately identification-only: no edibility, no care advice, and NO
curated-dataset gate — unlike Forage, a wrong houseplant name is harmless and
the user edits the prefilled field before saving.
"""
from __future__ import annotations

HOUSEPLANT_PROMPT = (
    "Identify the houseplant or indoor/garden ornamental plant in this photo. "
    "Return up to 3 candidate species, ranked most-to-least likely. For each, give the "
    "common name, the scientific (Latin binomial) name, and your confidence from 0.0 to 1.0. "
    "Identify the plant only — do not give care advice or say anything about edibility."
)
