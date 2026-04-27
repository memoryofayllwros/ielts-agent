"""Weakness vector: aggregate practice accuracy into named dimensions for lesson targeting."""
from __future__ import annotations

from typing import Any, Optional

from database import aggregate_skill_accuracy_for_user, upsert_user_weakness_vector
from lesson_selection import select_weak_skills_for_user
from skills_taxonomy import skill_ids_for_module


def _weak(accuracy: Optional[float], total: int) -> float:
    """Higher = more weakness (0..1)."""
    if total < 1 or accuracy is None:
        return 0.35
    return max(0.0, min(1.0, 1.0 - float(accuracy)))


def _prefix_bucket(sid: str) -> Optional[str]:
    if len(sid) < 2:
        return None
    p = sid[0].upper()
    rest = sid[1:2] if len(sid) > 1 else ""
    if p == "S" and rest == "1":
        return "fluency"
    if p == "S" and rest == "2":
        return "pronunciation"
    if p == "S" and rest == "3":
        return "lexical"
    if p == "S" and rest == "4":
        return "grammar"
    return None


async def compute_weakness_vector(user_id: str) -> dict[str, float]:
    """
    Build a cross-module weakness map. Speaking uses S-prefix buckets; other modules contribute
    a single rolled-up score per module key.
    """
    acc = await aggregate_skill_accuracy_for_user(user_id)
    vec: dict[str, float] = {
        "fluency": 0.0,
        "lexical": 0.0,
        "grammar": 0.0,
        "pronunciation": 0.0,
        "reading": 0.0,
        "listening": 0.0,
        "writing": 0.0,
    }
    counts: dict[str, int] = {k: 0 for k in vec}

    for sid, row in acc.items():
        tot = int(row.get("total", 0))
        if tot < 1:
            continue
        accuracy = float(row.get("accuracy", 0.0))
        w = _weak(accuracy, tot)
        b = _prefix_bucket(sid)
        if b:
            vec[b] += w
            counts[b] += 1
        mod = sid[0].upper() if sid else ""
        if mod == "R":
            vec["reading"] += w
            counts["reading"] += 1
        elif mod == "L":
            vec["listening"] += w
            counts["listening"] += 1
        elif mod == "W":
            vec["writing"] += w
            counts["writing"] += 1

    for k in list(vec.keys()):
        n = counts[k]
        if n > 0:
            vec[k] = round(vec[k] / n, 4)
        else:
            vec[k] = round(vec[k], 4)
    return vec


async def refresh_stored_weakness_vector(user_id: str) -> dict[str, float]:
    v = await compute_weakness_vector(user_id)
    await upsert_user_weakness_vector(user_id, v)
    return v


def weakness_boost_for_skill(skill_id: str, weakness_vector: dict[str, float]) -> float:
    """Multiplier >=1 used to re-rank skills (higher weakness in relevant bucket boosts priority)."""
    b = _prefix_bucket(skill_id)
    if b and b in weakness_vector:
        return 1.0 + 0.5 * weakness_vector[b]
    mod = skill_id[0].upper() if skill_id else ""
    key = {"R": "reading", "L": "listening", "W": "writing"}.get(mod)
    if key and key in weakness_vector:
        return 1.0 + 0.35 * weakness_vector[key]
    return 1.0


async def select_skill_weighted(
    user_id: str,
    module: str,
    weakness_vector: Optional[dict[str, float]] = None,
    limit: int = 10,
) -> str:
    """
    Pick one skill_id: among ranked weak skills, weight by weakness_vector boost.
    """
    ranked = await select_weak_skills_for_user(user_id, module, limit=limit)
    if not ranked:
        ids = skill_ids_for_module(module)
        return ids[0] if ids else ""
    wv = weakness_vector or {}
    best_sid: Optional[str] = None
    best_score = -1.0
    for sid, accuracy, tot, base_priority in ranked:
        boost = weakness_boost_for_skill(sid, wv)
        combined = base_priority * boost
        if combined > best_score:
            best_score = combined
            best_sid = sid
    return best_sid or ranked[0][0]


def merge_evaluation_into_speaking_weakness(
    weakness_vector: dict[str, float],
    evaluation: dict[str, Any],
) -> dict[str, float]:
    """Nudge vector from a speaking rubric (category_scores)."""
    out = dict(weakness_vector)
    for row in evaluation.get("category_scores") or []:
        name = (row.get("category") or "").lower()
        sc = int(row.get("score", 0))
        mx = int(row.get("max_score", 1)) or 1
        gap = max(0.0, min(1.0, 1.0 - sc / mx))
        if "fluency" in name or "coherence" in name:
            out["fluency"] = round(max(out.get("fluency", 0), gap), 4)
        elif "lexical" in name:
            out["lexical"] = round(max(out.get("lexical", 0), gap), 4)
        elif "grammar" in name:
            out["grammar"] = round(max(out.get("grammar", 0), gap), 4)
        elif "pronunciation" in name:
            out["pronunciation"] = round(max(out.get("pronunciation", 0), gap), 4)
    return out
