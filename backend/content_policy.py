"""Content policy: tier sampling and exposure-based template weights (no DB access)."""
from __future__ import annotations

import os
import random
from typing import Optional, Tuple


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


def normalized_sample_probs() -> Tuple[float, float, float]:
    """Tier probabilities for exact / cluster / module-wide; renormalised if needed."""
    p1 = _float_env("PRACTICE_SAMPLE_EXACT", 0.3)
    p2 = _float_env("PRACTICE_SAMPLE_CLUSTER", 0.5)
    p3 = _float_env("PRACTICE_SAMPLE_MODULE", 0.2)
    s = p1 + p2 + p3
    if s <= 0:
        return (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)
    return (p1 / s, p2 / s, p3 / s)


def sample_primary_tier(rng: random.Random, planner_focus: Optional[str]) -> int:
    """1 = exact micro-skill, 2 = sibling cluster, 3 = module-wide pool."""
    if not planner_focus:
        return 3
    p1, p2, _p3 = normalized_sample_probs()
    r = rng.random()
    if r < p1:
        return 1
    if r < p1 + p2:
        return 2
    return 3


def tier_attempt_order(primary: int) -> list[int]:
    """On empty tier, broaden: prefer moving to wider pools after the sampled tier."""
    return {1: [1, 2, 3], 2: [2, 3, 1], 3: [3, 2, 1]}[primary]


def template_exposure_weight(
    template_doc: dict,
    exposure_counts: dict[str, int],
    eps: float,
) -> float:
    """MVP: weight by template row focus_micro_skill; wildcards get uniform 1.0."""
    fid = template_doc.get("focus_micro_skill")
    if fid:
        return 1.0 / (eps + float(exposure_counts.get(str(fid), 0)))
    return 1.0
