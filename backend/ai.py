import os
import json
import re
from typing import Optional

from openai import AsyncOpenAI

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


def build_prompt(topic: Optional[str], learner_band: Optional[float] = None) -> str:
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
    return f"""Create an IELTS Academic Reading practice session.

{topic_line}{level_line}

Return a JSON object with exactly these fields:

{{
  "passage": "<150-200 word academic passage>",
  "topic": "<2-4 word topic name>",
  "questions": [
    {{
      "id": "q1",
      "type": "fill_in_blanks",
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
      "passage_with_blanks": null,
      "word_bank": null,
      "question": "<question asking to identify TWO correct statements>",
      "options": ["A. <text>", "B. <text>", "C. <text>", "D. <text>", "E. <text>"],
      "correct_answers": ["<letter>", "<letter>"],
      "explanation": "<why these two answers are correct>"
    }}
  ]
}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
    if match:
        return json.loads(match.group(1))

    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return json.loads(text[start:end + 1])

    raise ValueError("No valid JSON found in response")


async def generate_practice_session(
    topic: Optional[str] = None,
    learner_band: Optional[float] = None,
) -> dict:
    """Generate an IELTS Academic reading practice session via Claude on OpenRouter."""
    prompt = build_prompt(topic, learner_band=learner_band)

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

    return _extract_json(text)


def build_diagnostic_reading_prompt(topic: Optional[str]) -> str:
    topic_line = (
        f"Topic: {topic}"
        if topic
        else "Choose a compact academic topic suitable for a quick level check."
    )
    return f"""Create a SHORT baseline diagnostic IELTS Academic Reading mini-test.

{topic_line}

Requirements:
- "passage": 90–120 words only, academic tone.
- Exactly **5** items in "questions" (ids q1–q5). Mix: at least one fill_in_blanks, at least one mc_single, at least one mc_multiple (two correct letters). Remaining types are your choice among those three.
- For fill_in_blanks use [BLANK_1], [BLANK_2], … placeholders and a shuffled word_bank with correct words plus distractors.

Return a JSON object with exactly these fields:

{{
  "passage": "<90-120 words>",
  "topic": "<2-4 word topic name>",
  "questions": [
    {{
      "id": "q1",
      "type": "fill_in_blanks",
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


async def generate_diagnostic_reading_session(topic: Optional[str] = None) -> dict:
    prompt = build_diagnostic_reading_prompt(topic)
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
    return _extract_json(text)
