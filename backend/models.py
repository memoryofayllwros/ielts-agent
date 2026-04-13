from pydantic import BaseModel
from typing import List, Optional, Dict


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: str


# ── Practice ──────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
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


# ── Progress ──────────────────────────────────────────────────────────────────

class ProgressEntry(BaseModel):
    id: str
    session_id: str
    topic: str
    completed_at: str
    percentage: float
    total_score: float
    max_score: float


class ProgressResponse(BaseModel):
    entries: List[ProgressEntry]
    total_sessions: int
    average_percentage: float


class ResultDetail(BaseModel):
    id: str
    topic: str
    completed_at: str
    percentage: float
    total_score: float
    max_score: float
    passage: Optional[str]
    question_results: List[QuestionResult]
