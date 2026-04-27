"""Load fixed micro-skill taxonomy and validate skill_id values (MVP, single skills.json)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Optional

_CONFIG_PATH = Path(__file__).resolve().parent / "config" / "skills.json"


@lru_cache
def _raw() -> dict[str, Any]:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def all_skill_ids() -> frozenset[str]:
    out: set[str] = set()
    modules = _raw().get("modules") or {}
    for mod in modules.values():
        for cl in (mod.get("clusters") or {}).values():
            for sk in cl.get("skills") or []:
                sid = sk.get("id")
                if isinstance(sid, str):
                    out.add(sid)
    return frozenset(out)


def skill_ids_for_module(module: str) -> list[str]:
    modules = _raw().get("modules") or {}
    m = modules.get(module)
    if not m:
        return []
    ids: list[str] = []
    for cl in (m.get("clusters") or {}).values():
        for sk in cl.get("skills") or []:
            if sk.get("id"):
                ids.append(str(sk["id"]))
    return ids


def allowlist_prompt_lines(module: str) -> str:
    """Human-readable list for LLM prompts (constrained choice)."""
    lines = []
    modules = _raw().get("modules") or {}
    m = modules.get(module)
    if not m:
        return ""
    for _cid, cl in (m.get("clusters") or {}).items():
        for sk in cl.get("skills") or []:
            sid = sk.get("id")
            if not sid:
                continue
            label = sk.get("label", "")
            desc = (sk.get("description") or "")[:200]
            lines.append(f'  - "{sid}" — {label}. {desc}')
    return "\n".join(lines)


def get_skill_label(skill_id: str) -> str:
    for sid, meta in _skill_index().items():
        if sid == skill_id:
            return str(meta.get("label", skill_id))
    return skill_id


def get_skill_meta(skill_id: str) -> dict[str, str]:
    m = _skill_index().get(skill_id)
    if m:
        return {
            "label": str(m.get("label", skill_id)),
            "description": str(m.get("description", "")),
        }
    return {"label": get_skill_label(skill_id), "description": ""}


def focus_practice_bullets_for_skill(skill_id: str) -> List[str]:
    desc = get_skill_meta(skill_id)["description"].strip()
    if not desc:
        return []
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", desc) if p.strip()]
    if len(parts) > 1:
        return parts[:3]
    if ";" in desc:
        return [b.strip() for b in desc.split(";") if b.strip()][:3]
    return [desc]


def get_module_for_skill_id(skill_id: str) -> Optional[str]:
    for mod, sids in _module_to_skills().items():
        if skill_id in sids:
            return mod
    if skill_id and skill_id[0] in "RWL" and len(skill_id) > 1 and skill_id[1] in "0.123456789":
        c = skill_id[0]
        if c == "R":
            return "reading"
        if c == "L":
            return "listening"
        if c == "W":
            return "writing"
    if skill_id and skill_id[0] == "S":
        return "speaking"
    return None


@lru_cache
def _skill_index() -> dict[str, dict[str, str]]:
    idx: dict[str, dict[str, str]] = {}
    modules = _raw().get("modules") or {}
    for mkey, m in modules.items():
        for cl in (m.get("clusters") or {}).values():
            for sk in cl.get("skills") or []:
                sid = sk.get("id")
                if isinstance(sid, str):
                    idx[sid] = {
                        "label": str(sk.get("label", "")),
                        "description": str(sk.get("description", "")),
                        "module": mkey,
                    }
    return idx


@lru_cache
def get_cluster_id_for_skill(skill_id: str) -> Optional[str]:
    """Taxonomy cluster key (e.g. R1, L2) for a micro-skill, if defined."""
    modules = _raw().get("modules") or {}
    for m in modules.values():
        for cid, cl in (m.get("clusters") or {}).items():
            for sk in cl.get("skills") or []:
                if sk.get("id") == skill_id:
                    return str(cid)
    return None


@lru_cache
def skill_ids_in_same_cluster(skill_id: str) -> frozenset[str]:
    """All micro-skill ids in the same cluster as skill_id (including self)."""
    modules = _raw().get("modules") or {}
    for m in modules.values():
        for cl in (m.get("clusters") or {}).values():
            ids = [str(sk["id"]) for sk in cl.get("skills") or [] if sk.get("id")]
            if skill_id in ids:
                return frozenset(ids)
    return frozenset({skill_id}) if skill_id else frozenset()


@lru_cache
def _module_to_skills() -> dict[str, frozenset[str]]:
    out: dict[str, set[str]] = {}
    modules = _raw().get("modules") or {}
    for mkey, m in modules.items():
        s: set[str] = set()
        for cl in (m.get("clusters") or {}).values():
            for sk in cl.get("skills") or []:
                if sk.get("id"):
                    s.add(str(sk["id"]))
        out[mkey] = s
    return {k: frozenset(v) for k, v in out.items()}


def is_valid_skill_id(skill_id: Optional[str], module: str) -> bool:
    if not skill_id or not isinstance(skill_id, str):
        return False
    allowed = _module_to_skills().get(module, frozenset())
    return skill_id in allowed


def validate_or_default(skill_id: Optional[str], module: str) -> str:
    if is_valid_skill_id(skill_id, module):
        return str(skill_id).strip()
    # deterministic fallback: first ID in module (documented behavior for bad LLM output)
    ids = skill_ids_for_module(module)
    return ids[0] if ids else "R1.1_skimming_main_idea"
