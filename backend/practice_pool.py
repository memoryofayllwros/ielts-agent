"""Practice template pool: policy-driven selection, dedup, optional difficulty relax."""
from __future__ import annotations

import copy
import os
import random
import re
from typing import Optional

from content_policy import (
    sample_primary_tier,
    template_exposure_weight,
    tier_attempt_order,
)
from database import (
    exposure_window_start_iso,
    fetch_practice_templates,
    list_used_template_ids,
    recent_skill_exposure_counts,
)
from skills_taxonomy import skill_ids_in_same_cluster


def practice_template_pool_enabled() -> bool:
    v = os.environ.get("USE_PRACTICE_TEMPLATE_POOL", "").strip().lower()
    return v in ("1", "true", "yes")


def _relax_difficulty_enabled() -> bool:
    v = os.environ.get("PRACTICE_POOL_RELAX_DIFFICULTY", "").strip().lower()
    return v in ("1", "true", "yes")


def _difficulty_variants(primary: str) -> list[str]:
    if not _relax_difficulty_enabled():
        return [primary]
    m = re.match(r"^band(\d+)$", primary.strip().lower())
    if not m:
        return [primary]
    n = int(m.group(1))
    out: list[str] = []
    for x in (n, n - 1, n + 1):
        if 4 <= x <= 8:
            b = f"band{x}"
            if b not in out:
                out.append(b)
    return out if out else [primary]


def _filter_tier(
    unused: list[dict],
    tier: int,
    planner_focus: Optional[str],
) -> list[dict]:
    if tier == 3:
        return list(unused)
    if not planner_focus:
        return []
    cluster = skill_ids_in_same_cluster(planner_focus)
    if tier == 1:
        return [t for t in unused if t.get("focus_micro_skill") == planner_focus]
    return [
        t
        for t in unused
        if t.get("focus_micro_skill")
        and t["focus_micro_skill"] != planner_focus
        and t["focus_micro_skill"] in cluster
    ]


def _weighted_pick(
    rng: random.Random,
    items: list[dict],
    exposure: dict[str, int],
    eps: float,
) -> dict:
    weights = [template_exposure_weight(t, exposure, eps) for t in items]
    return rng.choices(items, weights=weights, k=1)[0]


async def pick_template_from_pool(
    user_id: str,
    skill: str,
    difficulty: str,
    planner_focus: Optional[str],
    writing_task_type: Optional[str] = None,
) -> Optional[dict]:
    if not practice_template_pool_enabled():
        return None

    rng = random.SystemRandom()
    try:
        days = int(os.environ.get("PRACTICE_EXPOSURE_WINDOW_DAYS", "7") or 7)
    except ValueError:
        days = 7
    days = max(1, days)
    since = exposure_window_start_iso(days)
    exposure = await recent_skill_exposure_counts(user_id, since)
    try:
        eps = float(os.environ.get("PRACTICE_EXPOSURE_EPS", "0.5") or 0.5)
    except ValueError:
        eps = 0.5
    eps = max(0.01, eps)

    used = await list_used_template_ids(user_id, skill)
    wtype = writing_task_type if skill == "writing" else None

    for dd in _difficulty_variants(difficulty):
        templates = await fetch_practice_templates(skill, dd, writing_task_type=wtype)
        unused = [t for t in templates if str(t.get("_id", "")) not in used]
        if not unused:
            continue

        primary = sample_primary_tier(rng, planner_focus)
        for tier in tier_attempt_order(primary):
            candidates = _filter_tier(unused, tier, planner_focus)
            if not candidates:
                continue
            picked = _weighted_pick(rng, candidates, exposure, eps)
            out = copy.deepcopy(picked)
            return out

    return None


def instantiate_session_from_template(template_doc: dict) -> tuple[dict, str]:
    """Return session_data and template _id for save_session."""
    tid = str(template_doc["_id"])
    data = copy.deepcopy(template_doc.get("session_data") or {})
    return data, tid
