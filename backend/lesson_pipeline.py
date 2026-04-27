"""Orchestrate lesson generation: LLM package → OpenRouter text-to-video (Seedance) → GridFS (multi-clip)."""
from __future__ import annotations

import traceback
from typing import Any, Optional

from bson import ObjectId

from database import (
    get_lesson,
    get_user_by_id,
    gridfs_delete_file,
    gridfs_upload_lesson_mp4,
    update_lesson,
)
from diagnostic import average_diagnostic_band
from lesson_agent import (
    build_dialogue_scene_prompt,
    build_scenario_broll_prompt,
    build_seedance_video_prompt,
    generate_lesson_package,
)
from lesson_video_openrouter import generate_lesson_video_bytes
from skills_taxonomy import get_skill_label


def _as_oid(gid: Any) -> Optional[ObjectId]:
    if gid is None:
        return None
    if isinstance(gid, ObjectId):
        return gid
    try:
        return ObjectId(str(gid))
    except Exception:
        return None


async def run_lesson_pipeline(lesson_id: str, user_id: str) -> None:
    rec = await get_lesson(lesson_id, user_id)
    if not rec:
        return
    st = rec.get("status")
    if st not in ("queued", "processing"):
        return
    await update_lesson(lesson_id, user_id, {"status": "processing", "error": None})
    uploaded_oids: list[ObjectId] = []
    try:
        user = await get_user_by_id(user_id)
        band = average_diagnostic_band(user) if user else None
        module = str(rec.get("module") or "reading")
        skill_id = str(rec.get("skill_id") or "")
        lesson_kind = str(rec.get("lesson_kind") or "skill_explainer")
        curriculum = dict(rec.get("curriculum") or {})
        wv = dict(rec.get("weakness_vector_snapshot") or {})

        pkg = await generate_lesson_package(
            skill_id,
            module=module,
            learner_band=band,
            lesson_kind=lesson_kind,
            curriculum=curriculum,
            weakness_vector=wv,
        )
        title = pkg["title"]
        slides = pkg["slides"]
        narration = pkg["narration"]
        content = pkg["content"]
        evaluation_hook = pkg.get("evaluation_hook") or rec.get("evaluation_hook") or {}

        skill_label = get_skill_label(skill_id)
        topic = str(curriculum.get("topic") or "")
        scenario = str(curriculum.get("scenario") or "")

        clips_out: list[dict[str, Any]] = []
        total_bytes = 0
        total_duration = 0.0

        async def _one_clip(
            prompt: str,
            fname_suffix: str,
            clip_type: str,
        ) -> None:
            nonlocal total_bytes, total_duration
            data, duration, _job = await generate_lesson_video_bytes(prompt)
            fname = f"{user_id}/{lesson_id}_{fname_suffix}.mp4"
            oid = await gridfs_upload_lesson_mp4(
                fname,
                data,
                metadata={
                    "lesson_id": lesson_id,
                    "user_id": user_id,
                    "skill_id": skill_id,
                    "clip_type": clip_type,
                },
            )
            uploaded_oids.append(oid)
            dsec = float(duration) if duration else None
            clips_out.append(
                {
                    "type": clip_type,
                    "gridfs_file_id": str(oid),
                    "duration_sec": dsec,
                    "size_bytes": len(data),
                }
            )
            total_bytes += len(data)
            if dsec:
                total_duration += dsec

        if lesson_kind == "speaking_scenario":
            scene_desc = str((content or {}).get("video_scene_description") or "")
            await _one_clip(
                build_scenario_broll_prompt(
                    title=title,
                    video_scene_description=scene_desc,
                    topic=topic or "general",
                    scenario=scenario or "scene",
                    module=module,
                ),
                "c0",
                "scenario",
            )
            await _one_clip(
                build_seedance_video_prompt(
                    title=title,
                    slides=slides,
                    narration=narration,
                    module=module,
                    skill_label=skill_label,
                ),
                "c1",
                "explanation",
            )
        elif lesson_kind in ("listening_context", "listening_to_speaking"):
            ld = (content or {}).get("listening_dialogue") or []
            await _one_clip(
                build_dialogue_scene_prompt(
                    title=title,
                    listening_dialogue=ld if isinstance(ld, list) else [],
                    topic=topic or "general",
                    scenario=scenario or "scene",
                ),
                "c0",
                "scenario",
            )
            await _one_clip(
                build_seedance_video_prompt(
                    title=title,
                    slides=slides,
                    narration=narration,
                    module=module,
                    skill_label=skill_label,
                ),
                "c1",
                "explanation",
            )
        else:
            video_prompt = build_seedance_video_prompt(
                title=title,
                slides=slides,
                narration=narration,
                module=module,
                skill_label=skill_label,
            )
            await _one_clip(video_prompt, "c0", "legacy")

        primary = clips_out[0]["gridfs_file_id"] if clips_out else None
        primary_oid = _as_oid(primary)

        await update_lesson(
            lesson_id,
            user_id,
            {
                "status": "ready",
                "title": title,
                "slides_json": slides,
                "narration": narration,
                "content": content,
                "evaluation_hook": evaluation_hook,
                "gridfs_file_id": primary_oid,
                "clips": clips_out,
                "size_bytes": total_bytes,
                "duration_sec": round(total_duration, 2) if total_duration else None,
                "error": None,
            },
        )
    except Exception as e:  # noqa: BLE001
        for oid in reversed(uploaded_oids):
            try:
                await gridfs_delete_file(oid)
            except Exception:
                pass
        msg = str(e) or type(e).__name__
        tb = traceback.format_exc()[-4000:]
        await update_lesson(
            lesson_id,
            user_id,
            {"status": "failed", "error": f"{msg}\n---\n{tb}"},
        )


def lesson_doc_to_api_row(doc: dict[str, Any]) -> dict[str, Any]:
    """Shape for list/detail JSON (ObjectId → str)."""
    st = doc.get("status")
    lesson_id = str(doc.get("_id"))
    clips_raw = doc.get("clips") or []
    clip_rows: list[dict[str, Any]] = []
    if isinstance(clips_raw, list) and clips_raw:
        for i, c in enumerate(clips_raw):
            if not isinstance(c, dict):
                continue
            gid = c.get("gridfs_file_id")
            if st == "ready" and gid and doc.get("storage_backend") == "gridfs":
                clip_rows.append(
                    {
                        "index": i,
                        "type": str(c.get("type") or "clip"),
                        "url": f"/api/lessons/{lesson_id}/clips/{i}/video",
                        "duration_sec": c.get("duration_sec"),
                        "size_bytes": c.get("size_bytes"),
                    }
                )
    playback: Optional[str] = None
    if clip_rows:
        playback = clip_rows[0]["url"]
    elif st == "ready" and doc.get("storage_backend") == "gridfs" and doc.get("gridfs_file_id"):
        playback = f"/api/lessons/{lesson_id}/video"
    elif st == "ready" and doc.get("video_url"):
        playback = str(doc["video_url"])
    gid = doc.get("gridfs_file_id")
    return {
        "id": lesson_id,
        "user_id": doc.get("user_id"),
        "module": doc.get("module"),
        "skill_id": doc.get("skill_id"),
        "title": doc.get("title"),
        "status": st,
        "playback_url": playback,
        "clip_playback": clip_rows,
        "storage_backend": doc.get("storage_backend"),
        "gridfs_file_id": str(gid) if gid else None,
        "duration_sec": doc.get("duration_sec"),
        "size_bytes": doc.get("size_bytes"),
        "error": (str(doc.get("error") or "")[:500] if st == "failed" else None),
        "why_this_lesson": doc.get("why_this_lesson"),
        "lesson_kind": doc.get("lesson_kind") or "skill_explainer",
        "curriculum": doc.get("curriculum") or {},
        "evaluation_hook": doc.get("evaluation_hook"),
        "weakness_vector_snapshot": doc.get("weakness_vector_snapshot"),
        "graph_prerequisite_lesson_ids": list(doc.get("graph_prerequisite_lesson_ids") or []),
        "graph_next_lesson_ids": list(doc.get("graph_next_lesson_ids") or []),
        "comprehension_submitted": bool(doc.get("comprehension_submitted")),
        "roleplay_submitted": bool(doc.get("roleplay_submitted")),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }
