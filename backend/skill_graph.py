"""Micro-skill prerequisite edges for curriculum ordering (compiler input)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_CONFIG = Path(__file__).resolve().parent / "config" / "skill_dependencies.json"


@lru_cache
def _edges() -> list[tuple[str, str]]:
    with open(_CONFIG, encoding="utf-8") as f:
        data = json.load(f)
    out: list[tuple[str, str]] = []
    for e in data.get("edges") or []:
        if not isinstance(e, dict):
            continue
        a, b = e.get("from"), e.get("to")
        if isinstance(a, str) and isinstance(b, str):
            out.append((a, b))
    return out


def prerequisite_skills(skill_id: str) -> list[str]:
    """Skills that should precede `skill_id` in a strict progression."""
    return [frm for frm, to in _edges() if to == skill_id]


def dependent_skills(skill_id: str) -> list[str]:
    """Skills that list `skill_id` as a prerequisite."""
    return [to for frm, to in _edges() if frm == skill_id]
