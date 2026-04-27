import os
import re
import uuid
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None

DB_NAME = "ielts_reading_agent"


async def init_db():
    """Initialise the Motor client and ensure indexes exist.

    Idempotent: safe to call multiple times (e.g. on Vercel warm starts).
    """
    global _client, _db
    if _db is not None:
        return  # Already initialised on a previous warm invocation
    url = os.environ["MONGODB_URL"]
    _client = AsyncIOMotorClient(url)
    _db = _client[DB_NAME]
    await _db.users.create_index("email", unique=True)
    await _db.sessions.create_index([("user_id", 1)])
    await _db.sessions.create_index([("user_id", 1), ("skill", 1)])
    await _db.results.create_index([("user_id", 1), ("completed_at", -1)])
    await _db.results.create_index([("user_id", 1), ("skill", 1)])
    await _db.vocab_sessions.create_index([("user_id", 1)])
    await _db.vocab_results.create_index([("user_id", 1), ("completed_at", -1)])
    await _db.practice_templates.create_index(
        [("skill", 1), ("difficulty", 1), ("active", 1), ("writing_task_type", 1)]
    )
    await _db.sessions.create_index([("user_id", 1), ("skill", 1), ("source_template_id", 1)])
    await _db.lesson_videos.create_index([("user_id", 1), ("module", 1)])
    await _db.lesson_videos.create_index([("user_id", 1), ("skill_id", 1)])
    await _db.lesson_videos.create_index([("status", 1)])
    await _db.lesson_videos.create_index([("user_id", 1), ("created_at", -1)])
    await _db.lesson_videos.create_index([("lesson_kind", 1)])
    await _db.user_weakness_vectors.create_index("user_id", unique=True)


LESSON_GRIDFS_BUCKET = "lesson_mp4"


def lesson_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(_db_handle(), bucket_name=LESSON_GRIDFS_BUCKET)


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None


def _db_handle() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialised — call init_db() first")
    return _db


# ── Users ─────────────────────────────────────────────────────────────────────

async def create_user(email: str, hashed_password: str) -> dict:
    user_id = str(uuid.uuid4())
    email = email.strip().lower()
    doc = {
        "_id": user_id,
        "email": email,
        "username": email,
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db_handle().users.insert_one(doc)
    return {"id": user_id, "email": email, "username": email}


async def get_user_by_email(email: str) -> Optional[dict]:
    db = _db_handle()
    normalized = email.strip().lower()
    doc = await db.users.find_one({"email": normalized})
    if doc:
        return doc
    # Accounts created before email normalization may store mixed-case addresses.
    pattern = re.escape(email.strip())
    return await db.users.find_one({"email": {"$regex": f"^{pattern}$", "$options": "i"}})


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await _db_handle().users.find_one({"_id": user_id})


PROFILE_KEYS = frozenset(
    {
        "display_name",
        "target_band",
        "target_reading",
        "target_listening",
        "target_writing",
        "target_speaking",
        "past_exam_band",
        "past_reading",
        "past_listening",
        "past_writing",
        "past_speaking",
        "past_exam_notes",
    }
)


async def set_user_profile_fields(user_id: str, data: dict[str, Any]) -> None:
    """Merge allowed keys into user.profile. Use None in data to clear optional fields (stored as null)."""
    now = datetime.now(timezone.utc).isoformat()
    set_doc: dict[str, Any] = {"profile.updated_at": now}
    for k, v in data.items():
        if k not in PROFILE_KEYS:
            continue
        set_doc[f"profile.{k}"] = v
    await _db_handle().users.update_one({"_id": user_id}, {"$set": set_doc})


# ── Diagnostic baseline ───────────────────────────────────────────────────────

DIAGNOSTIC_SKILLS = frozenset({"reading", "listening", "writing", "speaking"})


async def record_diagnostic_skill_outcome(user_id: str, skill: str, estimated_band: float) -> dict:
    """Store one skill's estimated band; set diagnostic_completed_at when all four are present."""
    if skill not in DIAGNOSTIC_SKILLS:
        raise ValueError("invalid diagnostic skill")
    db = _db_handle()
    band = round(float(estimated_band), 1)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {f"diagnostic_bands.{skill}": band}},
    )
    user = await get_user_by_id(user_id)
    bands = dict(user.get("diagnostic_bands") or {})
    completed = DIAGNOSTIC_SKILLS <= bands.keys()
    now = datetime.now(timezone.utc).isoformat()
    if completed and not user.get("diagnostic_completed_at"):
        await db.users.update_one(
            {"_id": user_id},
            {"$set": {"diagnostic_completed_at": now}},
        )
    return {"bands": bands, "completed": completed}


async def diagnostic_status(user_id: str) -> dict:
    user = await get_user_by_id(user_id)
    if not user:
        return {
            "completed": False,
            "bands": {},
            "completed_at": None,
            "remaining_skills": list(DIAGNOSTIC_SKILLS),
        }
    bands = dict(user.get("diagnostic_bands") or {})
    remaining = sorted(DIAGNOSTIC_SKILLS - set(bands.keys()))
    completed_at = user.get("diagnostic_completed_at")
    completed = bool(completed_at) or (DIAGNOSTIC_SKILLS <= bands.keys())
    return {
        "completed": completed,
        "bands": bands,
        "completed_at": completed_at,
        "remaining_skills": remaining,
    }


# ── Sessions ──────────────────────────────────────────────────────────────────

async def save_session(
    session_data: dict,
    user_id: str,
    skill: str = "reading",
    is_diagnostic: bool = False,
    source_template_id: Optional[str] = None,
) -> str:
    session_id = str(uuid.uuid4())
    doc = {
        "_id": session_id,
        "user_id": user_id,
        "skill": skill,
        "topic": session_data["topic"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_data": session_data,
        "is_diagnostic": bool(is_diagnostic),
    }
    if source_template_id:
        doc["source_template_id"] = source_template_id
    await _db_handle().sessions.insert_one(doc)
    return session_id


async def get_session(session_id: str) -> Optional[dict]:
    doc = await _db_handle().sessions.find_one({"_id": session_id})
    return doc["session_data"] if doc else None


async def get_session_record(session_id: str) -> Optional[dict]:
    """Full session document including skill and user_id."""
    return await _db_handle().sessions.find_one({"_id": session_id})


async def list_used_template_ids(user_id: str, skill: str) -> set[str]:
    """Practice sessions instantiated from the template pool (dedup per user)."""
    db = _db_handle()
    cursor = db.sessions.find(
        {
            "user_id": user_id,
            "skill": skill,
            "is_diagnostic": {"$ne": True},
            "source_template_id": {"$exists": True, "$ne": None},
        },
        {"source_template_id": 1},
    )
    out: set[str] = set()
    async for doc in cursor:
        tid = doc.get("source_template_id")
        if tid:
            out.add(str(tid))
    return out


async def fetch_practice_templates(
    skill: str,
    difficulty: str,
    *,
    writing_task_type: Optional[str] = None,
) -> list[dict]:
    q: dict = {"skill": skill, "difficulty": difficulty, "active": True}
    if skill == "writing" and writing_task_type:
        q["writing_task_type"] = writing_task_type
    cursor = _db_handle().practice_templates.find(q)
    return [doc async for doc in cursor]


async def recent_skill_exposure_counts(user_id: str, since_iso: str) -> dict[str, int]:
    """Count skill_outcomes rows per skill_id since since_iso (practice results only)."""
    match: dict = {
        "user_id": user_id,
        "is_diagnostic": {"$ne": True},
        "completed_at": {"$gte": since_iso},
    }
    pipeline = [
        {"$match": match},
        {"$project": {"outcomes": {"$ifNull": ["$result_data.skill_outcomes", []]}}},
        {"$unwind": {"path": "$outcomes", "preserveNullAndEmptyArrays": False}},
        {"$group": {"_id": "$outcomes.skill_id", "n": {"$sum": 1}}},
    ]
    out: dict[str, int] = {}
    async for doc in _db_handle().results.aggregate(pipeline):
        sid = doc.get("_id")
        if sid:
            out[str(sid)] = int(doc.get("n", 0))
    return out


def exposure_window_start_iso(days: int) -> str:
    d = max(1, int(days))
    return (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()


async def upsert_practice_template(doc: dict) -> None:
    """Insert or replace one practice_templates row by _id."""
    if not doc.get("_id"):
        raise ValueError("practice template document must include _id")
    await _db_handle().practice_templates.replace_one(
        {"_id": doc["_id"]},
        doc,
        upsert=True,
    )


# ── Results ───────────────────────────────────────────────────────────────────

async def save_result(
    session_id: str,
    user_id: str,
    topic: str,
    percentage: float,
    total_score: float,
    max_score: float,
    result_data: dict,
    skill: str = "reading",
    is_diagnostic: bool = False,
) -> str:
    result_id = str(uuid.uuid4())
    doc = {
        "_id": result_id,
        "session_id": session_id,
        "user_id": user_id,
        "skill": skill,
        "topic": topic,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "percentage": percentage,
        "total_score": total_score,
        "max_score": max_score,
        "result_data": result_data,
        "is_diagnostic": bool(is_diagnostic),
    }
    await _db_handle().results.insert_one(doc)
    return result_id


async def get_progress(user_id: str, limit: int = 50, skill: Optional[str] = None) -> list[dict]:
    query: dict = {
        "user_id": user_id,
        "is_diagnostic": {"$ne": True},
    }
    if skill:
        if skill == "reading":
            query["$or"] = [{"skill": "reading"}, {"skill": {"$exists": False}}]
        else:
            query["skill"] = skill
    cursor = _db_handle().results.find(
        query,
        {"_id": 1, "session_id": 1, "topic": 1, "completed_at": 1,
         "percentage": 1, "total_score": 1, "max_score": 1, "skill": 1},
    ).sort("completed_at", -1).limit(limit)

    return [
        {
            "id": doc["_id"],
            "session_id": doc["session_id"],
            "topic": doc["topic"],
            "completed_at": doc["completed_at"],
            "percentage": doc["percentage"],
            "total_score": doc["total_score"],
            "max_score": doc["max_score"],
            "skill": doc.get("skill") or "reading",
        }
        async for doc in cursor
    ]


async def aggregate_skill_accuracy_for_user(
    user_id: str,
    since_iso: Optional[str] = None,
    until_iso: Optional[str] = None,
) -> dict[str, dict[str, Any]]:
    """
    Roll up skill_outcomes across results: skill_id -> {accuracy, total, correct}.
    """
    match: dict = {"user_id": user_id, "is_diagnostic": {"$ne": True}}
    time_q: dict = {}
    if since_iso:
        time_q["$gte"] = since_iso
    if until_iso:
        time_q["$lt"] = until_iso
    if time_q:
        match["completed_at"] = time_q

    pipeline = [
        {"$match": match},
        {
            "$project": {
                "outcomes": {"$ifNull": ["$result_data.skill_outcomes", []]},
            }
        },
        {"$unwind": {"path": "$outcomes", "preserveNullAndEmptyArrays": False}},
        {
            "$group": {
                "_id": "$outcomes.skill_id",
                "correct": {"$sum": {"$cond": ["$outcomes.correct", 1, 0]}},
                "total": {"$sum": 1},
            }
        },
    ]
    out: dict[str, dict[str, Any]] = {}
    async for doc in _db_handle().results.aggregate(pipeline):
        sid = doc.get("_id")
        if not sid:
            continue
        tot = int(doc.get("total", 0))
        c = int(doc.get("correct", 0))
        out[str(sid)] = {
            "accuracy": round(c / tot, 4) if tot else 0.0,
            "total": tot,
            "correct": c,
        }
    return out


async def get_result_detail(result_id: str, user_id: str) -> Optional[dict]:
    result = await _db_handle().results.find_one({"_id": result_id, "user_id": user_id})
    if not result:
        return None
    skill = result.get("skill") or "reading"
    rd = result.get("result_data") or {}
    session = await _db_handle().sessions.find_one({"_id": result["session_id"]})
    sd = session["session_data"] if session else {}

    passage = sd.get("passage")
    transcript = sd.get("transcript")
    if skill == "listening" and transcript and not passage:
        passage = transcript

    out = {
        "id": result["_id"],
        "skill": skill,
        "topic": result["topic"],
        "completed_at": result["completed_at"],
        "percentage": result["percentage"],
        "total_score": result["total_score"],
        "max_score": result["max_score"],
        "passage": passage,
        "transcript": transcript if skill == "listening" else None,
        "question_results": rd.get("question_results") or [],
        "user_response": rd.get("user_response"),
        "evaluation": rd.get("evaluation"),
        "speaking_task": rd.get("speaking_task"),
        "writing_task_summary": rd.get("writing_task_summary"),
    }
    return out


# ── Vocabulary sessions & results ─────────────────────────────────────────────

async def save_vocab_session(session_data: dict, user_id: str) -> str:
    session_id = str(uuid.uuid4())
    doc = {
        "_id": session_id,
        "user_id": user_id,
        "topic": session_data.get("topic", "General Vocabulary"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_data": session_data,
    }
    await _db_handle().vocab_sessions.insert_one(doc)
    return session_id


async def get_vocab_session(session_id: str) -> Optional[dict]:
    doc = await _db_handle().vocab_sessions.find_one({"_id": session_id})
    return doc["session_data"] if doc else None


async def save_vocab_result(
    session_id: str,
    user_id: str,
    topic: str,
    evaluation: dict,
) -> str:
    result_id = str(uuid.uuid4())
    doc = {
        "_id": result_id,
        "session_id": session_id,
        "user_id": user_id,
        "topic": topic,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "estimated_level": evaluation["estimated_level"],
        "estimated_vocab_size": evaluation["estimated_vocab_size"],
        "percentage": evaluation["percentage"],
        "evaluation": evaluation,
    }
    await _db_handle().vocab_results.insert_one(doc)
    return result_id


async def get_vocab_history(user_id: str, limit: int = 20) -> list[dict]:
    cursor = _db_handle().vocab_results.find(
        {"user_id": user_id},
        {"_id": 1, "topic": 1, "completed_at": 1,
         "estimated_level": 1, "estimated_vocab_size": 1, "percentage": 1},
    ).sort("completed_at", -1).limit(limit)
    return [
        {
            "result_id": doc["_id"],
            "topic": doc["topic"],
            "completed_at": doc["completed_at"],
            "estimated_level": doc["estimated_level"],
            "estimated_vocab_size": doc["estimated_vocab_size"],
            "percentage": doc["percentage"],
        }
        async for doc in cursor
    ]


async def get_vocab_result(result_id: str, user_id: str) -> Optional[dict]:
    doc = await _db_handle().vocab_results.find_one(
        {"_id": result_id, "user_id": user_id}
    )
    if not doc:
        return None
    ev = doc.get("evaluation", {})
    return {
        "result_id": doc["_id"],
        "session_id": doc["session_id"],
        "topic": doc["topic"],
        "completed_at": doc["completed_at"],
        "estimated_level": doc["estimated_level"],
        "estimated_vocab_size": doc["estimated_vocab_size"],
        "percentage": doc["percentage"],
        **{k: ev.get(k) for k in (
            "total_correct", "total_questions",
            "level_breakdown", "item_results",
        )},
    }


# ── Lesson videos (metadata + GridFS binary) ─────────────────────────────────

async def insert_lesson_job(
    user_id: str,
    module: str,
    skill_id: str,
    *,
    title: str = "",
    why_this_lesson: Optional[dict[str, Any]] = None,
    lesson_kind: str = "skill_explainer",
    curriculum: Optional[dict[str, Any]] = None,
    content: Optional[dict[str, Any]] = None,
    evaluation_hook: Optional[dict[str, Any]] = None,
    weakness_vector_snapshot: Optional[dict[str, Any]] = None,
    clips: Optional[list[dict[str, Any]]] = None,
) -> str:
    lesson_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc: dict[str, Any] = {
        "_id": lesson_id,
        "user_id": user_id,
        "module": module,
        "skill_id": skill_id,
        "title": title or skill_id,
        "status": "queued",
        "storage_backend": "gridfs",
        "gridfs_file_id": None,
        "video_url": None,
        "slides_json": None,
        "narration": None,
        "duration_sec": None,
        "size_bytes": None,
        "error": None,
        "why_this_lesson": why_this_lesson,
        "lesson_kind": lesson_kind or "skill_explainer",
        "curriculum": curriculum or {},
        "content": content or {},
        "evaluation_hook": evaluation_hook or {"type": "none", "target_micro_skill": ""},
        "weakness_vector_snapshot": weakness_vector_snapshot or {},
        "clips": clips or [],
        "graph_prerequisite_lesson_ids": [],
        "graph_next_lesson_ids": [],
        "comprehension_submitted": False,
        "comprehension_answers": {},
        "roleplay_submitted": False,
        "roleplay_evaluation": None,
        "created_at": now,
        "updated_at": now,
    }
    await _db_handle().lesson_videos.insert_one(doc)
    return lesson_id


async def count_recent_lesson_jobs_for_user(user_id: str, *, since_iso: str) -> int:
    return int(
        await _db_handle().lesson_videos.count_documents(
            {"user_id": user_id, "created_at": {"$gte": since_iso}},
        )
    )


async def upsert_user_weakness_vector(user_id: str, vector: dict[str, Any]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await _db_handle().user_weakness_vectors.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "vector": vector, "updated_at": now}},
        upsert=True,
    )


async def get_user_weakness_vector(user_id: str) -> Optional[dict[str, Any]]:
    doc = await _db_handle().user_weakness_vectors.find_one({"user_id": user_id})
    if not doc:
        return None
    return dict(doc.get("vector") or {})


async def get_lesson(lesson_id: str, user_id: str) -> Optional[dict]:
    doc = await _db_handle().lesson_videos.find_one({"_id": lesson_id, "user_id": user_id})
    return doc


async def list_lessons_for_user(
    user_id: str,
    *,
    module: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    q: dict[str, Any] = {"user_id": user_id}
    if module:
        q["module"] = module
    cursor = (
        _db_handle()
        .lesson_videos.find(q)
        .sort("created_at", -1)
        .limit(max(1, min(limit, 100)))
    )
    return [doc async for doc in cursor]


async def update_lesson(lesson_id: str, user_id: str, patch: dict[str, Any]) -> bool:
    patch = {**patch, "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await _db_handle().lesson_videos.update_one(
        {"_id": lesson_id, "user_id": user_id},
        {"$set": patch},
    )
    return res.matched_count > 0


async def gridfs_upload_lesson_mp4(
    filename: str,
    data: bytes,
    *,
    metadata: Optional[dict[str, Any]] = None,
) -> ObjectId:
    bucket = lesson_gridfs_bucket()
    meta: dict[str, Any] = {"contentType": "video/mp4", **(metadata or {})}
    return await bucket.upload_from_stream(filename, BytesIO(data), metadata=meta)


async def gridfs_delete_file(file_id: ObjectId) -> None:
    bucket = lesson_gridfs_bucket()
    try:
        await bucket.delete(file_id)
    except Exception:
        pass


async def gridfs_read_mp4_bytes(file_id: ObjectId) -> bytes:
    bucket = lesson_gridfs_bucket()
    buf = BytesIO()
    await bucket.download_to_stream(file_id, buf)
    return buf.getvalue()
