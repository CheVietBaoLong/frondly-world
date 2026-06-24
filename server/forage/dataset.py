"""Curated PNW forage dataset: load once, match Gemini candidates against verified entries.

The dataset is the authority layer. Gemini says what a plant is; only a match here lets
the app surface any facts or warnings about it.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "forage_pnw.json"


def _norm(s: str | None) -> str:
    return " ".join(s.lower().split()) if s else ""


@dataclass
class Match:
    entry: dict
    table: str  # "species" | "toxic_reference"


class Dataset:
    def __init__(self, raw: dict):
        self.meta = raw.get("meta", {})
        self.species = raw.get("species", [])
        self.toxic_reference = raw.get("toxic_reference", [])
        self._index: dict[str, Match] = {}
        # toxic_reference first so a name shared with an edible resolves to the warning.
        for table, entries in (("toxic_reference", self.toxic_reference), ("species", self.species)):
            for e in entries:
                for key in self._name_keys(e):
                    self._index.setdefault(key, Match(e, table))

    @staticmethod
    def _name_keys(entry: dict) -> list[str]:
        keys = [_norm(entry.get(f)) for f in ("id", "common_name", "scientific_name")]
        keys += [_norm(s) for s in (entry.get("synonyms") or [])]
        return [k for k in keys if k]

    def match(self, *names: str) -> Match | None:
        """First verified entry matching any given name (pass scientific name first)."""
        for n in names:
            hit = self._index.get(_norm(n))
            if hit:
                return hit
        return None


def load(path: Path = _DATA_PATH) -> Dataset:
    return Dataset(json.loads(path.read_text(encoding="utf-8")))
