import json
import uuid
import aiosqlite
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "pte.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                created_at TEXT NOT NULL,
                session_data TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS results (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                percentage REAL NOT NULL,
                total_score REAL NOT NULL,
                max_score REAL NOT NULL,
                result_data TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        await db.commit()


async def save_session(session_data: dict) -> str:
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO sessions (id, topic, created_at, session_data) VALUES (?, ?, ?, ?)",
            (session_id, session_data["topic"], now, json.dumps(session_data))
        )
        await db.commit()
    return session_id


async def get_session(session_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT session_data FROM sessions WHERE id = ?", (session_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return json.loads(row[0])
    return None


async def save_result(
    session_id: str,
    topic: str,
    percentage: float,
    total_score: float,
    max_score: float,
    result_data: dict
) -> str:
    result_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO results
               (id, session_id, topic, completed_at, percentage, total_score, max_score, result_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (result_id, session_id, topic, now, percentage, total_score, max_score,
             json.dumps(result_data))
        )
        await db.commit()
    return result_id


async def get_progress(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT id, session_id, topic, completed_at, percentage, total_score, max_score
               FROM results ORDER BY completed_at DESC LIMIT ?""",
            (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "session_id": row[1],
                    "topic": row[2],
                    "completed_at": row[3],
                    "percentage": row[4],
                    "total_score": row[5],
                    "max_score": row[6],
                }
                for row in rows
            ]
