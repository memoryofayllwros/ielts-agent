"""Embedded lesson sequence links (prerequisite / next) for learning paths."""
from __future__ import annotations

from typing import Any, Optional

from database import _db_handle, get_lesson, update_lesson


async def link_new_lesson_after_previous(
    user_id: str,
    module: str,
    skill_id: str,
    new_lesson_id: str,
) -> None:
    """Find latest ready lesson for same module+skill; set mutual next/prerequisite ids."""
    prev = await _db_handle().lesson_videos.find_one(
        {
            "user_id": user_id,
            "module": module,
            "skill_id": skill_id,
            "status": "ready",
            "_id": {"$ne": new_lesson_id},
        },
        sort=[("created_at", -1)],
    )
    prev_id: Optional[str] = str(prev["_id"]) if prev else None
    if not prev_id:
        await update_lesson(
            new_lesson_id,
            user_id,
            {
                "graph_prerequisite_lesson_ids": [],
                "graph_next_lesson_ids": [],
            },
        )
        return
    prev = await get_lesson(prev_id, user_id)
    prev_next = list(prev.get("graph_next_lesson_ids") or []) if prev else []
    if new_lesson_id not in prev_next:
        prev_next.append(new_lesson_id)
    await update_lesson(prev_id, user_id, {"graph_next_lesson_ids": prev_next})
    new_pre = [prev_id]
    await update_lesson(
        new_lesson_id,
        user_id,
        {
            "graph_prerequisite_lesson_ids": new_pre,
            "graph_next_lesson_ids": [],
        },
    )


def graph_fields_from_doc(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "graph_prerequisite_lesson_ids": list(doc.get("graph_prerequisite_lesson_ids") or []),
        "graph_next_lesson_ids": list(doc.get("graph_next_lesson_ids") or []),
    }
