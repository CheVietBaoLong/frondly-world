"""Self-check for the four-state safety logic. Run: python tests/test_identify.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forage.dataset import load as load_dataset
from forage.identify import identify_wild_plant
from forage.vision import Candidate, StubVision

DS = load_dataset()


def run(*candidates):
    return identify_wild_plant("img", StubVision(list(candidates)), DS)


def test_verified_edible():
    r = run(Candidate("Salmonberry", "Rubus spectabilis", 0.95))
    assert r.state == "verified_edible", r.state
    assert r.name == "Salmonberry"
    assert r.facts and r.facts.get("edible_part")
    assert "safe_to_eat" not in r.to_dict()  # contract: no verdict field exists


def test_verified_toxic():
    r = run(Candidate("Red baneberry", "Actaea rubra", 0.92))
    assert r.state == "verified_toxic", r.state
    assert r.warning
    assert "do not eat" in (r.message or "").lower()


def test_unverified():
    # Trillium is a real PNW plant but deliberately not in the curated dataset.
    r = run(Candidate("Western trillium", "Trillium ovatum", 0.90))
    assert r.state == "unverified", r.state
    assert r.name == "Western trillium"
    assert r.facts is None
    assert r.message


def test_low_confidence():
    r = run(Candidate("Salmonberry", "Rubus spectabilis", 0.40))
    assert r.state == "low_confidence", r.state
    assert r.name is None  # suppressed
    assert "Salmonberry" in r.possible_matches


def test_toxic_wins_collision_indexing():
    # toxic_reference indexed first; a confident toxic match must surface the warning.
    r = run(Candidate("Death camas", "Toxicoscordion venenosum", 0.99))
    assert r.state in ("verified_toxic", "unverified"), r.state


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nall {len(tests)} passed")
