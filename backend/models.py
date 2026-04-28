from pydantic import BaseModel, Field, field_validator, ValidationInfo
from typing import Any, List, Literal, Optional, Dict


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str


def _ielts_band_value(v: Optional[float], field: str) -> Optional[float]:
    if v is None:
        return None
    x = float(v)
    if x < 4.0 or x > 9.0:
        raise ValueError(f"{field} must be between 4 and 9")
    doubled = round(x * 2)
    if abs(x * 2 - doubled) > 1e-6:
        raise ValueError(f"{field} must use half-point steps (e.g. 6.5)")
    return doubled / 2.0


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str
    display_name: Optional[str] = None
    # Overall and per-skill (IELTS reports Listening, Reading, Writing, Speaking, plus an overall band).
    target_band: Optional[float] = None
    target_reading: Optional[float] = None
    target_listening: Optional[float] = None
    target_writing: Optional[float] = None
    target_speaking: Optional[float] = None
    past_exam_band: Optional[float] = None
    past_reading: Optional[float] = None
    past_listening: Optional[float] = None
    past_writing: Optional[float] = None
    past_speaking: Optional[float] = None
    past_exam_notes: Optional[str] = None


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    target_band: Optional[float] = None
    target_reading: Optional[float] = None
    target_listening: Optional[float] = None
    target_writing: Optional[float] = None
    target_speaking: Optional[float] = None
    past_exam_band: Optional[float] = None
    past_reading: Optional[float] = None
    past_listening: Optional[float] = None
    past_writing: Optional[float] = None
    past_speaking: Optional[float] = None
    past_exam_notes: Optional[str] = None

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_name_up(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @field_validator("past_exam_notes", mode="before")
    @classmethod
    def notes_up(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()[:2000]
        return s if s else None

    @field_validator("target_band", mode="before")
    @classmethod
    def v_target_band(cls, v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        return _ielts_band_value(float(v), "target_band")

    @field_validator("past_exam_band", mode="before")
    @classmethod
    def v_past_exam_band(cls, v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        return _ielts_band_value(float(v), "past_exam_band")

    @field_validator(
        "target_reading",
        "target_listening",
        "target_writing",
        "target_speaking",
        "past_reading",
        "past_listening",
        "past_writing",
        "past_speaking",
        mode="before",
    )
    @classmethod
    def v_skill_band_fields(cls, v: Any, info: ValidationInfo) -> Optional[float]:
        if v is None or v == "":
            return None
        fname = info.field_name if info.field_name else "band"
        return _ielts_band_value(float(v), fname)


# ── Practice ──────────────────────────────────────────────────────────────────

SkillLiteral = Literal["reading", "listening", "writing", "speaking"]
WritingTaskLiteral = Literal["write_essay", "summarize_written_text"]


class GenerateRequest(BaseModel):
    skill: SkillLiteral = "reading"
    topic: Optional[str] = None
    writing_task_type: Optional[WritingTaskLiteral] = "write_essay"
    use_adaptive: bool = False
    focus_skill: Optional[str] = None
    target_band: Optional[float] = None


class DiagnosticGenerateRequest(BaseModel):
    """Start one section of the four-skill baseline diagnostic."""
    step: SkillLiteral
    topic: Optional[str] = None


class Question(BaseModel):
    id: str
    type: str  # "fill_in_blanks" | "mc_single" | "mc_multiple"
    passage_with_blanks: Optional[str] = None
    word_bank: Optional[List[str]] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answers: List[str]
    explanation: str
    skill_id: Optional[str] = None
    difficulty: Optional[str] = None  # e.g. "band6"


class PracticeSession(BaseModel):
    id: str
    passage: str
    topic: str
    questions: List[Question]
    created_at: str


class SubmitRequest(BaseModel):
    session_id: str
    answers: Dict[str, List[str]]


class SubmitWritingRequest(BaseModel):
    session_id: str
    essay_text: str


class SubmitSpeakingJsonRequest(BaseModel):
    session_id: str
    transcript: str


class ListeningTtsRequest(BaseModel):
    session_id: str


class QuestionResult(BaseModel):
    question_id: str
    type: str
    is_correct: bool
    earned: float
    max: float
    user_answers: List[str]
    correct_answers: List[str]
    explanation: str
    question_text: Optional[str] = None
    passage_with_blanks: Optional[str] = None
    word_bank: Optional[List[str]] = None
    options: Optional[List[str]] = None
    skill_id: Optional[str] = None
    difficulty: Optional[str] = None


class SubmitResponse(BaseModel):
    session_id: str
    topic: str
    total_score: float
    max_score: float
    percentage: float
    estimated_band: float
    question_results: List[QuestionResult]
    strengthened_skills: List[str] = Field(default_factory=list)
    needs_work_skills: List[str] = Field(default_factory=list)


class JourneyPoint(BaseModel):
    label: str
    accuracy: float


class ModuleOverviewEntry(BaseModel):
    module: str
    score: float


class SkillMapEntry(BaseModel):
    skill_id: str
    label: str
    correct: int
    total: int
    accuracy: float
    attempts: int = 0
    trend: float = 0.0
    status: str = "unknown"
    journey: List[JourneyPoint] = Field(default_factory=list)


class SkillMapResponse(BaseModel):
    module: str
    overview: List[ModuleOverviewEntry] = Field(default_factory=list)
    skills: List[SkillMapEntry]


class NextStepResponse(BaseModel):
    focus_skill: Optional[str] = None
    focus_label: Optional[str] = None
    focus_skill_label: Optional[str] = None
    focus_description: str = ""
    focus_practice_bullets: List[str] = Field(default_factory=list)
    module: Optional[str] = None
    message: str = ""
    reason: str = ""
    difficulty: str = ""
    suggested_practice: str = ""


class WeeklyReportResponse(BaseModel):
    period_days: int = 7
    total_items: int = 0
    skills_touched: int = 0
    biggest_improvement: List[str] = Field(default_factory=list)
    still_weak: List[str] = Field(default_factory=list)


# ── Vocabulary test ───────────────────────────────────────────────────────────

class VocabSubmitRequest(BaseModel):
    session_id: str
    answers: Dict[str, str]   # { "v1": "A", "v2": "C", … }


class VocabLevelBreakdown(BaseModel):
    level: str
    correct: int
    total: int
    accuracy: Optional[float] = None


class VocabItemResult(BaseModel):
    question_id: str
    word: str
    level: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    sentence: str
    explanation: str
    options: List[str]


class VocabResult(BaseModel):
    session_id: str
    result_id: str
    topic: str
    completed_at: str
    estimated_level: str
    estimated_vocab_size: int
    total_correct: int
    total_questions: int
    percentage: float
    level_breakdown: List[VocabLevelBreakdown]
    item_results: List[VocabItemResult]


class VocabHistoryEntry(BaseModel):
    result_id: str
    topic: str
    completed_at: str
    estimated_level: str
    estimated_vocab_size: int
    percentage: float


# ── Progress ──────────────────────────────────────────────────────────────────

class ProgressEntry(BaseModel):
    id: str
    session_id: str
    topic: str
    completed_at: str
    percentage: float
    total_score: float
    max_score: float
    skill: str = "reading"


class ProgressResponse(BaseModel):
    entries: List[ProgressEntry]
    total_sessions: int
    average_percentage: float


class ResultDetail(BaseModel):
    id: str
    skill: str = "reading"
    topic: str
    completed_at: str
    percentage: float
    total_score: float
    max_score: float
    passage: Optional[str] = None
    transcript: Optional[str] = None
    question_results: List[QuestionResult] = Field(default_factory=list)
    user_response: Optional[str] = None
    evaluation: Optional[Dict[str, Any]] = None
    speaking_task: Optional[Dict[str, Any]] = None
    writing_task_summary: Optional[Dict[str, Any]] = None


# ── Lesson videos ─────────────────────────────────────────────────────────────

class LessonClipPlayback(BaseModel):
    index: int
    type: str
    url: str
    duration_sec: Optional[float] = None
    size_bytes: Optional[int] = None


class LessonSummary(BaseModel):
    id: str
    module: str
    skill_id: str
    title: Optional[str] = None
    status: str
    playback_url: Optional[str] = None
    clip_playback: List[LessonClipPlayback] = Field(default_factory=list)
    storage_backend: Optional[str] = None
    gridfs_file_id: Optional[str] = None
    duration_sec: Optional[float] = None
    size_bytes: Optional[int] = None
    error: Optional[str] = None
    why_this_lesson: Optional[Dict[str, Any]] = None
    lesson_kind: str = "skill_explainer"
    curriculum: Dict[str, Any] = Field(default_factory=dict)
    evaluation_hook: Optional[Dict[str, Any]] = None
    weakness_vector_snapshot: Optional[Dict[str, Any]] = None
    graph_prerequisite_lesson_ids: List[str] = Field(default_factory=list)
    graph_next_lesson_ids: List[str] = Field(default_factory=list)
    comprehension_submitted: bool = False
    roleplay_submitted: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class LessonDetail(LessonSummary):
    slides_json: Optional[List[Dict[str, Any]]] = None
    narration: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    comprehension_answers: Optional[Dict[str, Any]] = None
    comprehension_results: Optional[Dict[str, Any]] = None
    roleplay_evaluation: Optional[Dict[str, Any]] = None


class LessonsListResponse(BaseModel):
    lessons: List[LessonSummary]


class LessonGenerateRequest(BaseModel):
    skill_id: Optional[str] = None
    module: Optional[str] = None
    lesson_kind: Optional[str] = None


class LessonGenerateResponse(BaseModel):
    lesson_id: str
    status: str


class LessonCompilePlanResponse(BaseModel):
    module: str
    weakness_vector: Dict[str, Any]
    steps: List[Dict[str, Any]]


class LessonComprehensionSubmit(BaseModel):
    answers: Dict[str, str] = Field(default_factory=dict)


class LessonRoleplaySubmit(BaseModel):
    transcript: str = ""


# ── Assistant chat (in-app IELTS coach) ───────────────────────────────────────

class AssistantChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v: str) -> str:
        if not isinstance(v, str):
            raise TypeError("content must be a string")
        s = v.strip()
        if not s:
            raise ValueError("message content cannot be empty")
        return s


class AssistantChatRequest(BaseModel):
    messages: List[AssistantChatMessage] = Field(min_length=1, max_length=32)

    @field_validator("messages", mode="after")
    @classmethod
    def last_from_user(cls, v: List[AssistantChatMessage]) -> List[AssistantChatMessage]:
        if v[-1].role != "user":
            raise ValueError("last message must be from the user")
        return v


class AssistantChatResponse(BaseModel):
    message: str
