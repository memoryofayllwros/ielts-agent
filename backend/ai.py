import json
import re
import anthropic
from typing import Optional

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are an expert PTE Academic test creator specializing in reading comprehension.
Generate authentic, exam-quality PTE Academic reading practice sessions.
Always return valid JSON exactly matching the schema described in the user message."""

GENERATION_SCHEMA = {
    "type": "object",
    "properties": {
        "passage": {
            "type": "string"
        },
        "topic": {
            "type": "string"
        },
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["fill_in_blanks", "mc_single", "mc_multiple"]
                    },
                    "passage_with_blanks": {
                        "anyOf": [{"type": "string"}, {"type": "null"}]
                    },
                    "word_bank": {
                        "anyOf": [
                            {"type": "array", "items": {"type": "string"}},
                            {"type": "null"}
                        ]
                    },
                    "question": {
                        "anyOf": [{"type": "string"}, {"type": "null"}]
                    },
                    "options": {
                        "anyOf": [
                            {"type": "array", "items": {"type": "string"}},
                            {"type": "null"}
                        ]
                    },
                    "correct_answers": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "explanation": {"type": "string"}
                },
                "required": [
                    "id", "type", "passage_with_blanks", "word_bank",
                    "question", "options", "correct_answers", "explanation"
                ],
                "additionalProperties": False
            }
        }
    },
    "required": ["passage", "topic", "questions"],
    "additionalProperties": False
}


def build_prompt(topic: Optional[str]) -> str:
    topic_line = f"Topic: {topic}" if topic else "Choose an interesting academic topic (science, environment, technology, history, economics, linguistics, etc.)"
    return f"""Create a PTE Academic Reading practice session.

{topic_line}

Generate a JSON object with:

1. "passage": A 150–200 word academic-style passage on the topic. Use formal language appropriate for PTE Academic.

2. "topic": Short topic name (2-4 words).

3. "questions": An array of exactly 3 questions — one of each type:

   TYPE 1 — fill_in_blanks:
   - "id": "q1"
   - "type": "fill_in_blanks"
   - "passage_with_blanks": Copy the passage but replace 3 key content words with markers [1], [2], [3]
   - "word_bank": Array of 7–8 words: the 3 correct words + 4–5 plausible distractors, shuffled
   - "question": null
   - "options": null
   - "correct_answers": ["word_for_1", "word_for_2", "word_for_3"] in order
   - "explanation": Brief explanation of why each blank has that answer

   TYPE 2 — mc_single (one correct answer):
   - "id": "q2"
   - "type": "mc_single"
   - "passage_with_blanks": null
   - "word_bank": null
   - "question": A comprehension question about the passage
   - "options": ["A. option text", "B. option text", "C. option text", "D. option text"]
   - "correct_answers": ["A"] (just the letter of the correct option)
   - "explanation": Why this answer is correct and the others are wrong

   TYPE 3 — mc_multiple (two correct answers):
   - "id": "q3"
   - "type": "mc_multiple"
   - "passage_with_blanks": null
   - "word_bank": null
   - "question": A question asking to identify TWO correct statements or facts
   - "options": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."]
   - "correct_answers": ["B", "D"] (letters of the two correct options)
   - "explanation": Why these two answers are correct

Return ONLY the JSON object, no other text."""


def _extract_json(text: str) -> dict:
    """Extract JSON from Claude's response text."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block
    match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
    if match:
        return json.loads(match.group(1))

    # Find first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return json.loads(text[start:end + 1])

    raise ValueError("No valid JSON found in response")


async def generate_practice_session(topic: Optional[str] = None) -> dict:
    """Generate a PTE reading practice session using Claude."""
    prompt = build_prompt(topic)

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4000,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": GENERATION_SCHEMA
            }
        }
    ) as stream:
        final = stream.get_final_message()

    text = next(
        (block.text for block in final.content if block.type == "text"),
        None
    )
    if not text:
        raise ValueError("No text content in Claude response")

    return _extract_json(text)
