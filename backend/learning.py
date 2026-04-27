"""Skill analytics (aggregation), session summaries, and adaptive focus (MVP, rule-based)."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from skills_taxonomy import get_skill_label

# Module → prefix for micro-skill id (R/L/W/S)
_MOD_PREFIX: dict[str, str] = {
    "reading": "R",
    "listening": "L",
    "writing": "W",
    "speaking": "S",
}

_WRITING_CRITERION_TO_SKILLS: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"task response|task achievement", re.I), ["W1.1_task_response_completeness", "W1.2_idea_relevance"]),
    (re.compile(r"coherence|cohesion", re.I), ["W2.1_paragraph_structure", "W2.2_logical_flow", "W2.3_cohesion_devices"]),
    (re.compile(r"lexical", re.I), ["W3.1_vocabulary_range", "W3.2_paraphrase_usage"]),
    (re.compile(r"grammatical|grammar", re.I), ["W4.1_grammar_accuracy", "W4.2_sentence_complexity"]),
]

_SPEAKING_CRITERION_TO_SKILLS: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"fluency|coherence", re.I), ["S1.1_speech_continuity", "S1.2_hesitation_control"]),
    (re.compile(r"lexical", re.I), ["S3.1_vocabulary_range", "S3.2_paraphrase_usage"]),
    (re.compile(r"grammatical|grammar", re.I), ["S4.1_grammar_accuracy", "S4.2_sentence_complexity"]),
    (re.compile(r"pronunciation", re.I), ["S2.1_clarity_of_pronunciation", "S2.2_stress_and_intonation"]),
]


def _ratio_correct(score: int, max_score: int) -> bool:
    if max_score <= 0:
        return False
    return (score / max_score) >= 0.5


def writing_evaluation_to_skill_outcomes(evaluation: dict, task: dict) -> list[dict[str, Any]]:
    """Map IELTS-style category scores to fixed writing micro-skill rows."""
    out: list[dict[str, Any]] = []
    for row in evaluation.get("category_scores") or []:
        name = (row.get("category") or "").strip()
        sc = int(row.get("score", 0))
        mx = int(row.get("max_score", 1))
        ok = _ratio_correct(sc, mx)
        matched: list[str] = []
        for pat, sids in _WRITING_CRITERION_TO_SKILLS:
            if pat.search(name):
                matched = sids
                break
        if not matched:
            continue
        for sid in matched:
            out.append({"skill_id": sid, "correct": ok, "module": "writing"})
    if not out and task:
        out.append(
            {
                "skill_id": "W1.1_task_response_completeness",
                "correct": float(evaluation.get("percentage", 0)) >= 50,
                "module": "writing",
            }
        )
    return out


def speaking_evaluation_to_skill_outcomes(evaluation: dict) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in evaluation.get("category_scores") or []:
        name = (row.get("category") or "").strip()
        sc = int(row.get("score", 0))
        mx = int(row.get("max_score", 1))
        ok = _ratio_correct(sc, mx)
        matched: list[str] = []
        for pat, sids in _SPEAKING_CRITERION_TO_SKILLS:
            if pat.search(name):
                matched = sids
                break
        if not matched:
            continue
        for sid in matched:
            out.append({"skill_id": sid, "correct": ok, "module": "speaking"})
    if not out:
        out.append(
            {
                "skill_id": "S1.1_speech_continuity",
                "correct": float(evaluation.get("percentage", 0)) >= 50,
                "module": "speaking",
            }
        )
    return out


def question_results_to_skill_outcomes(
    items: list[dict],
    module: str,
) -> list[dict[str, Any]]:
    return [
        {
            "skill_id": str(it["skill_id"]),
            "correct": bool(it.get("is_correct")),
            "module": module,
        }
        for it in items
        if it.get("skill_id")
    ]


def session_summary_strengthened_needs(
    skill_outcomes: list[dict[str, Any]],
) -> tuple[list[str], list[str]]:
    """Per micro-skill: all correct in session -> strengthened; any wrong -> needs work."""
    by_skill: dict[str, list[bool]] = defaultdict(list)
    for o in skill_outcomes:
        sid = o.get("skill_id")
        if not sid:
            continue
        by_skill[str(sid)].append(bool(o.get("correct")))

    strengthened: list[str] = []
    needs_work: list[str] = []
    for sid, arr in by_skill.items():
        if not arr:
            continue
        if all(arr):
            strengthened.append(sid)
        if not all(arr):
            needs_work.append(sid)
    return (sorted(strengthened), sorted(set(needs_work)))


def recommend_focus_skill(accuracy_by_skill: dict[str, dict[str, float]], module: str) -> Optional[str]:
    """
    accuracy_by_skill: skill_id -> {accuracy: 0-1, total: n}
    Pick lowest accuracy among module skills with at least one attempt; if none, return default focus.
    """
    from skills_taxonomy import skill_ids_for_module

    allowed = skill_ids_for_module(module)
    if not allowed:
        return None
    best: Optional[str] = None
    best_acc = 2.0
    for sid in allowed:
        row = accuracy_by_skill.get(sid) or {}
        acc = float(row.get("accuracy", 0.0))
        tot = int(row.get("total", 0))
        if tot < 1:
            continue
        if acc < best_acc:
            best_acc = acc
            best = sid
    if best is not None:
        return best
    # Default focus when there is not enough data yet (reading: paraphrase; listening: detail; etc.)
    defaults = {
        "reading": "R2.2_paraphrase_recognition",
        "listening": "L2.1_specific_detail_capture",
        "writing": "W2.2_logical_flow",
        "speaking": "S1.1_speech_continuity",
    }
    d = defaults.get(module)
    return d if d in allowed else allowed[0]


def labels_for_ids(ids: list[str]) -> str:
    return ", ".join(get_skill_label(s) for s in ids) if ids else ""


def week_bounds_utc() -> tuple[str, str, str]:
    """(last7_start, prev7_start, now) as ISO Z."""
    now = datetime.now(timezone.utc)
    last7 = (now - timedelta(days=7)).isoformat()
    prev7 = (now - timedelta(days=14)).isoformat()
    return (last7, prev7, now.isoformat())


def compare_weekly_skills(
    acc_now: dict[str, dict[str, float]],
    acc_prev: dict[str, dict[str, float]],
) -> tuple[list[str], list[str]]:
    """
    Return (improvement_labels, still_weak): skill human labels where accuracy rose by enough,
    and skills still below 0.5 in the recent window.
    """
    improve: list[str] = []
    for sid, row in acc_now.items():
        a = float(row.get("accuracy", 0))
        b = float((acc_prev.get(sid) or {}).get("accuracy", a))
        tot = int(row.get("total", 0))
        if tot >= 2 and a - b >= 0.2:
            improve.append(get_skill_label(sid))
    weak: list[str] = []
    for sid, row in acc_now.items():
        if float(row.get("accuracy", 0)) < 0.5 and int(row.get("total", 0)) >= 2:
            weak.append(get_skill_label(sid))
    return (improve[:5], weak[:5])


def difficulty_string_from_band(band: Optional[float]) -> str:
    if band is None:
        return "band6"
    r = int(round(float(band)))
    r = max(4, min(8, r))
    return f"band{r}"


def format_band_label(difficulty_key: str) -> str:
    """band6 -> Band 6"""
    if difficulty_key.startswith("band") and len(difficulty_key) > 4:
        return f"Band {difficulty_key[4:]}"
    return difficulty_key


def accuracy_to_micro_ielts_band(accuracy: float) -> float:
    """Map item accuracy 0–1 to IELTS-style 1–9 in 0.5 steps (practice estimate, not official)."""
    a = max(0.0, min(1.0, float(accuracy)))
    raw = 1.0 + 8.0 * a
    half = round(raw * 2.0) / 2.0
    return max(1.0, min(9.0, half))


def format_micro_ielts_band_label(accuracy: float) -> str:
    b = accuracy_to_micro_ielts_band(accuracy)
    return f"Band {int(b)}" if b == int(b) else f"Band {b:.1f}"


def skill_mastery_status(accuracy: float, total: int) -> str:
    """UI tier: unknown (no data yet) / strong / medium / weak."""
    if total < 1:
        return "unknown"
    if accuracy >= 0.65:
        return "strong"
    if accuracy >= 0.45:
        return "medium"
    return "weak"


def skill_trend_delta(
    acc_recent: dict[str, dict],
    acc_prev: dict[str, dict],
    skill_id: str,
) -> float:
    """Change in accuracy (e.g. -0.05) between last 7 days and the prior 7 days."""
    rn = acc_recent.get(skill_id) or {}
    rp = acc_prev.get(skill_id) or {}
    tn = int(rn.get("total", 0))
    tp = int(rp.get("total", 0))
    if tn < 1 or tp < 1:
        return 0.0
    return float(rn.get("accuracy", 0.0)) - float(rp.get("accuracy", 0.0))


def module_weighted_score(accuracy_by_skill: dict[str, dict], module: str) -> float:
    """Attempt-weighted mean accuracy for all skills in a module with data."""
    from skills_taxonomy import skill_ids_for_module

    w_sum = 0.0
    t_sum = 0
    for sid in skill_ids_for_module(module):
        r = accuracy_by_skill.get(sid) or {}
        tot = int(r.get("total", 0))
        if tot < 1:
            continue
        a = float(r.get("accuracy", 0.0))
        w_sum += a * tot
        t_sum += tot
    return round(w_sum / t_sum, 4) if t_sum else 0.0
