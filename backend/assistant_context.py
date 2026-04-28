"""Build a compact, personalized context string for the in-app IELTS coach."""
from __future__ import annotations

from collections import defaultdict

from database import (
    aggregate_skill_accuracy_for_user,
    diagnostic_status,
    get_progress,
    get_user_by_id,
    get_user_weakness_vector,
)
from diagnostic import average_diagnostic_band
from skills_taxonomy import get_skill_label


def _profile_float(profile: dict, key: str) -> float | None:
    v = profile.get(key)
    if v is None:
        return None
    return float(v)


async def build_assistant_learner_context(user_id: str) -> str:
    user = await get_user_by_id(user_id)
    if not user:
        return ""

    p = user.get("profile") or {}
    lines: list[str] = []

    name = (p.get("display_name") or "").strip() or (user.get("username") or "").strip() or "Learner"
    lines.append(f"Display name: {name}")

    goal_parts: list[str] = []
    tb = _profile_float(p, "target_band")
    if tb is not None:
        goal_parts.append(f"overall target band {tb}")
    pairs = [
        ("Reading", "target_reading"),
        ("Listening", "target_listening"),
        ("Writing", "target_writing"),
        ("Speaking", "target_speaking"),
    ]
    for label, key in pairs:
        v = _profile_float(p, key)
        if v is not None:
            goal_parts.append(f"{label} target {v}")
    if goal_parts:
        lines.append("Stated goals: " + "; ".join(goal_parts))
    else:
        lines.append("Stated goals: none saved in profile yet")

    past_parts: list[str] = []
    pb = _profile_float(p, "past_exam_band")
    if pb is not None:
        past_parts.append(f"overall ~{pb}")
    for label, key in pairs:
        v = _profile_float(p, key.replace("target_", "past_"))
        if v is not None:
            past_parts.append(f"{label} ~{v}")
    if past_parts:
        lines.append("Self-reported past exam bands (if any): " + "; ".join(past_parts))
    else:
        lines.append("Self-reported past exam bands: none saved")

    avg_diag = average_diagnostic_band(user)
    dst = await diagnostic_status(user_id)
    bands = dict(dst.get("bands") or {})
    if dst.get("completed") and bands:
        parts = [f"{sk}≈{bands[sk]}" for sk in sorted(bands.keys())]
        extra = f" (mean of four ≈ {avg_diag})" if avg_diag is not None else ""
        lines.append("In-app baseline diagnostic (approximate): " + ", ".join(parts) + extra)
    else:
        rem = list(dst.get("remaining_skills") or [])
        have = ", ".join(sorted(bands.keys())) if bands else "none yet"
        lines.append(
            f"Baseline diagnostic: not finished. Completed sections: {have}. "
            f"Still to do: {', '.join(rem) if rem else 'unknown'}"
        )

    acc = await aggregate_skill_accuracy_for_user(user_id)
    ranked: list[tuple[float, int, str]] = []
    for sid, row in acc.items():
        tot = int(row.get("total", 0))
        if tot < 1:
            continue
        ranked.append((float(row.get("accuracy", 0.0)), tot, sid))
    ranked.sort(key=lambda x: (x[0], -x[1]))

    weak_lines: list[str] = []
    for accuracy, tot, sid in ranked[:10]:
        label = get_skill_label(sid)
        pct = int(round(accuracy * 100))
        weak_lines.append(f"{label} ({pct}% over {tot} tagged outcomes)")
    if weak_lines:
        lines.append(
            "Weakest tracked micro-skills from recent practice (lowest accuracy first): "
            + "; ".join(weak_lines)
        )
    else:
        lines.append(
            "Practice micro-skill stats: no tagged outcomes yet — coach should suggest completing "
            "practice sessions in the app to unlock tailored weakness data."
        )

    wv = await get_user_weakness_vector(user_id)
    if wv:
        items = sorted(wv.items(), key=lambda kv: -float(kv[1]))[:6]
        lines.append(
            "App weakness emphasis scores (0–1, higher = needs more work): "
            + ", ".join(f"{k}={round(float(v), 2)}" for k, v in items)
        )

    notes = (p.get("past_exam_notes") or "").strip()
    if notes:
        lines.append(f"Learner notes (goals/constraints/context): {notes[:600]}")

    # Short recent-activity hint (median % per skill from last few attempts)
    recent = await get_progress(user_id, limit=16)
    if recent:
        by_skill: dict[str, list[float]] = defaultdict(list)
        for r in recent:
            sk = r.get("skill") or "reading"
            try:
                by_skill[str(sk)].append(float(r.get("percentage", 0)))
            except (TypeError, ValueError):
                continue
        bits = []
        for sk in sorted(by_skill.keys()):
            vals = by_skill[sk]
            if not vals:
                continue
            med = sorted(vals)[len(vals) // 2]
            bits.append(f"{sk} median session score ~{med:.0f}% (last {len(vals)} sessions in sample)")
        if bits:
            lines.append("Recent practice snapshot: " + "; ".join(bits))

    header = (
        "LEARNER_SNAPSHOT (authoritative app data — you MUST use this to personalize answers. "
        "Do not give generic brochure-style tips when you can tie advice to their goals, "
        "diagnostic gaps, or weak skills below. If something is unknown, say so and suggest "
        "what to complete in the app.)"
    )
    return header + "\n" + "\n".join(f"- {ln}" for ln in lines)
