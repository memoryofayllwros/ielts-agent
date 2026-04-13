import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from models import (
    RegisterRequest, LoginRequest, AuthResponse,
    GenerateRequest, SubmitRequest, SubmitResponse,
    QuestionResult, ProgressResponse, ProgressEntry, ResultDetail,
)
from ai import generate_practice_session
from auth import hash_password, verify_password, create_access_token, get_current_user_id
from database import (
    init_db, close_db,
    create_user, get_user_by_email,
    save_session, get_session,
    save_result, get_progress, get_result_detail,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="IELTS Reading Agent", lifespan=lifespan)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

# Serve built React app — HashRouter means the server only needs to serve /
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/")
async def index():
    if FRONTEND_DIST.exists():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
    return {"message": "Frontend not built. Run: cd frontend && npm install && npm run build"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if await get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(req.email, req.username, hash_password(req.password))
    return AuthResponse(
        access_token=create_access_token(user["id"]),
        user_id=user["id"],
        username=user["username"],
        email=user["email"],
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return AuthResponse(
        access_token=create_access_token(user["_id"]),
        user_id=user["_id"],
        username=user["username"],
        email=user["email"],
    )


# ── Practice ──────────────────────────────────────────────────────────────────

@app.post("/api/practice/generate")
async def generate(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    try:
        raw = await generate_practice_session(req.topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    session_id = await save_session(raw, user_id)

    questions_safe = [
        {
            "id": q["id"],
            "type": q["type"],
            "passage_with_blanks": q.get("passage_with_blanks"),
            "word_bank": q.get("word_bank"),
            "question": q.get("question"),
            "options": q.get("options"),
        }
        for q in raw.get("questions", [])
    ]

    return {
        "session_id": session_id,
        "passage": raw["passage"],
        "topic": raw["topic"],
        "questions": questions_safe,
    }


@app.post("/api/practice/submit", response_model=SubmitResponse)
async def submit(req: SubmitRequest, user_id: str = Depends(get_current_user_id)):
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
        user_ans = req.answers.get(qid, [])

        earned, max_pts = _score_question(qtype, correct, user_ans)
        total_earned += earned
        total_max += max_pts

        question_results.append(QuestionResult(
            question_id=qid,
            type=qtype,
            is_correct=earned == max_pts,
            earned=earned,
            max=max_pts,
            user_answers=user_ans,
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
        user_id=user_id,
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


@app.get("/api/results/{result_id}", response_model=ResultDetail)
async def result_detail(result_id: str, user_id: str = Depends(get_current_user_id)):
    detail = await get_result_detail(result_id, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Result not found")
    return ResultDetail(**detail)


@app.get("/api/progress", response_model=ProgressResponse)
async def progress(user_id: str = Depends(get_current_user_id)):
    entries_raw = await get_progress(user_id=user_id, limit=50)
    entries = [ProgressEntry(**e) for e in entries_raw]
    avg = round(sum(e.percentage for e in entries) / len(entries), 1) if entries else 0.0
    return ProgressResponse(entries=entries, total_sessions=len(entries), average_percentage=avg)


def _score_question(qtype: str, correct: list, user: list) -> tuple[float, float]:
    if qtype == "fill_in_blanks":
        max_pts = float(len(correct))
        earned = sum(
            1.0
            for i, ans in enumerate(correct)
            if i < len(user) and user[i].strip().lower() == ans.strip().lower()
        )
        return earned, max_pts

    correct_set = {a.strip().upper() for a in correct}
    user_set = {a.strip().upper() for a in user}
    return (1.0, 1.0) if correct_set == user_set else (0.0, 1.0)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
