"""
Speech features using the same OpenRouter API key as the rest of the app.

- Transcription: POST /chat/completions with input_audio (base64), not OpenAI Whisper URL.
- TTS: streaming chat/completions with modalities text+audio (OpenRouter multimodal).

Override models with OPENROUTER_TRANSCRIBE_MODEL and OPENROUTER_TTS_MODEL if needed.
"""

import base64
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import httpx

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

_cache_dir = Path(__file__).resolve().parent / "static_cache" / "tts"


def _openrouter_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return key


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_openrouter_key()}",
        "Content-Type": "application/json",
    }


def _audio_format_from_filename(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "webm"
    allowed = ("wav", "mp3", "webm", "m4a", "ogg", "flac", "aac", "aiff", "pcm16", "pcm24")
    return ext if ext in allowed else "webm"


def _message_text(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text" and p.get("text"):
                parts.append(p["text"])
        return "".join(parts).strip()
    return ""


async def transcribe_audio_bytes(content: bytes, filename: str = "audio.webm") -> str:
    model = os.environ.get("OPENROUTER_TRANSCRIBE_MODEL", "google/gemini-2.0-flash-001")
    fmt = _audio_format_from_filename(filename)
    b64 = base64.standard_b64encode(content).decode()
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Transcribe this audio verbatim. Output only the spoken words, no labels or commentary.",
                    },
                    {"type": "input_audio", "input_audio": {"data": b64, "format": fmt}},
                ],
            }
        ],
        "max_tokens": 2000,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(OPENROUTER_CHAT_URL, headers=_headers(), json=payload)
        if r.status_code >= 400:
            try:
                err_body = r.json()
                err = err_body.get("error")
                msg = err.get("message") if isinstance(err, dict) else str(err or err_body)
            except Exception:
                msg = r.text[:500]
            raise RuntimeError(msg or f"HTTP {r.status_code}")
        data = r.json()
    msg = (data.get("choices") or [{}])[0].get("message") or {}
    return _message_text(msg)


async def synthesize_speech_mp3(text: str) -> bytes:
    model = os.environ.get("OPENROUTER_TTS_MODEL", "openai/gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": (
                    "Read the following aloud clearly for an English listening exercise. "
                    "Speak only the script—no introduction or closing remarks:\n\n"
                    f"{text[:3500]}"
                ),
            }
        ],
        "modalities": ["text", "audio"],
        "audio": {"voice": "alloy", "format": "mp3"},
        "stream": True,
    }
    audio_b64_parts: list[str] = []
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream("POST", OPENROUTER_CHAT_URL, headers=_headers(), json=payload) as r:
            if r.status_code >= 400:
                body = await r.aread()
                try:
                    err = json.loads(body).get("error", {}).get("message", body.decode()[:500])
                except json.JSONDecodeError:
                    err = body.decode()[:500]
                raise RuntimeError(err or f"HTTP {r.status_code}")
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                for choice in chunk.get("choices") or []:
                    delta = choice.get("delta") or {}
                    audio = delta.get("audio") or {}
                    if audio.get("data"):
                        audio_b64_parts.append(audio["data"])
    merged = "".join(audio_b64_parts)
    if not merged:
        raise RuntimeError(
            "No audio returned. Try OPENROUTER_TTS_MODEL with audio output "
            "(see OpenRouter models with output modality audio)."
        )
    return base64.b64decode(merged)


def tts_cache_path(text: str) -> Path:
    _cache_dir.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]
    return _cache_dir / f"{h}.mp3"


async def synthesize_speech_mp3_cached(text: str) -> bytes:
    path = tts_cache_path(text)
    if path.exists():
        return path.read_bytes()
    data = await synthesize_speech_mp3(text)
    path.write_bytes(data)
    return data
