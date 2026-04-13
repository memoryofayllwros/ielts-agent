import os
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
    await _db.results.create_index([("user_id", 1), ("completed_at", -1)])


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

async def create_user(email: str, username: str, hashed_password: str) -> dict:
    user_id = str(uuid.uuid4())
    doc = {
        "_id": user_id,
        "email": email,
        "username": username,
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db_handle().users.insert_one(doc)
    return {"id": user_id, "email": email, "username": username}


async def get_user_by_email(email: str) -> Optional[dict]:
    return await _db_handle().users.find_one({"email": email})


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await _db_handle().users.find_one({"_id": user_id})


# ── Sessions ──────────────────────────────────────────────────────────────────

async def save_session(session_data: dict, user_id: str) -> str:
    session_id = str(uuid.uuid4())
    doc = {
        "_id": session_id,
        "user_id": user_id,
        "topic": session_data["topic"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_data": session_data,
    }
    await _db_handle().sessions.insert_one(doc)
    return session_id


async def get_session(session_id: str) -> Optional[dict]:
    doc = await _db_handle().sessions.find_one({"_id": session_id})
    return doc["session_data"] if doc else None


# ── Results ───────────────────────────────────────────────────────────────────

async def save_result(
    session_id: str,
    user_id: str,
    topic: str,
    percentage: float,
    total_score: float,
    max_score: float,
    result_data: dict,
) -> str:
    result_id = str(uuid.uuid4())
    doc = {
        "_id": result_id,
        "session_id": session_id,
        "user_id": user_id,
        "topic": topic,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "percentage": percentage,
        "total_score": total_score,
        "max_score": max_score,
        "result_data": result_data,
    }
    await _db_handle().results.insert_one(doc)
    return result_id


async def get_progress(user_id: str, limit: int = 50) -> list[dict]:
    cursor = _db_handle().results.find(
        {"user_id": user_id},
        {"_id": 1, "session_id": 1, "topic": 1, "completed_at": 1,
         "percentage": 1, "total_score": 1, "max_score": 1},
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
        }
        async for doc in cursor
    ]


async def get_result_detail(result_id: str, user_id: str) -> Optional[dict]:
    result = await _db_handle().results.find_one({"_id": result_id, "user_id": user_id})
    if not result:
        return None
    session = await _db_handle().sessions.find_one({"_id": result["session_id"]})
    passage = session["session_data"]["passage"] if session else None
    return {
        "id": result["_id"],
        "topic": result["topic"],
        "completed_at": result["completed_at"],
        "percentage": result["percentage"],
        "total_score": result["total_score"],
        "max_score": result["max_score"],
        "passage": passage,
        "question_results": result["result_data"]["question_results"],
    }
