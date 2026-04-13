"""Baseline diagnostic: band estimation helpers (IELTS-style approximations)."""

from typing import Any, Dict, FrozenSet

DIAGNOSTIC_SKILLS: FrozenSet[str] = frozenset({"reading", "listening", "writing", "speaking"})


def percentage_to_estimated_band(pct: float) -> float:
    """Map objective score percentage to an approximate overall band (4.0–8.5)."""
    p = max(0.0, min(100.0, float(pct)))
    if p >= 92:
        return 8.5
    if p >= 82:
        return 7.5
    if p >= 72:
        return 6.5
    if p >= 62:
        return 6.0
    if p >= 52:
        return 5.5
    if p >= 42:
        return 5.0
    if p >= 30:
        return 4.5
    return 4.0


def rubric_band_to_numeric(label: str) -> float:
    """Map rubric labels from writing/speaking evaluators to a numeric anchor band."""
    if not label or not str(label).strip():
        return 6.0
    key = str(label).strip().lower()
    table = {
        "excellent": 8.0,
        "good": 7.0,
        "satisfactory": 6.0,
        "needs improvement": 5.0,
        "poor": 4.0,
    }
    return table.get(key, 6.0)


def average_diagnostic_band(user_doc: Dict[str, Any] | None) -> float | None:
    bands = (user_doc or {}).get("diagnostic_bands") or {}
    if not bands or DIAGNOSTIC_SKILLS - set(bands.keys()):
        return None
    vals = [float(bands[s]) for s in DIAGNOSTIC_SKILLS]
    return round(sum(vals) / len(vals), 1)
