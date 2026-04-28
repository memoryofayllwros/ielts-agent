import os
import json
import re
from typing import Any, List, Optional

from openai import AsyncOpenAI

from skills_taxonomy import allowlist_prompt_lines, get_skill_label, is_valid_skill_id, validate_or_default

_client: Optional[AsyncOpenAI] = None

MODEL = "anthropic/claude-3-haiku"


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ["OPENROUTER_API_KEY"],
        )
    return _client


SYSTEM_PROMPT = """You are an expert IELTS Academic reading test creator specializing in reading comprehension.
Generate authentic, exam-quality IELTS Academic reading practice sessions.
Always return valid JSON exactly matching the schema described in the user message.
Return ONLY the raw JSON object — no markdown fences, no explanation."""


def build_prompt(
    topic: Optional[str],
    learner_band: Optional[float] = None,
    *,
    focus_micro_skill: Optional[str] = None,
    default_difficulty: str = "band6",
) -> str:
    topic_line = (
        f"Topic: {topic}"
        if topic
        else "Choose an interesting academic topic (science, environment, technology, history, economics, linguistics, etc.)"
    )
    level_line = ""
    if learner_band is not None:
        level_line = (
            f"\nLearner baseline (approximate overall band from diagnostic): ~{learner_band:.1f}. "
            "Pitch passage difficulty and question complexity to this level.\n"
        )
    allow = allowlist_prompt_lines("reading")
    focus_block = ""
    if focus_micro_skill and is_valid_skill_id(focus_micro_skill, "reading"):
        focus_block = (
            f"\nPrioritise at least TWO questions that primarily test this micro-skill: "
            f"{focus_micro_skill} ({get_skill_label(focus_micro_skill)}).\n"
        )
    elif focus_micro_skill:
        focus_block = (
            f"\nPrioritise at least TWO questions aligned with this focus: {focus_micro_skill}.\n"
        )
    return f"""Create an IELTS Academic Reading practice session.

{topic_line}{level_line}{focus_block}

MICRO-SKILLS (Reading) — each question MUST include "skill_id" and "difficulty":
- "skill_id" MUST be copied EXACTLY from the list below (no new names, no paraphrasing).
- "difficulty" MUST be one of: band4, band5, band6, band7, band8. Use approximately {default_difficulty} for this learner unless a question is intentionally easier or harder.

Allowed skill_id values:
{allow}

Return a JSON object with exactly these fields:

{{
  "passage": "<150-200 word academic passage>",
  "topic": "<2-4 word topic name>",
  "questions": [
    {{
      "id": "q1",
      "type": "fill_in_blanks",
      "skill_id": "<EXACTLY one id from the allowed list>",
      "difficulty": "{default_difficulty}",
      "passage_with_blanks": "<passage text with 3 words replaced by [BLANK_1], [BLANK_2], [BLANK_3]>",
      "word_bank": ["<7-8 words: 3 correct + 4-5 distractors, shuffled>"],
      "question": null,
      "options": null,
      "correct_answers": ["<word for BLANK_1>", "<word for BLANK_2>", "<word for BLANK_3>"],
      "explanation": "<why each blank has that answer>"
    }},
    {{
      "id": "q2",
      "type": "mc_single",
      "skill_id": "<EXACTLY one id from the allowed list>",
      "difficulty": "{default_difficulty}",
      "passage_with_blanks": null,
      "word_bank": null,
      "question": "<comprehension question>",
      "options": ["A. <text>", "B. <text>", "C. <text>", "D. <text>"],
      "correct_answers": ["<letter of correct option>"],
      "explanation": "<why this answer is correct and others are wrong>"
    }},
    {{
      "id": "q3",
      "type": "mc_multiple",
      "skill_id": "<EXACTLY one id from the allowed list>",
      "difficulty": "{default_difficulty}",
      "passage_with_blanks": null,
      "word_bank": null,
      "question": "<question asking to identify TWO correct statements>",
      "options": ["A. <text>", "B. <text>", "C. <text>", "D. <text>", "E. <text>"],
      "correct_answers": ["<letter>", "<letter>"],
      "explanation": "<why these two answers are correct>"
    }}
  ]
}}"""


def _parse_json_object(raw: str) -> dict:
    """Parse a JSON object; repair common LLM mistakes (unescaped quotes in long strings, etc.)."""
    s = raw.strip()
    try:
        data = json.loads(s)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    try:
        from json_repair import repair_json

        data = repair_json(s, return_objects=True)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    raise ValueError("No valid JSON object in response")


def _extract_first_balanced_json_object(text: str) -> Optional[str]:
    """
    Return the substring from the first '{' to its matching '}', respecting JSON string rules.
    Avoids naive first-{ to last-} slicing, which breaks when values contain '}' or '{' (e.g. transcripts).
    """
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    i = start
    in_string = False
    escape = False
    n = len(text)
    while i < n:
        c = text[i]
        if in_string:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
        i += 1
    return None


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return _parse_json_object(text)
    except ValueError:
        pass

    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        try:
            return _parse_json_object(match.group(1))
        except ValueError:
            pass

    balanced = _extract_first_balanced_json_object(text)
    if balanced:
        try:
            return _parse_json_object(balanced)
        except ValueError:
            pass

    # Last resort: legacy slice (may fail on transcripts with unbalanced braces in dialogue)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return _parse_json_object(text[start : end + 1])
        except ValueError:
            pass

    raise ValueError("No valid JSON found in response")


def _ensure_str_list(val: Any) -> List[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str) and val.strip():
        return [val]
    return []


def _normalize_blank_placeholders(text: Optional[str]) -> Optional[str]:
    """Coerce common model mistakes to [BLANK_n] markers the UI expects."""
    if not text or not isinstance(text, str):
        return text
    out = text
    out = re.sub(
        r"\[BLANK\s+(\d+)\]",
        lambda m: f"[BLANK_{int(m.group(1))}]",
        out,
    )
    out = re.sub(
        r"\[BLANK_?(\d+)\]",
        lambda m: f"[BLANK_{int(m.group(1))}]",
        out,
    )
    return out


_TYPE_ALIASES = {
    "fill_in_the_blanks": "fill_in_blanks",
    "fill_in_blank": "fill_in_blanks",
    "fill_in_blanks": "fill_in_blanks",
    "gap_fill": "fill_in_blanks",
    "multiple_choice_single": "mc_single",
    "multiple_choice": "mc_single",
    "single_choice": "mc_single",
    "mc_single": "mc_single",
    "multiple_choice_multiple": "mc_multiple",
    "multiple_select": "mc_multiple",
    "mc_multiple": "mc_multiple",
    "mc_multi": "mc_multiple",
}


def _normalize_question_type(raw: Optional[str], q: dict) -> str:
    s = (str(raw).strip().lower().replace("-", "_") if raw is not None else "")
    s = re.sub(r"\s+", "_", s)
    if s in _TYPE_ALIASES:
        return _TYPE_ALIASES[s]
    if s in ("fill_in_blanks", "mc_single", "mc_multiple"):
        return s
    pwb = q.get("passage_with_blanks")
    wb = q.get("word_bank")
    if isinstance(pwb, str) and pwb.strip() and _ensure_str_list(wb):
        return "fill_in_blanks"
    opts = q.get("options")
    if isinstance(opts, list) and len(opts) > 0:
        ca = q.get("correct_answers") or []
        if isinstance(ca, list) and len(ca) > 1:
            return "mc_multiple"
        return "mc_single"
    return "mc_single"


def normalize_objective_session(
    data: dict,
    module: str,
    *,
    default_difficulty: str = "band6",
) -> dict:
    """Make LLM output safe for storage, scoring, and the React practice UI (Reading or Listening)."""
    out = dict(data)
    raw_qs = out.get("questions")
    if isinstance(raw_qs, dict):
        questions = list(raw_qs.values())
    elif isinstance(raw_qs, list):
        questions = raw_qs
    else:
        questions = []

    cleaned = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        qid = q.get("id")
        if not qid:
            qid = f"q{i + 1}"
        qtype = _normalize_question_type(q.get("type"), q)
        passage_with_blanks = q.get("passage_with_blanks")
        if isinstance(passage_with_blanks, str):
            passage_with_blanks = _normalize_blank_placeholders(passage_with_blanks)
        word_bank = _ensure_str_list(q.get("word_bank"))
        options = _ensure_str_list(q.get("options"))
        ca = q.get("correct_answers")
        if not isinstance(ca, list):
            ca = _ensure_str_list(ca)
        expl = q.get("explanation")
        if expl is None or (isinstance(expl, str) and not expl.strip()):
            expl = ""
        else:
            expl = str(expl)

        diff_raw = q.get("difficulty")
        if isinstance(diff_raw, str) and diff_raw.strip().startswith("band"):
            diff = diff_raw.strip().lower()
        else:
            diff = default_difficulty

        cleaned.append(
            {
                "id": str(qid),
                "type": qtype,
                "skill_id": validate_or_default(q.get("skill_id"), module),
                "difficulty": diff,
                "passage_with_blanks": passage_with_blanks,
                "word_bank": word_bank or None,
                "question": q.get("question"),
                "options": options or None,
                "correct_answers": ca,
                "explanation": expl,
            }
        )

    if not cleaned:
        raise ValueError("Session has no valid questions")

    out["questions"] = cleaned
    if not out.get("topic"):
        out["topic"] = "Practice"
    if not isinstance(out.get("passage"), str):
        out["passage"] = str(out.get("passage") or "")
    return out


def normalize_reading_session(data: dict, *, default_difficulty: str = "band6") -> dict:
    return normalize_objective_session(data, "reading", default_difficulty=default_difficulty)


async def generate_practice_session(
    topic: Optional[str] = None,
    learner_band: Optional[float] = None,
    *,
    focus_micro_skill: Optional[str] = None,
    default_difficulty: str = "band6",
) -> dict:
    """Generate an IELTS Academic reading practice session via Claude on OpenRouter."""
    prompt = build_prompt(
        topic,
        learner_band=learner_band,
        focus_micro_skill=focus_micro_skill,
        default_difficulty=default_difficulty,
    )

    response = await _get_client().chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=4000,
    )

    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from model")

    return normalize_reading_session(_extract_json(text), default_difficulty=default_difficulty)


def build_diagnostic_reading_prompt(topic: Optional[str], default_difficulty: str = "band6") -> str:
    topic_line = (
        f"Topic: {topic}"
        if topic
        else "Choose a compact academic topic suitable for a quick level check."
    )
    allow = allowlist_prompt_lines("reading")
    return f"""Create a SHORT baseline diagnostic IELTS Academic Reading mini-test.

{topic_line}

Requirements:
- "passage": 90–120 words only, academic tone.
- Exactly **5** items in "questions" (ids q1–q5). Mix: at least one fill_in_blanks, at least one mc_single, at least one mc_multiple (two correct letters). Remaining types are your choice among those three.
- For fill_in_blanks use [BLANK_1], [BLANK_2], … placeholders and a shuffled word_bank with correct words plus distractors.
- Each question MUST include "skill_id" (EXACTLY from the list below) and "difficulty" (e.g. {default_difficulty}).

Allowed skill_id values:
{allow}

Return a JSON object with exactly these fields:

{{
  "passage": "<90-120 words>",
  "topic": "<2-4 word topic name>",
  "questions": [
    {{
      "id": "q1",
      "type": "fill_in_blanks",
      "skill_id": "<exact id from list>",
      "difficulty": "{default_difficulty}",
      "passage_with_blanks": "<text with [BLANK_n] placeholders>",
      "word_bank": ["<words shuffled>"],
      "question": null,
      "options": null,
      "correct_answers": ["<in blank order>"],
      "explanation": "<brief>"
    }}
    // ... exactly 5 question objects total, ids q1 through q5
  ]
}}"""


ASSISTANT_SYSTEM = """You are a friendly, concise IELTS study coach for the "IELTS Band Booster" learning app.

Help with exam format, scoring concepts, skill-building tips, practice strategies, and explanations of Reading, Listening, Writing, and Speaking tasks.

Keep answers focused and actionable. Prefer short paragraphs or bullet lists when helpful. Stay accurate about IELTS; avoid inventing official wording, dates, or quotas.

If asked about unrelated topics, answer briefly only if trivial, otherwise steer back to IELTS preparation."""

ASSISTANT_PERSONALIZATION_SUFFIX = """

When a LEARNER_SNAPSHOT block is included below, you MUST:
- Ground answers in their stated targets, diagnostic bands (if any), weakest micro-skills, and notes.
- For band goals (e.g. reaching 7), name which skills/modules are furthest below that goal in *their* data and give concrete next steps for those gaps—not generic exam advice.
- If diagnostic or practice data is missing, say what is missing and what they should do in the app next, instead of inventing scores.
"""


async def assistant_chat(messages: List[dict], learner_context: Optional[str] = None) -> str:
    """Turn-based coach chat via the same OpenRouter model as generation features."""
    system = ASSISTANT_SYSTEM
    if learner_context and learner_context.strip():
        system = (
            ASSISTANT_SYSTEM
            + ASSISTANT_PERSONALIZATION_SUFFIX
            + "\n\n"
            + learner_context.strip()
        )
    api_messages = [{"role": "system", "content": system}]
    for m in messages:
        api_messages.append({"role": m["role"], "content": m["content"]})

    response = await _get_client().chat.completions.create(
        model=MODEL,
        messages=api_messages,
        max_tokens=2000,
        temperature=0.6,
    )
    text = response.choices[0].message.content
    if not text or not str(text).strip():
        raise ValueError("Empty response from model")
    return str(text).strip()


async def generate_diagnostic_reading_session(topic: Optional[str] = None, default_difficulty: str = "band6") -> dict:
    prompt = build_diagnostic_reading_prompt(topic, default_difficulty=default_difficulty)
    response = await _get_client().chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=4000,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from model")
    return normalize_reading_session(_extract_json(text), default_difficulty=default_difficulty)
