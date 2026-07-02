"""identify_wild_plant -- the Forage ADK tool.

Safety contract, enforced by the type system: this tool has NO "safe to eat" output.
Gemini identifies; the curated dataset authorizes what we say. Four mutually exclusive
result states; below the confidence threshold the species name is suppressed.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field

from .dataset import Dataset, load as load_dataset
from .vision import VisionBackend

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.70  # placeholder; tune against real trail photos

SAFETY_STRIP = (
    "Educational identification only. Never eat a wild plant based on this app alone — "
    "confirm with an expert and a printed field guide first."
)
RESEARCHING_NOTE = (
    "We only show foraging information for plants in our research-verified database. "
    "We're expanding verified coverage — more plants are coming."
)
SERVICE_UNAVAILABLE_NOTE = (
    "The plant ID service is temporarily unavailable. We could not verify this plant right now, "
    "so we’re showing a safe low-confidence fallback instead."
)

_FACT_FIELDS = ("edible_part", "preparation", "season", "habitat", "range")


@dataclass
class ForageResult:
    state: str                      # verified_edible | verified_toxic | unverified | low_confidence
    confidence: float
    name: str | None = None         # suppressed (None) below threshold
    scientific_name: str | None = None
    edibility: str | None = None    # descriptive only — always paired with safety_caveat
    facts: dict | None = None
    toxic_lookalikes: list = field(default_factory=list)
    benign_lookalikes: list = field(default_factory=list)
    safety_caveat: str | None = None
    warning: str | None = None              # verified_toxic
    possible_matches: list = field(default_factory=list)  # low_confidence: do-not-eat
    message: str | None = None
    sources: list = field(default_factory=list)
    safety_strip: str = SAFETY_STRIP        # standing, non-dismissable

    def to_dict(self) -> dict:
        return asdict(self)


def identify_wild_plant(image, vision: VisionBackend, dataset: Dataset | None = None) -> ForageResult:
    ds = dataset or load_dataset()
    try:
        candidates = vision.identify(image)
    except Exception:
        logger.exception("vision.identify failed")
        return ForageResult("low_confidence", 0.0, message=SERVICE_UNAVAILABLE_NOTE)

    if not candidates:
        return ForageResult("low_confidence", 0.0, message=RESEARCHING_NOTE)

    top = candidates[0]

    # Low confidence IS the safety feature here: suppress the name.
    if top.confidence < CONFIDENCE_THRESHOLD:
        return ForageResult(
            "low_confidence",
            top.confidence,
            possible_matches=[c.name for c in candidates[:3]],
            message=RESEARCHING_NOTE,
        )

    match = ds.match(top.scientific_name, top.name)

    # Confident, but no verified entry — show Gemini's reach, withhold safety data.
    if match is None:
        return ForageResult(
            "unverified",
            top.confidence,
            name=top.name,
            scientific_name=top.scientific_name,
            message=RESEARCHING_NOTE,
        )

    entry = match.entry
    if match.table == "toxic_reference":
        return ForageResult(
            "verified_toxic",
            top.confidence,
            name=entry.get("common_name"),
            scientific_name=entry.get("scientific_name"),
            warning=entry.get("why_dangerous"),
            message="Do not eat. This is a known toxic plant in our verified database.",
            sources=entry.get("source", []),
        )

    return ForageResult(
        "verified_edible",
        top.confidence,
        name=entry.get("common_name"),
        scientific_name=entry.get("scientific_name"),
        edibility=entry.get("edibility"),
        facts={k: entry[k] for k in _FACT_FIELDS if entry.get(k)},
        toxic_lookalikes=entry.get("toxic_lookalikes", []),
        benign_lookalikes=entry.get("benign_lookalikes", []),
        safety_caveat=entry.get("safety_caveat"),
        sources=entry.get("source", []),
    )
