import os
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from models import (
    GenerateRequest, SubmitRequest, SubmitResponse,
    QuestionResult, ProgressResponse, ProgressEntry, PracticeSession
)
from ai import generate_practice_session
from database import init_db, save_session, get_session, save_result, get_progress


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="PTE Reading Agent", lifespan=lifespan)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.post("/api/practice/generate")
async def generate(req: GenerateRequest):
    """Generate a new PTE reading practice session."""
    try:
        raw = await generate_practice_session(req.topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    session_id = await save_session(raw)

    # Return session WITHOUT correct_answers (those stay server-side)
    questions_safe = []
    for q in raw.get("questions", []):
        questions_safe.append({
            "id": q["id"],
            "type": q["type"],
            "passage_with_blanks": q.get("passage_with_blanks"),
            "word_bank": q.get("word_bank"),
            "question": q.get("question"),
            "options": q.get("options"),
            # No correct_answers in response
        })

    return {
        "session_id": session_id,
        "passage": raw["passage"],
        "topic": raw["topic"],
        "questions": questions_safe,
    }


@app.post("/api/practice/submit", response_model=SubmitResponse)
async def submit(req: SubmitRequest):
    """Grade a submitted practice session."""
    session = await get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question_results = []
    total_earned = 0.0
    total_max = 0.0

    for q in session["questions"]:
        qid = q["id"]
        qtype = q["type"]
        correct = q["correct_answers"]
        user = req.answers.get(qid, [])

        earned, max_pts = _score_question(qtype, correct, user)
        is_correct = earned == max_pts

        total_earned += earned
        total_max += max_pts

        question_results.append(QuestionResult(
            question_id=qid,
            type=qtype,
            is_correct=is_correct,
            earned=earned,
            max=max_pts,
            user_answers=user,
            correct_answers=correct,
            explanation=q["explanation"],
            question_text=q.get("question"),
            passage_with_blanks=q.get("passage_with_blanks"),
            word_bank=q.get("word_bank"),
            options=q.get("options"),
        ))

    percentage = round((total_earned / total_max * 100) if total_max > 0 else 0, 1)

    await save_result(
        session_id=req.session_id,
        topic=session["topic"],
        percentage=percentage,
        total_score=total_earned,
        max_score=total_max,
        result_data={"question_results": [r.model_dump() for r in question_results]},
    )

    return SubmitResponse(
        session_id=req.session_id,
        topic=session["topic"],
        total_score=total_earned,
        max_score=total_max,
        percentage=percentage,
        question_results=question_results,
    )


@app.get("/api/progress", response_model=ProgressResponse)
async def progress():
    """Get progress history."""
    entries_raw = await get_progress(limit=50)
    entries = [ProgressEntry(**e) for e in entries_raw]
    avg = (
        round(sum(e.percentage for e in entries) / len(entries), 1)
        if entries else 0.0
    )
    return ProgressResponse(
        entries=entries,
        total_sessions=len(entries),
        average_percentage=avg,
    )


def _score_question(qtype: str, correct: list, user: list) -> tuple[float, float]:
    """Return (earned, max) score for a question."""
    if qtype == "fill_in_blanks":
        max_pts = float(len(correct))
        earned = sum(
            1.0
            for i, ans in enumerate(correct)
            if i < len(user) and user[i].strip().lower() == ans.strip().lower()
        )
        return earned, max_pts

    if qtype == "mc_single":
        correct_set = {a.strip().upper() for a in correct}
        user_set = {a.strip().upper() for a in user}
        return (1.0, 1.0) if correct_set == user_set else (0.0, 1.0)

    if qtype == "mc_multiple":
        correct_set = {a.strip().upper() for a in correct}
        user_set = {a.strip().upper() for a in user}
        return (1.0, 1.0) if correct_set == user_set else (0.0, 1.0)

    return (0.0, 1.0)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
