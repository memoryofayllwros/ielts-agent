"""Topic × scenario pool for lesson curriculum (IELTS-style themes)."""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional, Tuple

_CONFIG = Path(__file__).resolve().parent / "config" / "lesson_topics.json"


@lru_cache
def _raw() -> dict[str, Any]:
    with open(_CONFIG, encoding="utf-8") as f:
        return json.load(f)


def list_topics() -> list[dict[str, Any]]:
    return list(_raw().get("topics") or [])


def pick_topic_scenario(skill_id: str, module: str, seed: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Deterministic topic/scenario from skill_id (+ optional seed for variety).
    Returns (topic_id, scenario_id, topic_label).
    """
    topics = list_topics()
    if not topics:
        return ("general", "everyday_conversation", "General")
    h = hashlib.sha256(f"{module}:{skill_id}:{seed or ''}".encode()).hexdigest()
    idx = int(h[:8], 16) % len(topics)
    t = topics[idx]
    topic_id = str(t.get("id") or "general")
    label = str(t.get("label") or topic_id)
    scenarios = t.get("scenarios") or ["default"]
    if not isinstance(scenarios, list) or not scenarios:
        scenarios = ["default"]
    sidx = int(h[8:16], 16) % len(scenarios)
    scenario_id = str(scenarios[sidx])
    return (topic_id, scenario_id, label)
