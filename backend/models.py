from pydantic import BaseModel, Field, field_validator
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


# ── Practice ──────────────────────────────────────────────────────────────────

SkillLiteral = Literal["reading", "listening", "writing", "speaking"]
WritingTaskLiteral = Literal["write_essay", "summarize_written_text"]


class GenerateRequest(BaseModel):
    skill: SkillLiteral = "reading"
    topic: Optional[str] = None
    writing_task_type: Optional[WritingTaskLiteral] = "write_essay"


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


class SubmitResponse(BaseModel):
    session_id: str
    topic: str
    total_score: float
    max_score: float
    percentage: float
    question_results: List[QuestionResult]


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
