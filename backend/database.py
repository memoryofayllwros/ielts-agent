import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None

DB_NAME = "ielts_reading_agent"


async def init_db():
    global _client, _db
    url = os.environ["MONGODB_URL"]
    _client = AsyncIOMotorClient(url)
    _db = _client[DB_NAME]
    await _db.users.create_index("email", unique=True)
    await _db.sessions.create_index([("user_id", 1)])
    await _db.sessions.create_index([("user_id", 1), ("skill", 1)])
    await _db.results.create_index([("user_id", 1), ("completed_at", -1)])
    await _db.results.create_index([("user_id", 1), ("skill", 1)])


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
    await _db_handle().sessions.insert_one(doc)
    return session_id


async def get_session(session_id: str) -> Optional[dict]:
    doc = await _db_handle().sessions.find_one({"_id": session_id})
    return doc["session_data"] if doc else None


async def get_session_record(session_id: str) -> Optional[dict]:
    """Full session document including skill and user_id."""
    return await _db_handle().sessions.find_one({"_id": session_id})


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
