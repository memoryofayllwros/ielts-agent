from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, File, Form, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from bson import ObjectId
from models import (
    RegisterRequest, LoginRequest, AuthResponse,
    UserProfileResponse, UserProfileUpdate,
    GenerateRequest, DiagnosticGenerateRequest, SubmitRequest, SubmitResponse,
    SubmitWritingRequest, SubmitSpeakingJsonRequest, ListeningTtsRequest,
    QuestionResult, ProgressResponse, ProgressEntry, ResultDetail,
    VocabSubmitRequest, VocabResult, VocabHistoryEntry,
    SkillMapEntry, SkillMapResponse, NextStepResponse, WeeklyReportResponse,
    JourneyPoint, ModuleOverviewEntry,
    LessonGenerateRequest, LessonGenerateResponse, LessonsListResponse,
    LessonSummary, LessonDetail,
    LessonCompilePlanResponse,
    LessonComprehensionSubmit, LessonRoleplaySubmit,
    AssistantChatRequest, AssistantChatResponse,
)

from ai import generate_practice_session, generate_diagnostic_reading_session, assistant_chat
from assistant_context import build_assistant_learner_context
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
    create_user, get_user_by_email, get_user_by_id, set_user_profile_fields,
    save_session, get_session_record,
    save_result, get_progress, get_result_detail,
    diagnostic_status, record_diagnostic_skill_outcome,
    save_vocab_session, get_vocab_session,
    save_vocab_result, get_vocab_history, get_vocab_result,
    aggregate_skill_accuracy_for_user,
    insert_lesson_job, get_lesson, list_lessons_for_user, gridfs_read_mp4_bytes,
    upsert_user_weakness_vector,
    update_lesson,
)
from learning import (
    compare_weekly_skills,
    difficulty_string_from_band,
    format_band_label,
    format_micro_ielts_band_label,
    module_weighted_score,
    question_results_to_skill_outcomes,
    recommend_focus_skill,
    session_summary_strengthened_needs,
    skill_mastery_status,
    skill_trend_delta,
    speaking_evaluation_to_skill_outcomes,
    week_bounds_utc,
    writing_evaluation_to_skill_outcomes,
)
from practice_pool import pick_template_from_pool, instantiate_session_from_template
from skills_taxonomy import (
    get_skill_label,
    skill_ids_for_module,
    get_skill_meta,
    focus_practice_bullets_for_skill,
    is_valid_skill_id,
)
from lesson_selection import (
    build_why_this_lesson,
    module_for_skill_id,
    select_weak_skills_for_user,
)
from lesson_pipeline import lesson_doc_to_api_row, run_lesson_pipeline
from lesson_weakness import (
    refresh_stored_weakness_vector,
    select_skill_weighted,
    merge_evaluation_into_speaking_weakness,
)
from lesson_topics_pool import pick_topic_scenario
from lesson_graph_ops import link_new_lesson_after_previous
from lesson_scale import check_lesson_generation_rate_limit
from curriculum_compiler import compile_mini_course_plan
from vocab_agent import generate_vocab_test, estimate_level

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_BACKEND_DIR / ".env")


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


def _user_to_profile_response(user: dict) -> UserProfileResponse:
    p = user.get("profile") or {}

    def fband(k: str) -> Optional[float]:
        v = p.get(k)
        if v is None:
            return None
        return float(v)

    return UserProfileResponse(
        user_id=user["_id"],
        email=user.get("email") or "",
        username=user.get("username") or "",
        display_name=(p.get("display_name") or None),
        target_band=fband("target_band"),
        target_reading=fband("target_reading"),
        target_listening=fband("target_listening"),
        target_writing=fband("target_writing"),
        target_speaking=fband("target_speaking"),
        past_exam_band=fband("past_exam_band"),
        past_reading=fband("past_reading"),
        past_listening=fband("past_listening"),
        past_writing=fband("past_writing"),
        past_speaking=fband("past_speaking"),
        past_exam_notes=(p.get("past_exam_notes") or None),
    )


@app.get("/api/auth/me", response_model=UserProfileResponse)
async def auth_get_me(user_id: str = Depends(get_current_user_id)):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_profile_response(user)


@app.put("/api/auth/me", response_model=UserProfileResponse)
async def auth_update_me(req: UserProfileUpdate, user_id: str = Depends(get_current_user_id)):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = {
        "display_name": req.display_name,
        "target_band": req.target_band,
        "target_reading": req.target_reading,
        "target_listening": req.target_listening,
        "target_writing": req.target_writing,
        "target_speaking": req.target_speaking,
        "past_exam_band": req.past_exam_band,
        "past_reading": req.past_reading,
        "past_listening": req.past_listening,
        "past_writing": req.past_writing,
        "past_speaking": req.past_speaking,
        "past_exam_notes": req.past_exam_notes,
    }
    await set_user_profile_fields(user_id, data)
    user = await get_user_by_id(user_id)
    return _user_to_profile_response(user)


@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
async def post_assistant_chat(req: AssistantChatRequest, user_id: str = Depends(get_current_user_id)):
    try:
        payload = [m.model_dump() for m in req.messages]
        learner_context = await build_assistant_learner_context(user_id)
        reply = await assistant_chat(payload, learner_context=learner_context)
        return AssistantChatResponse(message=reply)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))


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
                "skill_id": q.get("skill_id"),
                "difficulty": q.get("difficulty"),
            }
        )
    return out


# ── Practice ──────────────────────────────────────────────────────────────────

def effective_target_from_profile(user: Optional[dict]) -> Optional[float]:
    """Prefer stored overall target; else mean of any per-skill targets."""
    if not user:
        return None
    p = user.get("profile") or {}
    if p.get("target_band") is not None:
        return float(p["target_band"])
    vals: list[float] = []
    for k in ("target_reading", "target_listening", "target_writing", "target_speaking"):
        v = p.get(k)
        if v is not None:
            vals.append(float(v))
    if not vals:
        return None
    return round(sum(vals) / len(vals), 1)


def practice_band_for_skill(user: dict, skill: str, req: GenerateRequest) -> Optional[float]:
    if req.target_band is not None:
        return float(req.target_band)
    p = user.get("profile") or {}
    by_skill = {
        "reading": "target_reading",
        "listening": "target_listening",
        "writing": "target_writing",
        "speaking": "target_speaking",
    }
    tkey = by_skill.get(skill)
    if tkey and p.get(tkey) is not None:
        return float(p[tkey])
    if p.get("target_band") is not None:
        return float(p["target_band"])
    vals: list[float] = []
    for k in ("target_reading", "target_listening", "target_writing", "target_speaking"):
        v = p.get(k)
        if v is not None:
            vals.append(float(v))
    if vals:
        return round(sum(vals) / len(vals), 1)
    return None


async def _learner_band_hint(user_id: str):
    user = await get_user_by_id(user_id)
    b = effective_target_from_profile(user)
    if b is not None:
        return b
    return average_diagnostic_band(user)


async def _resolve_practice_focus(
    user_id: str,
    skill: str,
    req: GenerateRequest,
) -> tuple[Optional[str], str]:
    user = await get_user_by_id(user_id)
    band = practice_band_for_skill(user, skill, req)
    if band is None:
        band = average_diagnostic_band(user)
    dd = difficulty_string_from_band(band)
    focus: Optional[str] = None
    if req.use_adaptive:
        acc = await aggregate_skill_accuracy_for_user(user_id)
        focus = recommend_focus_skill(acc, skill)
    elif req.focus_skill:
        focus = req.focus_skill.strip() or None
    return focus, dd


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
    learner_band = await _learner_band_hint(user_id)
    dd = difficulty_string_from_band(learner_band)
    try:
        if step == "reading":
            raw = await generate_diagnostic_reading_session(topic, default_difficulty=dd)
        elif step == "listening":
            raw = await listening_agent(topic, diagnostic=True, default_difficulty=dd)
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
    focus_micro, dd = await _resolve_practice_focus(user_id, skill, req)
    wtype = (req.writing_task_type or "write_essay") if skill == "writing" else None

    raw = None
    source_template_id = None
    topic_forces_llm = bool(req.topic and str(req.topic).strip())
    if not topic_forces_llm:
        picked = await pick_template_from_pool(
            user_id,
            skill,
            dd,
            focus_micro,
            writing_task_type=wtype,
        )
        if picked:
            raw, source_template_id = instantiate_session_from_template(picked)

    if raw is None:
        try:
            if skill == "reading":
                raw = await generate_practice_session(
                    req.topic,
                    learner_band=learner_band,
                    focus_micro_skill=focus_micro,
                    default_difficulty=dd,
                )
            elif skill == "listening":
                raw = await listening_agent(
                    req.topic,
                    learner_band=learner_band,
                    focus_micro_skill=focus_micro,
                    default_difficulty=dd,
                )
            elif skill == "writing":
                raw = await writing_agent(
                    req.topic, wtype or "write_essay", learner_band=learner_band, focus_micro_skill=focus_micro
                )
            else:
                raw = await speaking_agent(req.topic, learner_band=learner_band, focus_micro_skill=focus_micro)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    session_id = await save_session(
        raw, user_id, skill=skill, source_template_id=source_template_id
    )

    common_meta = {
        "recommended_focus": focus_micro,
        "difficulty": dd,
    }
    if skill in ("reading", "listening"):
        return {
            "session_id": session_id,
            "skill": skill,
            "topic": raw["topic"],
            "passage": raw.get("passage", ""),
            "transcript": raw.get("transcript") if skill == "listening" else None,
            "questions": _questions_safe(raw),
            **common_meta,
        }

    if skill == "writing":
        client_payload = {k: v for k, v in raw.items() if k != "model_answer"}
        return {"session_id": session_id, "skill": skill, **client_payload, **common_meta}

    client_sp = {k: v for k, v in raw.items() if k != "model_outline"}
    return {"session_id": session_id, "skill": skill, **client_sp, **common_meta}


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
            skill_id=q.get("skill_id"),
            difficulty=q.get("difficulty"),
        ))

    percentage = round((total_earned / total_max * 100) if total_max > 0 else 0, 1)

    is_diag = bool(rec.get("is_diagnostic"))
    qr_dicts = [r.model_dump() for r in question_results]
    skill_outcomes = question_results_to_skill_outcomes(qr_dicts, skill)
    st_skills, nw_skills = session_summary_strengthened_needs(skill_outcomes)
    await save_result(
        session_id=req.session_id,
        user_id=user_id,
        topic=session["topic"],
        percentage=percentage,
        total_score=total_earned,
        max_score=total_max,
        result_data={
            "question_results": qr_dicts,
            "skill_outcomes": skill_outcomes,
        },
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
        estimated_band=percentage_to_estimated_band(percentage),
        question_results=question_results,
        strengthened_skills=st_skills,
        needs_work_skills=nw_skills,
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
    skill_outcomes = writing_evaluation_to_skill_outcomes(evaluation, session)
    st_skills, nw_skills = session_summary_strengthened_needs(skill_outcomes)
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
            "skill_outcomes": skill_outcomes,
        },
        skill="writing",
        is_diagnostic=is_diag,
    )
    if is_diag:
        await record_diagnostic_skill_outcome(
            user_id, "writing", rubric_band_to_numeric(evaluation.get("band")),
        )

    return {
        "session_id": req.session_id,
        "topic": session.get("topic"),
        "evaluation": evaluation,
        "strengthened_skills": st_skills,
        "needs_work_skills": nw_skills,
    }


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
    skill_outcomes = speaking_evaluation_to_skill_outcomes(evaluation)
    st_skills, nw_skills = session_summary_strengthened_needs(skill_outcomes)
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
            "skill_outcomes": skill_outcomes,
        },
        skill="speaking",
        is_diagnostic=is_diag,
    )
    if is_diag:
        await record_diagnostic_skill_outcome(
            user_id, "speaking", rubric_band_to_numeric(evaluation.get("band")),
        )

    return {
        "session_id": session_id,
        "topic": session.get("topic"),
        "evaluation": evaluation,
        "strengthened_skills": st_skills,
        "needs_work_skills": nw_skills,
    }


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


@app.get("/api/learning/skill-map", response_model=SkillMapResponse)
async def learning_skill_map(
    module: str,
    user_id: str = Depends(get_current_user_id),
):
    if module not in ("reading", "listening", "writing", "speaking"):
        raise HTTPException(status_code=400, detail="Invalid module")
    last7, prev7, _ = week_bounds_utc()
    acc = await aggregate_skill_accuracy_for_user(user_id)
    acc_recent = await aggregate_skill_accuracy_for_user(user_id, since_iso=last7)
    acc_prev = await aggregate_skill_accuracy_for_user(user_id, since_iso=prev7, until_iso=last7)

    overview = [
        ModuleOverviewEntry(module=m, score=module_weighted_score(acc, m))
        for m in ("reading", "listening", "writing", "speaking")
    ]

    skills: list[SkillMapEntry] = []
    for sid in skill_ids_for_module(module):
        r = acc.get(sid) or {}
        tot = int(r.get("total", 0))
        c = int(r.get("correct", 0))
        a = float(r.get("accuracy", 0.0))
        trend = skill_trend_delta(acc_recent, acc_prev, sid)
        st = skill_mastery_status(a, tot)

        journey: list[JourneyPoint] = []
        rp = acc_prev.get(sid) or {}
        rr = acc_recent.get(sid) or {}
        if int(rp.get("total", 0)) >= 1:
            journey.append(
                JourneyPoint(
                    label="Prior 7 days",
                    accuracy=round(float(rp.get("accuracy", 0.0)), 4),
                )
            )
        if int(rr.get("total", 0)) >= 1:
            journey.append(
                JourneyPoint(
                    label="Last 7 days",
                    accuracy=round(float(rr.get("accuracy", 0.0)), 4),
                )
            )

        skills.append(
            SkillMapEntry(
                skill_id=sid,
                label=get_skill_label(sid),
                correct=c,
                total=tot,
                accuracy=round(a, 4),
                attempts=tot,
                trend=round(trend, 4),
                status=st,
                journey=journey,
            )
        )
    skills.sort(key=lambda x: (x.total < 1, x.accuracy if x.total > 0 else 1.0, x.label))
    return SkillMapResponse(module=module, overview=overview, skills=skills)


@app.get("/api/learning/next-step", response_model=NextStepResponse)
async def learning_next_step(
    module: str = "reading",
    user_id: str = Depends(get_current_user_id),
):
    if module not in ("reading", "listening", "writing", "speaking"):
        raise HTTPException(status_code=400, detail="Invalid module")
    user = await get_user_by_id(user_id)
    band = average_diagnostic_band(user)
    dd = difficulty_string_from_band(band)
    band_lbl = format_band_label(dd)

    acc = await aggregate_skill_accuracy_for_user(user_id)
    focus = recommend_focus_skill(acc, module)
    if not focus:
        return NextStepResponse(
            message="Do a few sessions first so we can rank skills.",
            module=module,
            difficulty=dd,
            reason="We need a little tagged data before the planner can pick a focus.",
            suggested_practice=f"{module.capitalize()} · {band_lbl} — any session.",
            focus_description="",
            focus_practice_bullets=[],
        )
    lbl = get_skill_label(focus)
    meta = get_skill_meta(focus)
    f_desc = str(meta.get("description", ""))
    f_bullets = focus_practice_bullets_for_skill(focus)
    row = acc.get(focus) or {}
    acc_focus = float(row.get("accuracy", 0.0))
    band_lbl_focus = format_micro_ielts_band_label(acc_focus)
    tot = int(row.get("total", 0))
    if tot >= 1:
        others = [
            float((acc.get(sid) or {}).get("accuracy", 0.0))
            for sid in skill_ids_for_module(module)
            if sid != focus and int((acc.get(sid) or {}).get("total", 0)) >= 1
        ]
        oth_avg = sum(others) / len(others) if others else 0.5
        oth_band_lbl = format_micro_ielts_band_label(oth_avg)
        if acc_focus + 0.08 < oth_avg:
            reason = (
                f"{lbl} looks weaker here ({band_lbl_focus}) than your other {module} skills you have data for "
                f"(~{oth_band_lbl}). Extra reps on this move {module} the fastest."
            )
        else:
            reason = f"Among skills you have tried, {lbl} is lowest ({band_lbl_focus}). Short sets help most."
    else:
        reason = f"Few tagged attempts on {lbl} yet, so we start you here in {module}."

    suggested = f"{module.capitalize()} · {band_lbl} — one session on this micro-skill."

    return NextStepResponse(
        focus_skill=focus,
        focus_label=lbl,
        focus_skill_label=lbl,
        focus_description=f_desc,
        focus_practice_bullets=f_bullets,
        module=module,
        message=f"Next: {lbl}",
        reason=reason,
        difficulty=dd,
        suggested_practice=suggested,
    )


@app.get("/api/learning/weekly-report", response_model=WeeklyReportResponse)
async def learning_weekly_report(user_id: str = Depends(get_current_user_id)):
    last7, prev7, _ = week_bounds_utc()
    acc_now = await aggregate_skill_accuracy_for_user(user_id, since_iso=last7)
    acc_prev = await aggregate_skill_accuracy_for_user(user_id, since_iso=prev7, until_iso=last7)
    imp, weak = compare_weekly_skills(acc_now, acc_prev)
    tot_items = sum(int(v.get("total", 0)) for v in acc_now.values())
    return WeeklyReportResponse(
        period_days=7,
        total_items=tot_items,
        skills_touched=len(acc_now),
        biggest_improvement=imp,
        still_weak=weak,
    )


# ── Lesson videos (weakness-driven) ───────────────────────────────────────────

ALLOWED_LESSON_KINDS = frozenset(
    {
        "skill_explainer",
        "legacy_motion",
        "speaking_scenario",
        "listening_context",
        "listening_to_speaking",
    }
)


def _difficulty_slug_from_band(band: Optional[float]) -> str:
    if band is None:
        return "band6"
    if band < 5.5:
        return "band5"
    if band < 6.5:
        return "band6"
    if band < 7.5:
        return "band7"
    return "band8"


def _comprehension_match(student: str, hint: str) -> bool:
    s = (student or "").strip().lower()
    h = (hint or "").strip().lower()
    if not s or not h:
        return False
    if s in h or h in s:
        return True
    htoks = [t for t in h.replace(",", " ").split() if len(t) > 2]
    return any(t in s for t in htoks)


@app.get("/api/lessons", response_model=LessonsListResponse)
async def lessons_list(
    user_id: str = Depends(get_current_user_id),
    module: Optional[str] = None,
):
    if module and module not in ("reading", "listening", "writing", "speaking"):
        raise HTTPException(status_code=400, detail="Invalid module")
    docs = await list_lessons_for_user(user_id, module=module, limit=50)
    rows = [LessonSummary(**lesson_doc_to_api_row(d)) for d in docs]
    return LessonsListResponse(lessons=rows)


@app.get("/api/lessons/compile-plan", response_model=LessonCompilePlanResponse)
async def lesson_compile_plan(
    user_id: str = Depends(get_current_user_id),
    module: str = "speaking",
    max_steps: int = 5,
):
    if module not in ("reading", "listening", "writing", "speaking"):
        raise HTTPException(status_code=400, detail="Invalid module")
    plan = await compile_mini_course_plan(user_id, module, max_steps=max(1, min(max_steps, 20)))
    return LessonCompilePlanResponse(
        module=str(plan.get("module") or module),
        weakness_vector=dict(plan.get("weakness_vector") or {}),
        steps=list(plan.get("steps") or []),
    )


@app.get("/api/lessons/{lesson_id}", response_model=LessonDetail)
async def lesson_detail(lesson_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await get_lesson(lesson_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    d = lesson_doc_to_api_row(doc)
    d["slides_json"] = doc.get("slides_json")
    d["narration"] = doc.get("narration")
    d["content"] = doc.get("content")
    d["comprehension_answers"] = doc.get("comprehension_answers")
    d["comprehension_results"] = doc.get("comprehension_results")
    d["roleplay_evaluation"] = doc.get("roleplay_evaluation")
    return LessonDetail(**d)


@app.get("/api/lessons/{lesson_id}/video")
async def lesson_video_stream(lesson_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await get_lesson(lesson_id, user_id)
    if not doc or doc.get("status") != "ready":
        raise HTTPException(status_code=404, detail="Video not available")
    gid = doc.get("gridfs_file_id")
    if not gid:
        raise HTTPException(status_code=404, detail="Video not stored")
    oid = ObjectId(str(gid)) if not isinstance(gid, ObjectId) else gid
    body = await gridfs_read_mp4_bytes(oid)
    return Response(content=body, media_type="video/mp4")


@app.get("/api/lessons/{lesson_id}/clips/{clip_index}/video")
async def lesson_clip_video_stream(
    lesson_id: str,
    clip_index: int,
    user_id: str = Depends(get_current_user_id),
):
    doc = await get_lesson(lesson_id, user_id)
    if not doc or doc.get("status") != "ready":
        raise HTTPException(status_code=404, detail="Video not available")
    clips = doc.get("clips") or []
    if not isinstance(clips, list) or clip_index < 0 or clip_index >= len(clips):
        raise HTTPException(status_code=404, detail="Clip not found")
    c = clips[clip_index]
    if not isinstance(c, dict):
        raise HTTPException(status_code=404, detail="Clip not found")
    gid = c.get("gridfs_file_id")
    if not gid:
        raise HTTPException(status_code=404, detail="Video not stored")
    oid = ObjectId(str(gid)) if not isinstance(gid, ObjectId) else gid
    body = await gridfs_read_mp4_bytes(oid)
    return Response(content=body, media_type="video/mp4")


@app.post("/api/lessons/{lesson_id}/comprehension", response_model=dict)
async def lesson_submit_comprehension(
    lesson_id: str,
    req: LessonComprehensionSubmit,
    user_id: str = Depends(get_current_user_id),
):
    doc = await get_lesson(lesson_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    content = doc.get("content") or {}
    questions = content.get("comprehension_questions") or []
    if not isinstance(questions, list) or not questions:
        raise HTTPException(status_code=400, detail="No comprehension questions for this lesson")
    results: dict[str, bool] = {}
    for q in questions:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id") or "")
        hint = str(q.get("answer_hint") or "")
        ans = (req.answers or {}).get(qid, "")
        results[qid] = _comprehension_match(str(ans), hint)
    await update_lesson(
        lesson_id,
        user_id,
        {
            "comprehension_submitted": True,
            "comprehension_answers": dict(req.answers or {}),
            "comprehension_results": results,
        },
    )
    return {"ok": True, "results": results}


@app.post("/api/lessons/{lesson_id}/roleplay-submit", response_model=dict)
async def lesson_submit_roleplay(
    lesson_id: str,
    req: LessonRoleplaySubmit,
    user_id: str = Depends(get_current_user_id),
):
    doc = await get_lesson(lesson_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    hook = doc.get("evaluation_hook") or {}
    if hook.get("type") not in ("speaking_response",):
        raise HTTPException(status_code=400, detail="This lesson does not accept a speaking roleplay submission")
    text = (req.transcript or "").strip()
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="Transcript too short")
    content = doc.get("content") or {}
    topic = str((doc.get("curriculum") or {}).get("topic") or "Lesson roleplay")
    prompt = str(content.get("roleplay_prompt") or content.get("practice_prompt") or "Respond naturally as the assigned role.")
    task = {
        "part": 1,
        "topic": topic,
        "prompt": prompt,
        "bullet_points": content.get("highlighted_phrases") or [],
    }
    try:
        evaluation = await evaluate_speaking(task, text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")
    wv = await refresh_stored_weakness_vector(user_id)
    merged = merge_evaluation_into_speaking_weakness(wv, evaluation)
    await upsert_user_weakness_vector(user_id, merged)
    await update_lesson(
        lesson_id,
        user_id,
        {"roleplay_submitted": True, "roleplay_evaluation": evaluation},
    )
    return {"ok": True, "evaluation": evaluation}


@app.post("/api/lessons/generate", response_model=LessonGenerateResponse)
async def lesson_generate(
    req: LessonGenerateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    ok, msg = await check_lesson_generation_rate_limit(user_id)
    if not ok:
        raise HTTPException(status_code=429, detail=msg)

    wv_snap = await refresh_stored_weakness_vector(user_id)

    modules = ("reading", "listening", "writing", "speaking")
    skill_id: Optional[str] = (req.skill_id or "").strip() or None
    mod_in = (req.module or "").strip() or None

    if skill_id:
        use_mod = module_for_skill_id(skill_id)
        if not use_mod or use_mod not in modules:
            raise HTTPException(status_code=400, detail="Invalid skill_id prefix")
        if not is_valid_skill_id(skill_id, use_mod):
            raise HTTPException(status_code=400, detail="Unknown skill_id for module")
        if mod_in and mod_in != use_mod:
            raise HTTPException(status_code=400, detail="module does not match skill_id")
        chosen_skill = skill_id
        use_module = use_mod
    elif mod_in:
        if mod_in not in modules:
            raise HTTPException(status_code=400, detail="Invalid module")
        chosen_skill = await select_skill_weighted(user_id, mod_in, weakness_vector=wv_snap, limit=12)
        use_module = mod_in
    else:
        raise HTTPException(status_code=400, detail="Provide skill_id and/or module")

    user = await get_user_by_id(user_id)
    band = average_diagnostic_band(user) if user else None
    diff = _difficulty_slug_from_band(band)
    topic_id, scenario_id, _topic_label = pick_topic_scenario(chosen_skill, use_module, seed=user_id)

    lk_in = (req.lesson_kind or "").strip() or None
    if lk_in:
        if lk_in not in ALLOWED_LESSON_KINDS:
            raise HTTPException(status_code=400, detail="Invalid lesson_kind")
        lesson_kind = lk_in
    else:
        if use_module == "speaking":
            lesson_kind = "speaking_scenario"
        elif use_module == "listening":
            lesson_kind = "listening_context"
        else:
            lesson_kind = "skill_explainer"

    curriculum = {
        "skill": use_module,
        "micro_skill": chosen_skill,
        "topic": topic_id,
        "scenario": scenario_id,
        "difficulty": diff,
        "band_target": band,
        "accent": "british",
    }
    eval_hook = (
        {"type": "speaking_response", "target_micro_skill": chosen_skill}
        if lesson_kind in ("speaking_scenario", "listening_to_speaking")
        else {"type": "comprehension_only", "target_micro_skill": chosen_skill}
        if lesson_kind == "listening_context"
        else {"type": "none", "target_micro_skill": chosen_skill}
    )

    why = await build_why_this_lesson(user_id, chosen_skill)
    title_seed = get_skill_label(chosen_skill)
    lesson_id = await insert_lesson_job(
        user_id,
        use_module,
        chosen_skill,
        title=title_seed,
        why_this_lesson=why,
        lesson_kind=lesson_kind,
        curriculum=curriculum,
        evaluation_hook=eval_hook,
        weakness_vector_snapshot=wv_snap,
    )
    await link_new_lesson_after_previous(user_id, use_module, chosen_skill, lesson_id)
    background_tasks.add_task(run_lesson_pipeline, lesson_id, user_id)
    return LessonGenerateResponse(lesson_id=lesson_id, status="queued")


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
