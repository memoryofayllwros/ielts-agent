"""Rank micro-skills by weakness for lesson generation (priority score)."""
from __future__ import annotations

import math
from typing import Any, Optional

from database import aggregate_skill_accuracy_for_user
from skills_taxonomy import get_skill_label, skill_ids_for_module


def module_for_skill_id(skill_id: str) -> Optional[str]:
    if not skill_id:
        return None
    p = skill_id[0].upper()
    return {"R": "reading", "L": "listening", "W": "writing", "S": "speaking"}.get(p)


async def select_weak_skills_for_user(
    user_id: str,
    module: str,
    limit: int = 10,
) -> list[tuple[str, float, int, float]]:
    """
    Return up to `limit` rows: (skill_id, accuracy, total, priority_score),
    sorted by priority_score descending.
    """
    acc = await aggregate_skill_accuracy_for_user(user_id)
    ids = skill_ids_for_module(module)
    ranked: list[tuple[str, float, int, float]] = []
    for sid in ids:
        row = acc.get(sid) or {}
        tot = int(row.get("total", 0))
        if tot < 1:
            continue
        accuracy = float(row.get("accuracy", 0.0))
        score = (1.0 - accuracy) * math.log(tot + 1.0)
        ranked.append((sid, accuracy, tot, score))
    ranked.sort(key=lambda x: -x[3])
    if not ranked:
        # Cold start: no practice outcomes for this module yet.
        return [(sid, 0.0, 0, 0.0) for sid in ids[: max(1, min(limit, len(ids)))]]
    return ranked[: max(1, min(limit, len(ranked)))]


async def build_why_this_lesson(user_id: str, skill_id: str) -> dict[str, Any]:
    """Snapshot for UX: labels and stats at generation time."""
    acc = await aggregate_skill_accuracy_for_user(user_id)
    row = acc.get(skill_id) or {}
    tot = int(row.get("total", 0))
    accuracy = float(row.get("accuracy", 0.0)) if tot else None
    lbl = get_skill_label(skill_id)
    if tot:
        summary = (
            f"This lesson was generated because {lbl} is among your weaker areas "
            f"in recent practice (about {accuracy:.0%} accuracy over {tot} attempts)."
        )
    else:
        summary = (
            f"This lesson introduces {lbl}. Complete a few more practice sessions "
            "so we can rank skills from your real accuracy data."
        )
    return {
        "skill_id": skill_id,
        "skill_label": lbl,
        "accuracy_at_generation": accuracy,
        "attempts_at_generation": tot,
        "summary": summary,
    }
