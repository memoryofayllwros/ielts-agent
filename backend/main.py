from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_BACKEND_DIR / ".env")

from fastapi import FastAPI, HTTPException, Depends, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from models import (
    RegisterRequest, LoginRequest, AuthResponse,
    GenerateRequest, DiagnosticGenerateRequest, SubmitRequest, SubmitResponse,
    SubmitWritingRequest, SubmitSpeakingJsonRequest, ListeningTtsRequest,
    QuestionResult, ProgressResponse, ProgressEntry, ResultDetail,
    VocabSubmitRequest, VocabResult, VocabHistoryEntry,
)
from ai import generate_practice_session, generate_diagnostic_reading_session
from diagnostic import (
    average_diagnostic_band,
    percentage_to_estimated_band,
    rubric_band_to_numeric,
)
from agents import (
    listening_agent,
    writing_agent,
    speaking_agent,
    evaluate_writing,
    evaluate_speaking,
)
from auth import hash_password, verify_password, create_access_token, get_current_user_id
from database import (
    init_db, close_db,
    create_user, get_user_by_email, get_user_by_id,
    save_session, get_session_record,
    save_result, get_progress, get_result_detail,
    diagnostic_status, record_diagnostic_skill_outcome,
    save_vocab_session, get_vocab_session,
    save_vocab_result, get_vocab_history, get_vocab_result,
)
from vocab_agent import generate_vocab_test, estimate_level


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="IELTS Band Booster Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

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
    user = await create_user(req.email, hash_password(req.password))
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


def _questions_safe(raw: dict) -> list:
    out = []
    for q in raw.get("questions") or []:
        if not isinstance(q, dict) or not q.get("id"):
            continue
        out.append(
            {
                "id": q["id"],
                "type": q.get("type") or "mc_single",
                "passage_with_blanks": q.get("passage_with_blanks"),
                "word_bank": q.get("word_bank"),
                "question": q.get("question"),
                "options": q.get("options"),
            }
        )
    return out


# ── Practice ──────────────────────────────────────────────────────────────────

async def _learner_band_hint(user_id: str):
    user = await get_user_by_id(user_id)
    return average_diagnostic_band(user)


@app.get("/api/diagnostic/status")
async def get_diagnostic_status(user_id: str = Depends(get_current_user_id)):
    return await diagnostic_status(user_id)


@app.post("/api/diagnostic/generate")
async def diagnostic_generate(req: DiagnosticGenerateRequest, user_id: str = Depends(get_current_user_id)):
    st = await diagnostic_status(user_id)
    if st["completed"]:
        raise HTTPException(status_code=400, detail="Baseline diagnostic is already complete")
    step = req.step
    if step in st["bands"]:
        raise HTTPException(
            status_code=400,
            detail=f"The {step} diagnostic section is already complete. Continue with another skill.",
        )
    topic = req.topic
    try:
        if step == "reading":
            raw = await generate_diagnostic_reading_session(topic)
        elif step == "listening":
            raw = await listening_agent(topic, diagnostic=True)
        elif step == "writing":
            raw = await writing_agent(topic, "write_essay", diagnostic=True)
        else:
            raw = await speaking_agent(topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic generation failed: {str(e)}")

    session_id = await save_session(raw, user_id, skill=step, is_diagnostic=True)

    if step in ("reading", "listening"):
        return {
            "session_id": session_id,
            "skill": step,
            "topic": raw["topic"],
            "passage": raw.get("passage", ""),
            "transcript": raw.get("transcript") if step == "listening" else None,
            "questions": _questions_safe(raw),
            "is_diagnostic": True,
        }

    if step == "writing":
        client_payload = {k: v for k, v in raw.items() if k != "model_answer"}
        return {"session_id": session_id, "skill": step, **client_payload, "is_diagnostic": True}

    client_sp = {k: v for k, v in raw.items() if k != "model_outline"}
    return {"session_id": session_id, "skill": step, **client_sp, "is_diagnostic": True}


@app.post("/api/practice/generate")
async def generate(req: GenerateRequest, user_id: str = Depends(get_current_user_id)):
    skill = req.skill
    learner_band = await _learner_band_hint(user_id)
    try:
        if skill == "reading":
            raw = await generate_practice_session(req.topic, learner_band=learner_band)
        elif skill == "listening":
            raw = await listening_agent(req.topic, learner_band=learner_band)
        elif skill == "writing":
            wtype = req.writing_task_type or "write_essay"
            raw = await writing_agent(req.topic, wtype, learner_band=learner_band)
        else:
            raw = await speaking_agent(req.topic, learner_band=learner_band)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    session_id = await save_session(raw, user_id, skill=skill)

    if skill in ("reading", "listening"):
        return {
            "session_id": session_id,
            "skill": skill,
            "topic": raw["topic"],
            "passage": raw.get("passage", ""),
            "transcript": raw.get("transcript") if skill == "listening" else None,
            "questions": _questions_safe(raw),
        }

    if skill == "writing":
        client_payload = {k: v for k, v in raw.items() if k != "model_answer"}
        return {"session_id": session_id, "skill": skill, **client_payload}

    client_sp = {k: v for k, v in raw.items() if k != "model_outline"}
    return {"session_id": session_id, "skill": skill, **client_sp}


@app.post("/api/practice/submit", response_model=SubmitResponse)
async def submit(req: SubmitRequest, user_id: str = Depends(get_current_user_id)):
    rec = await get_session_record(req.session_id)
    if not rec or rec["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    skill = rec.get("skill") or "reading"
    if skill not in ("reading", "listening"):
        raise HTTPException(status_code=400, detail="Use the writing or speaking submit endpoint for this session")

    session = rec["session_data"]
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

    is_diag = bool(rec.get("is_diagnostic"))
    await save_result(
        session_id=req.session_id,
        user_id=user_id,
        topic=session["topic"],
        percentage=percentage,
        total_score=total_earned,
        max_score=total_max,
        result_data={"question_results": [r.model_dump() for r in question_results]},
        skill=skill,
        is_diagnostic=is_diag,
    )
    if is_diag:
        await record_diagnostic_skill_outcome(
            user_id, skill, percentage_to_estimated_band(percentage),
        )

    return SubmitResponse(
        session_id=req.session_id,
        topic=session["topic"],
        total_score=total_earned,
        max_score=total_max,
        percentage=percentage,
        question_results=question_results,
    )


@app.post("/api/practice/submit-writing")
async def submit_writing(req: SubmitWritingRequest, user_id: str = Depends(get_current_user_id)):
    rec = await get_session_record(req.session_id)
    if not rec or rec["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if rec.get("skill") != "writing":
        raise HTTPException(status_code=400, detail="Not a writing session")

    session = rec["session_data"]
    text = req.essay_text.strip()
    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Response too short")

    try:
        evaluation = await evaluate_writing(session, text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

    pct = float(evaluation.get("percentage", 0))
    ts = float(evaluation.get("total_score", 0))
    ms = float(evaluation.get("max_score", 1))

    summary = {
        "task_type": session.get("task_type"),
        "prompt": session.get("prompt"),
        "passage": session.get("passage"),
    }

    is_diag = bool(rec.get("is_diagnostic"))
    await save_result(
        session_id=req.session_id,
        user_id=user_id,
        topic=session.get("topic", "Writing"),
        percentage=pct,
        total_score=ts,
        max_score=ms,
        result_data={
            "user_response": text,
            "evaluation": evaluation,
            "writing_task_summary": summary,
        },
        skill="writing",
        is_diagnostic=is_diag,
    )
    if is_diag:
        await record_diagnostic_skill_outcome(
            user_id, "writing", rubric_band_to_numeric(evaluation.get("band")),
        )

    return {"session_id": req.session_id, "topic": session.get("topic"), "evaluation": evaluation}


async def _submit_speaking_impl(
    user_id: str,
    session_id: str,
    transcript: Optional[str],
    audio: Optional[UploadFile],
) -> dict:
    rec = await get_session_record(session_id)
    if not rec or rec["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if rec.get("skill") != "speaking":
        raise HTTPException(status_code=400, detail="Not a speaking session")

    session = rec["session_data"]
    text = (transcript or "").strip()

    if audio and audio.filename:
        content = await audio.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large")
        if not text:
            try:
                from speech_openai import transcribe_audio_bytes
                text = await transcribe_audio_bytes(content, audio.filename or "audio.webm")
            except RuntimeError:
                raise HTTPException(
                    status_code=400,
                    detail="Could not transcribe audio. Check OPENROUTER_API_KEY or paste a transcript.",
                )

    if not text:
        raise HTTPException(status_code=400, detail="Provide audio or a transcript")

    if len(text) < 5:
        raise HTTPException(status_code=400, detail="Transcript too short")

    try:
        evaluation = await evaluate_speaking(session, text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

    pct = float(evaluation.get("percentage", 0))
    ts = float(evaluation.get("total_score", 0))
    ms = float(evaluation.get("max_score", 1))

    speaking_task = {
        "part": session.get("part"),
        "topic": session.get("topic"),
        "prompt": session.get("prompt"),
        "bullet_points": session.get("bullet_points"),
    }

    is_diag = bool(rec.get("is_diagnostic"))
    await save_result(
        session_id=session_id,
        user_id=user_id,
        topic=session.get("topic", "Speaking"),
        percentage=pct,
        total_score=ts,
        max_score=ms,
        result_data={
            "user_response": text,
            "evaluation": evaluation,
            "speaking_task": speaking_task,
        },
        skill="speaking",
        is_diagnostic=is_diag,
    )
    if is_diag:
        await record_diagnostic_skill_outcome(
            user_id, "speaking", rubric_band_to_numeric(evaluation.get("band")),
        )

    return {"session_id": session_id, "topic": session.get("topic"), "evaluation": evaluation}


@app.post("/api/practice/submit-speaking")
async def submit_speaking(
    user_id: str = Depends(get_current_user_id),
    session_id: str = Form(...),
    transcript: Optional[str] = Form(None),
    audio: Optional[UploadFile] = File(None),
):
    return await _submit_speaking_impl(user_id, session_id, transcript, audio)


@app.post("/api/practice/submit-speaking-json")
async def submit_speaking_json(req: SubmitSpeakingJsonRequest, user_id: str = Depends(get_current_user_id)):
    """JSON body alternative when not uploading audio (e.g. Web Speech API transcript)."""
    return await _submit_speaking_impl(user_id, req.session_id, req.transcript, None)


@app.post("/api/listening/tts")
async def listening_tts(req: ListeningTtsRequest, user_id: str = Depends(get_current_user_id)):
    sid = req.session_id
    rec = await get_session_record(sid)
    if not rec or rec["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if rec.get("skill") != "listening":
        raise HTTPException(status_code=400, detail="Not a listening session")
    transcript = rec["session_data"].get("transcript") or ""
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="No transcript for this session")
    try:
        from speech_openai import synthesize_speech_mp3_cached
        data = await synthesize_speech_mp3_cached(transcript)
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="Server TTS unavailable (OpenRouter audio models). Use browser text-to-speech instead.",
        )
    return Response(content=data, media_type="audio/mpeg")


@app.get("/api/results/{result_id}", response_model=ResultDetail)
async def result_detail(result_id: str, user_id: str = Depends(get_current_user_id)):
    detail = await get_result_detail(result_id, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Result not found")
    return ResultDetail(**detail)


@app.get("/api/progress", response_model=ProgressResponse)
async def progress(
    user_id: str = Depends(get_current_user_id),
    skill: Optional[str] = None,
):
    entries_raw = await get_progress(user_id=user_id, limit=50, skill=skill)
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


# ── Vocabulary level test ─────────────────────────────────────────────────────

@app.post("/api/vocab/generate")
async def vocab_generate(
    topic: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """Generate a 20-question CEFR vocabulary test (A2–C2)."""
    try:
        session_data = await generate_vocab_test(topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vocab generation failed: {str(e)}")

    session_id = await save_vocab_session(session_data, user_id)

    # Strip correct answers before sending to the client
    safe_questions = [
        {
            "id": q["id"],
            "word": q["word"],
            "level": q["level"],
            "sentence": q["sentence"],
            "stem": q.get("stem", f"What does the word '{q['word']}' mean?"),
            "options": q["options"],
        }
        for q in session_data["questions"]
    ]

    return {
        "session_id": session_id,
        "topic": session_data["topic"],
        "total_questions": len(safe_questions),
        "questions": safe_questions,
    }


@app.post("/api/vocab/submit", response_model=VocabResult)
async def vocab_submit(
    req: VocabSubmitRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Submit answers and receive level estimate + detailed feedback."""
    session_data = await get_vocab_session(req.session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Vocab session not found")

    evaluation = estimate_level(session_data["questions"], req.answers)

    result_id = await save_vocab_result(
        session_id=req.session_id,
        user_id=user_id,
        topic=session_data.get("topic", "General Vocabulary"),
        evaluation=evaluation,
    )

    return VocabResult(
        session_id=req.session_id,
        result_id=result_id,
        topic=session_data.get("topic", "General Vocabulary"),
        completed_at=__import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        **evaluation,
    )


@app.get("/api/vocab/history")
async def vocab_history(user_id: str = Depends(get_current_user_id)):
    """Return the user's past vocabulary test results (latest 20)."""
    entries = await get_vocab_history(user_id)
    return {"entries": entries}


@app.get("/api/vocab/result/{result_id}")
async def vocab_result_detail(
    result_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Full detail for one past vocabulary test result."""
    detail = await get_vocab_result(result_id, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Result not found")
    return detail


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
