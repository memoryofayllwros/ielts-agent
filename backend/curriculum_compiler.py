"""Compile an ordered mini-course plan from weakness vector + skill graph (no video generation)."""
from __future__ import annotations

from typing import Any

from database import aggregate_skill_accuracy_for_user
from lesson_topics_pool import pick_topic_scenario
from lesson_weakness import compute_weakness_vector
from lesson_selection import select_weak_skills_for_user
from skill_graph import prerequisite_skills


async def compile_mini_course_plan(
    user_id: str,
    module: str,
    *,
    max_steps: int = 5,
    lesson_kind_default: str = "speaking_scenario",
) -> dict[str, Any]:
    """
    Returns ordered steps: each step proposes skill_id, topic, scenario, difficulty, lesson_kind.
    Uses weakness vector + prerequisite awareness + practice ranking.
    """
    wv = await compute_weakness_vector(user_id)
    acc = await aggregate_skill_accuracy_for_user(user_id)
    ranked = await select_weak_skills_for_user(user_id, module, limit=20)
    seen: set[str] = set()
    steps: list[dict[str, Any]] = []

    def difficulty_for_skill(sid: str) -> str:
        row = acc.get(sid) or {}
        tot = int(row.get("total", 0))
        accuracy = float(row.get("accuracy", 0.0)) if tot else 0.0
        if tot < 3:
            return "band6"
        if accuracy < 0.45:
            return "band5"
        if accuracy < 0.65:
            return "band6"
        return "band7"

    candidates = [r[0] for r in ranked]
    for sid in candidates:
        if len(steps) >= max(1, min(max_steps, 20)):
            break
        pres = prerequisite_skills(sid)
        for p in pres:
            if p not in seen and p in candidates and p != sid:
                tid, scen, _ = pick_topic_scenario(p, module, seed=f"{user_id}:{p}")
                steps.append(
                    {
                        "skill_id": p,
                        "topic": tid,
                        "scenario": scen,
                        "difficulty": difficulty_for_skill(p),
                        "lesson_kind": lesson_kind_default if module == "speaking" else "skill_explainer",
                        "reason": "prerequisite_for_later_skill",
                    }
                )
                seen.add(p)
                if len(steps) >= max_steps:
                    break
        if sid in seen:
            continue
        tid, scen, _ = pick_topic_scenario(sid, module, seed=f"{user_id}:{sid}")
        steps.append(
            {
                "skill_id": sid,
                "topic": tid,
                "scenario": scen,
                "difficulty": difficulty_for_skill(sid),
                "lesson_kind": lesson_kind_default if module == "speaking" else "skill_explainer",
                "reason": "weakness_ranked",
            }
        )
        seen.add(sid)

    return {
        "module": module,
        "weakness_vector": wv,
        "steps": steps[:max_steps],
    }
