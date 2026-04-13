"""
Vocabulary Level Test agent.

Generates a 20-question adaptive vocabulary test spanning CEFR levels A2–C2.
After the user answers, estimates their vocabulary level and approximate size.

Question distribution (fixed):
  A2: 2  B1: 4  B2: 6  C1: 5  C2: 3  → 20 total

Each question presents a target word in a gap-fill context sentence and asks
the learner to choose the correct definition from four options (A–D).

Level estimation algorithm (post-submission):
  1. Compute accuracy per CEFR tier.
  2. Find the highest tier where accuracy ≥ 50 %.
  3. Blend upward using partial credit from higher tiers.
  4. Map to an estimated active vocabulary size.
"""

from typing import Optional
from ai import _get_client, MODEL, _extract_json

# ── CEFR constants ─────────────────────────────────────────────────────────────

LEVELS = ["A2", "B1", "B2", "C1", "C2"]

LEVEL_QUESTIONS = {"A2": 2, "B1": 4, "B2": 6, "C1": 5, "C2": 3}  # sums to 20

# Approximate active vocabulary size mid-point for each CEFR band
VOCAB_SIZE = {"A2": 1_500, "B1": 3_500, "B2": 6_500, "C1": 9_500, "C2": 14_000}

# ── Prompt helpers ─────────────────────────────────────────────────────────────

_SYSTEM = """\
You are an expert EFL/IELTS vocabulary test designer.
Your task is to generate vocabulary test items at specified CEFR levels.
Return ONLY valid JSON — no markdown, no prose outside the JSON."""


def _build_generate_prompt(topic: Optional[str]) -> str:
    topic_line = (
        f"Prefer words related to the topic: {topic}."
        if topic
        else "Use a variety of academic, professional, and everyday topics."
    )
    dist = "  ".join(f"{lvl}: {n}" for lvl, n in LEVEL_QUESTIONS.items())
    return f"""\
Generate exactly 20 vocabulary test items for an IELTS/PTE learner.

{topic_line}

CEFR level distribution (must be exact): {dist}

For each item, show the target word in a context sentence with a gap (___)
so the learner sees the word used in context before choosing its meaning.
The four options should be concise definitions (3-7 words each), NOT
paraphrases of the sentence. One option is the correct definition; the other
three are plausible but clearly wrong distractors.

Return a JSON object with this exact schema:

{{
  "questions": [
    {{
      "id": "v1",
      "word": "<target word>",
      "level": "<A2|B1|B2|C1|C2>",
      "sentence": "<sentence using the word naturally, with the word shown — do NOT blank it out>",
      "stem": "What does the word '<word>' mean?",
      "options": ["A. <definition>", "B. <definition>", "C. <definition>", "D. <definition>"],
      "correct_answer": "<A|B|C|D>",
      "explanation": "<one sentence: definition + why it fits the sentence>"
    }}
    // … 20 items total, ids v1–v20, ordered by ascending difficulty
  ]
}}

Rules:
- Words must be real English words suitable for IELTS/PTE Academic.
- No proper nouns, no abbreviations.
- A2 words: common everyday words (e.g. anxious, blame, suggest).
- B1 words: frequent but non-basic (e.g. interpret, significant, enforce).
- B2 words: academic / less common (e.g. ambiguous, incentive, rigorous).
- C1 words: sophisticated academic vocabulary (e.g. nuanced, pragmatic, inherent).
- C2 words: advanced / low-frequency (e.g. esoteric, obfuscate, ephemeral).
- Distractors must be in the same part of speech as the correct definition.
- Do NOT repeat any word across items."""


# ── Agent functions ─────────────────────────────────────────────────────────────

async def generate_vocab_test(topic: Optional[str] = None) -> dict:
    """
    Generate a 20-question vocabulary test session.
    Returns a dict ready to store as session_data.
    """
    client = _get_client()
    prompt = _build_generate_prompt(topic)

    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=5000,
    )

    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from vocab generator")

    data = _extract_json(text)

    # Validate and normalise
    questions = data.get("questions", [])
    if len(questions) < 10:
        raise ValueError(f"Too few questions returned: {len(questions)}")

    # Ensure IDs are unique and sequential
    for i, q in enumerate(questions):
        q["id"] = f"v{i + 1}"

    return {
        "agent_type": "vocab",
        "topic": topic or "General Vocabulary",
        "questions": questions,
    }


# ── Level estimation ───────────────────────────────────────────────────────────

def estimate_level(questions: list[dict], answers: dict[str, str]) -> dict:
    """
    Given the test questions and the user's answers {question_id: "A"|"B"|"C"|"D"},
    compute accuracy per CEFR level and return a level estimate with detail.
    """
    level_stats: dict[str, dict] = {
        lvl: {"correct": 0, "total": 0} for lvl in LEVELS
    }

    item_results = []
    for q in questions:
        qid = q["id"]
        user_ans = answers.get(qid, "")
        correct = q["correct_answer"]
        is_correct = user_ans.strip().upper() == correct.strip().upper()
        lvl = q["level"]
        level_stats[lvl]["total"] += 1
        if is_correct:
            level_stats[lvl]["correct"] += 1

        item_results.append({
            "question_id": qid,
            "word": q["word"],
            "level": lvl,
            "user_answer": user_ans,
            "correct_answer": correct,
            "is_correct": is_correct,
            "sentence": q.get("sentence", ""),
            "explanation": q.get("explanation", ""),
            "options": q.get("options", []),
        })

    # Accuracy per level (None if no questions at that level)
    accuracy: dict[str, Optional[float]] = {}
    for lvl in LEVELS:
        s = level_stats[lvl]
        accuracy[lvl] = s["correct"] / s["total"] if s["total"] > 0 else None

    # Determine estimated CEFR level:
    #   Highest level with accuracy >= 0.50, anchored from the top down.
    estimated_level = "A2"
    for lvl in reversed(LEVELS):
        acc = accuracy[lvl]
        if acc is not None and acc >= 0.50:
            estimated_level = lvl
            break

    # Blend vocabulary size estimate using performance above estimated level
    base_size = VOCAB_SIZE[estimated_level]
    next_idx = LEVELS.index(estimated_level) + 1
    if next_idx < len(LEVELS):
        next_lvl = LEVELS[next_idx]
        upper_size = VOCAB_SIZE[next_lvl]
        upper_acc = accuracy[next_lvl] or 0.0
        # Partial credit: if user got 30 % at the next level, add 30 % of the gap
        gap = upper_size - base_size
        estimated_vocab_size = int(base_size + gap * min(upper_acc, 0.49))
    else:
        estimated_vocab_size = base_size + int((answers and 1 or 0) * 1000)

    total_correct = sum(r["is_correct"] for r in item_results)
    total_qs = len(item_results)
    percentage = round(total_correct / total_qs * 100, 1) if total_qs else 0.0

    level_breakdown = [
        {
            "level": lvl,
            "correct": level_stats[lvl]["correct"],
            "total": level_stats[lvl]["total"],
            "accuracy": round(accuracy[lvl] * 100, 1) if accuracy[lvl] is not None else None,
        }
        for lvl in LEVELS
    ]

    return {
        "estimated_level": estimated_level,
        "estimated_vocab_size": estimated_vocab_size,
        "total_correct": total_correct,
        "total_questions": total_qs,
        "percentage": percentage,
        "level_breakdown": level_breakdown,
        "item_results": item_results,
    }
