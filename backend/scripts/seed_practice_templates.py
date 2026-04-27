#!/usr/bin/env python3
"""Upsert practice_templates documents from JSON files.

Usage (from repo root):
  cd backend && python scripts/seed_practice_templates.py
  python backend/scripts/seed_practice_templates.py /path/to/templates/dir

Requires MONGODB_URL. Loads .env from repo root or backend/.env if present.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND.parent

# Allow `python scripts/seed_practice_templates.py` from backend/
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

try:
    from dotenv import load_dotenv

    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_BACKEND / ".env")
except ImportError:
    pass

from database import close_db, init_db, upsert_practice_template  # noqa: E402


DEFAULT_DIR = _BACKEND / "config" / "practice_templates"


def _validate(doc: dict, path: Path) -> None:
    sid = doc.get("skill")
    if sid not in ("reading", "listening", "writing", "speaking"):
        raise ValueError(f"{path}: invalid skill {sid!r}")
    diff = doc.get("difficulty") or ""
    if not str(diff).startswith("band"):
        raise ValueError(f"{path}: difficulty must be band4–band8 style, got {diff!r}")
    data = doc.get("session_data")
    if not isinstance(data, dict):
        raise ValueError(f"{path}: session_data must be an object")
    if "topic" not in data or not str(data.get("topic", "")).strip():
        raise ValueError(f"{path}: session_data.topic required")
    if sid in ("reading", "listening"):
        qs = data.get("questions")
        if not isinstance(qs, list) or len(qs) < 1:
            raise ValueError(f"{path}: session_data.questions must be a non-empty list")
        if sid == "listening":
            if not str(data.get("transcript") or "").strip():
                raise ValueError(f"{path}: listening session_data.transcript required")
    elif sid == "writing":
        for k in ("task_type", "prompt", "scoring_criteria", "model_answer"):
            if k not in data:
                raise ValueError(f"{path}: writing session_data missing {k}")
        wt = doc.get("writing_task_type")
        if data.get("task_type") and wt and data["task_type"] != wt:
            raise ValueError(f"{path}: writing_task_type must match session_data.task_type")
        if not wt:
            raise ValueError(f"{path}: writing template must set writing_task_type")
    elif sid == "speaking":
        for k in ("prompt", "bullet_points", "assessment_criteria", "model_outline"):
            if k not in data:
                raise ValueError(f"{path}: speaking session_data missing {k}")


async def run(directory: Path) -> int:
    if not directory.is_dir():
        print(f"Not a directory: {directory}", file=sys.stderr)
        return 1

    await init_db()
    n = 0
    now = datetime.now(timezone.utc).isoformat()

    for path in sorted(directory.glob("*.json")):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        if not doc.get("_id"):
            print(f"Skip (no _id): {path}", file=sys.stderr)
            continue
        _validate(doc, path)
        doc["active"] = bool(doc.get("active", True))
        doc.setdefault("created_at", now)
        await upsert_practice_template(doc)
        print(f"Upserted {doc['_id']} <- {path.name}")
        n += 1

    await close_db()
    print(f"Done. {n} template(s).")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed MongoDB practice_templates from JSON files.")
    ap.add_argument(
        "directory",
        nargs="?",
        type=Path,
        default=DEFAULT_DIR,
        help=f"Directory of *.json templates (default: {DEFAULT_DIR})",
    )
    args = ap.parse_args()
    raise SystemExit(asyncio.run(run(args.directory)))


if __name__ == "__main__":
    main()
