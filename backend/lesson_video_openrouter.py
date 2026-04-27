"""Text-to-video via OpenRouter unified video API (model from OPENROUTER_LESSON_VIDEO_MODEL in .env)."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Optional

import httpx

OPENROUTER_VIDEOS_BASE = "https://openrouter.ai/api/v1/videos"

_SORA_SUPPORTED_DURATIONS = (4, 8, 12, 16, 20)


def _api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return key


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }


def _lesson_video_model() -> str:
    m = (os.environ.get("OPENROUTER_LESSON_VIDEO_MODEL") or "").strip()
    if not m:
        raise RuntimeError(
            "OPENROUTER_LESSON_VIDEO_MODEL is not set. Add it to .env "
            "(see .env.example), e.g. OPENROUTER_LESSON_VIDEO_MODEL=openai/sora-2-pro"
        )
    return m


def _normalize_duration_seconds(model: str, requested: int) -> int:
    m = model.lower()
    if "sora" in m:
        allowed = _SORA_SUPPORTED_DURATIONS
        return min(allowed, key=lambda x: abs(x - requested))
    # Other video models on OpenRouter use varying allowed durations; keep a loose bound.
    return max(4, min(20, requested))


def _video_params() -> dict[str, Any]:
    model = _lesson_video_model()
    duration = int(os.environ.get("OPENROUTER_LESSON_VIDEO_DURATION", "8"))
    duration = _normalize_duration_seconds(model, duration)
    return {
        "duration": duration,
        "aspect_ratio": os.environ.get("OPENROUTER_LESSON_VIDEO_ASPECT", "16:9"),
        "resolution": os.environ.get("OPENROUTER_LESSON_VIDEO_RESOLUTION", "720p"),
        "generate_audio": os.environ.get("OPENROUTER_LESSON_VIDEO_AUDIO", "true").lower()
        not in ("0", "false", "no"),
    }


def _poll_max_wait_sec() -> float:
    """Sora jobs can take several minutes; default poll window is longer than short Seedance clips."""
    return float(os.environ.get("OPENROUTER_LESSON_VIDEO_POLL_SEC", "3600"))


async def submit_video_generation(prompt: str) -> str:
    model = _lesson_video_model()
    params = _video_params()
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        **params,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(OPENROUTER_VIDEOS_BASE, headers=_headers(), json=payload)
        if r.status_code >= 400:
            try:
                err = r.json().get("error") or r.json()
            except Exception:
                err = r.text[:800]
            raise RuntimeError(f"OpenRouter video submit failed ({r.status_code}): {err}")
        data = r.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"OpenRouter video response missing id: {data!r}")
    return str(job_id)


async def poll_video_job(job_id: str, *, interval_sec: float = 5.0, max_wait_sec: Optional[float] = None) -> dict[str, Any]:
    if max_wait_sec is None:
        max_wait_sec = _poll_max_wait_sec()
    url = f"{OPENROUTER_VIDEOS_BASE}/{job_id}"
    deadline = time.monotonic() + max_wait_sec
    last: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=120.0) as client:
        while time.monotonic() < deadline:
            r = await client.get(url, headers=_headers())
            if r.status_code >= 400:
                try:
                    err = r.json().get("error") or r.json()
                except Exception:
                    err = r.text[:800]
                raise RuntimeError(f"OpenRouter video poll failed ({r.status_code}): {err}")
            last = r.json()
            st = (last.get("status") or "").lower()
            if st == "completed":
                return last
            if st in ("failed", "cancelled", "expired"):
                msg = last.get("error") or st
                raise RuntimeError(f"Video job {st}: {msg}")
            await asyncio.sleep(interval_sec)
    raise RuntimeError(f"Video generation timed out after {max_wait_sec}s (last status: {last.get('status')})")


async def download_video_content(job_id: str) -> bytes:
    url = f"{OPENROUTER_VIDEOS_BASE}/{job_id}/content"
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.get(url, headers=_headers())
        if r.status_code >= 400:
            try:
                err = r.json().get("error") or r.json()
            except Exception:
                err = r.text[:800]
            raise RuntimeError(f"OpenRouter video download failed ({r.status_code}): {err}")
        return r.content


async def generate_lesson_video_bytes(prompt: str) -> tuple[bytes, Optional[float], dict[str, Any]]:
    """
    Submit prompt → poll until completed → download MP4 (or container) bytes.
    Returns (video_bytes, duration_seconds_or_none, final_job_json).
    """
    job_id = await submit_video_generation(prompt)
    job = await poll_video_job(job_id, max_wait_sec=_poll_max_wait_sec())
    data = await download_video_content(job_id)
    params = _video_params()
    duration = float(params.get("duration") or 0) or None
    return data, duration, job
