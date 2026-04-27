"""Operational guards for lesson generation (MVP: per-user rate window).

Future scale-out (deferred): durable job queue, cross-user dedup by content hash,
provider-specific backoff for Sora/Kling/ElevenLabs (C2), and GridFS lifecycle TTL.
Configure via LESSON_GEN_MAX_PER_WINDOW, LESSON_GEN_WINDOW_HOURS.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from database import count_recent_lesson_jobs_for_user


def lesson_gen_max_per_window() -> int:
    return max(1, int(os.environ.get("LESSON_GEN_MAX_PER_WINDOW", "30")))


def lesson_gen_window_hours() -> int:
    return max(1, int(os.environ.get("LESSON_GEN_WINDOW_HOURS", "24")))


async def check_lesson_generation_rate_limit(user_id: str) -> tuple[bool, str]:
    """
    Returns (allowed, message_if_blocked).
    """
    window_h = lesson_gen_window_hours()
    max_n = lesson_gen_max_per_window()
    since = (datetime.now(timezone.utc) - timedelta(hours=window_h)).isoformat()
    n = await count_recent_lesson_jobs_for_user(user_id, since_iso=since)
    if n >= max_n:
        return False, f"Lesson generation limit reached ({max_n} per {window_h}h). Try again later."
    return True, ""
