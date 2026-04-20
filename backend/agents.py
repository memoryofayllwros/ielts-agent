"""
Multi-agent orchestration for IELTS / PTE practice.

Flow:
  User message
      │
  SupervisorAgent  (tool_use routing)
      ├── invoke_reading_agent  ──►  ReadingAgent
      ├── invoke_writing_agent  ──►  WritingAgent
      │                                 ├── summarize_written_text  (IELTS Writing Task 1 Academic)
      │                                 └── write_essay  (IELTS Writing Task 2)
      └── invoke_vocab_agent    ──►  VocabAgent  (20-question CEFR level test A2–C2)

Each agent is a pure async function.  The supervisor uses tool_use to decide
which sub-agent to call; the sub-agent then calls the model again to generate
the actual practice content as JSON.
"""

import asyncio
import json
import os
from statistics import median
from typing import Optional

from ai import _get_client, MODEL, _extract_json


def _eval_judge_count() -> int:
    """Multi-judge evaluation size; set EVAL_JUDGE_COUNT=1 to use a single judge (lower cost)."""
    try:
        n = int(os.environ.get("EVAL_JUDGE_COUNT", "3"))
    except ValueError:
        n = 3
    return max(1, min(n, 5))


_BAND_ORDER = ["Poor", "Needs Improvement", "Satisfactory", "Good", "Excellent"]


def _band_to_rank(label: str) -> int:
    label = (label or "").strip().lower()
    for i, b in enumerate(_BAND_ORDER):
        if b.lower() == label:
            return i
    return 2


def _rank_to_band(rank: float) -> str:
    idx = int(round(rank))
    idx = max(0, min(len(_BAND_ORDER) - 1, idx))
    return _BAND_ORDER[idx]


def _median_int(values: list[int]) -> int:
    if not values:
        return 0
    return int(round(median(values)))


_WRITING_JUDGE_EXTRAS = [
    "\nYou are Judge A: apply the rubric strictly against the stated descriptors.",
    "\nYou are Judge B: when uncertain, prefer the middle of the allowed score range for that category.",
    "\nYou are Judge C: give extra weight to argument development and coherence when scores are borderline.",
    "\nYou are Judge D: balance all four criteria equally before assigning each category score.",
    "\nYou are Judge E: calibrate against what a typical IELTS classroom examiner would award.",
]

_SPEAKING_JUDGE_EXTRAS = [
    "\nYou are Judge A: apply the rubric strictly; note transcript limitations explicitly if relevant.",
    "\nYou are Judge B: when uncertain, prefer middle scores for each category.",
    "\nYou are Judge C: weight Fluency & Coherence heavily when resolving borderline totals.",
    "\nYou are Judge D: balance all four criteria equally.",
    "\nYou are Judge E: be conservative on pronunciation (inferred) scores when the transcript is noisy.",
]


def _criteria_list(task: dict, skill: str) -> list[dict]:
    if skill == "speaking":
        return list(task.get("assessment_criteria") or [])
    return list(task.get("scoring_criteria") or [])


def _recompute_eval_totals(result: dict) -> dict:
    cats = result.get("category_scores") or []
    total = sum(c.get("score", 0) for c in cats)
    max_total = sum(c.get("max_score", 0) for c in cats)
    if max_total > 0:
        result = {**result, "total_score": total, "max_score": max_total, "percentage": round(total / max_total * 100, 1)}
    return result


def _feedback_for_category(evaluation: dict, category_name: str) -> str:
    want = category_name.strip().lower()
    for c in evaluation.get("category_scores") or []:
        if (c.get("category") or "").strip().lower() == want:
            return (c.get("feedback") or "").strip()
    return ""


def _aggregate_evaluations(
    evaluations: list[dict],
    task: dict,
    *,
    skill: str,
    excerpt_key: str,
) -> dict:
    """
    Merge multiple judge JSON evaluations: median per category score and per rubric band;
    narrative fields taken from the judge whose total is closest to the median total (anchor).
    """
    criteria = _criteria_list(task, skill)
    normalized = [_recompute_eval_totals(dict(e)) for e in evaluations]
    median_total = median(e["total_score"] for e in normalized)
    anchor_idx = min(
        range(len(normalized)),
        key=lambda i: abs(normalized[i]["total_score"] - median_total),
    )
    anchor = normalized[anchor_idx]

    merged_categories: list[dict] = []
    for crit in criteria:
        name = crit["category"]
        max_s = int(crit["max_score"])
        scores: list[int] = []
        for ev in normalized:
            for c in ev.get("category_scores") or []:
                if (c.get("category") or "").strip().lower() == name.strip().lower():
                    scores.append(int(c.get("score", 0)))
                    break
        med_score = _median_int(scores) if scores else 0
        med_score = max(0, min(max_s, med_score))
        fb = _feedback_for_category(anchor, name) or "See overall feedback."
        merged_categories.append(
            {"category": name, "score": med_score, "max_score": max_s, "feedback": fb}
        )

    out = {
        **anchor,
        "category_scores": merged_categories,
        "band": _rank_to_band(median(_band_to_rank(e.get("band", "")) for e in normalized)),
        "overall_feedback": anchor.get("overall_feedback", ""),
        "strengths": list(anchor.get("strengths") or []),
        "improvements": list(anchor.get("improvements") or []),
    }
    excerpt = anchor.get(excerpt_key)
    if excerpt is not None:
        out[excerpt_key] = excerpt

    return _recompute_eval_totals(out)


# ── Supervisor ────────────────────────────────────────────────────────────────

SUPERVISOR_SYSTEM = """\
You are an IELTS practice supervisor. Your ONLY job is to analyse the \
user's request and call the appropriate tool.

Call invoke_reading_agent when the user wants:
  • Reading comprehension practice
  • Fill-in-the-blanks or multiple-choice questions
  • A passage to read and answer questions about
  • Any general "practice" request with no clear writing intent

Call invoke_writing_agent when the user wants:
  • IELTS Writing Task 2 essay practice
  • IELTS Writing Task 1 (describe charts, tables, processes, maps)
  • Summarising or describing data in writing
  • Writing feedback or a writing task
  • Any request that involves the user producing written output

Call invoke_vocab_agent when the user wants:
  • A vocabulary test or quiz
  • To find out their vocabulary level or CEFR level
  • To check how many words they know
  • Any request mentioning "vocab", "vocabulary", "word level", or "word test"

Always call exactly one tool. Never respond with plain text."""

SUPERVISOR_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "invoke_reading_agent",
            "description": (
                "Route to the IELTS Academic Reading practice agent. "
                "Generates a passage with fill-in-blanks and multiple-choice questions."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Optional topic hint (e.g. 'climate change', 'AI'). "
                                       "Omit if the user didn't specify one.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_writing_agent",
            "description": (
                "Route to the IELTS Writing practice agent. "
                "Generates either a Task 2 essay prompt or a Task 1 Academic report task."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Optional topic hint. Omit if not specified.",
                    },
                    "task_type": {
                        "type": "string",
                        "enum": ["write_essay", "summarize_written_text"],
                        "description": (
                            "write_essay: IELTS Writing Task 2 — at least 250 words, discursive/argumentative. "
                            "summarize_written_text: IELTS Writing Task 1 Academic — describe visual information "
                            "given as text (150+ words). "
                            "Default to write_essay when the user doesn't specify."
                        ),
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "invoke_vocab_agent",
            "description": (
                "Route to the Vocabulary Level Test agent. "
                "Generates a 20-question CEFR-levelled vocabulary test (A2–C2) "
                "and estimates the learner's vocabulary level and size after completion."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Optional topic for vocabulary focus (e.g. 'technology', 'environment'). "
                                       "Omit for a general mixed-topic test.",
                    }
                },
                "required": [],
            },
        },
    },
]


async def supervisor_agent(user_message: str) -> dict:
    """
    Analyses the user's request and routes to the appropriate sub-agent.
    Returns the sub-agent's output with an extra 'agent_type' key added.
    """
    client = _get_client()

    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SUPERVISOR_SYSTEM},
            {"role": "user", "content": user_message},
        ],
        tools=SUPERVISOR_TOOLS,
        tool_choice="required",
        max_tokens=512,
    )

    msg = response.choices[0].message

    if msg.tool_calls:
        call = msg.tool_calls[0]
        try:
            args = json.loads(call.function.arguments or "{}")
        except json.JSONDecodeError:
            args = {}

        if call.function.name == "invoke_reading_agent":
            result = await reading_agent(args.get("topic"))
            result["agent_type"] = "reading"
            return result

        if call.function.name == "invoke_writing_agent":
            result = await writing_agent(
                args.get("topic"),
                args.get("task_type", "write_essay"),
            )
            result["agent_type"] = "writing"
            return result

        if call.function.name == "invoke_vocab_agent":
            from vocab_agent import generate_vocab_test
            result = await generate_vocab_test(args.get("topic"))
            result["agent_type"] = "vocab"
            return result

    # Fallback: default to reading if tool_choice was somehow ignored
    result = await reading_agent(None)
    result["agent_type"] = "reading"
    return result


# ── Reading agent ─────────────────────────────────────────────────────────────

async def reading_agent(topic: Optional[str], learner_band: Optional[float] = None) -> dict:
    """
    Wraps the existing reading-session generator.
    Returns the same schema as generate_practice_session().
    """
    from ai import generate_practice_session
    return await generate_practice_session(topic, learner_band=learner_band)


# ── Writing agent ─────────────────────────────────────────────────────────────

_WRITING_SYSTEM = """\
You are an expert IELTS test creator specialising in writing tasks.
Generate authentic, exam-quality IELTS Academic writing practice sessions.
Always return valid JSON exactly matching the schema in the user message.
Inside every JSON string value, escape double quotes as \\" and newlines as \\n so the output is valid JSON.
Return ONLY the raw JSON object — no markdown fences, no explanation."""


def _build_writing_prompt(
    topic: Optional[str],
    task_type: str,
    learner_band: Optional[float] = None,
    diagnostic: bool = False,
) -> str:
    topic_line = (
        f"Topic: {topic}"
        if topic
        else "Choose an interesting academic topic (technology, environment, society, education, health, etc.)"
    )
    level_line = ""
    if learner_band is not None:
        level_line = (
            f"\nLearner baseline (approximate band): ~{learner_band:.1f}. "
            "Match task difficulty and model answer style to this level.\n"
        )

    if task_type == "summarize_written_text":
        return f"""\
Create an IELTS Writing Task 1 Academic practice task.

{topic_line}{level_line}

The "passage" field must be a clear written description of data as if describing a chart, table, bar graph, line graph, pie chart, process diagram, or map (no image — only text). The student will write a formal report summarising the information.

Return a JSON object with exactly these fields:

{{
  "task_type": "summarize_written_text",
  "topic": "<2-4 word topic name>",
  "instruction": "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  "passage": "<180-230 words: neutral description of trends, key figures, comparisons, and stages — suitable for Task 1>",
  "word_limit": {{"min": 150, "max": 200}},
  "time_limit_minutes": 20,
  "scoring_criteria": [
    {{"category": "Task Achievement", "max_score": 3, "descriptor": "Covers key features; accurate overview; clear selection of information"}},
    {{"category": "Coherence & Cohesion", "max_score": 2, "descriptor": "Logical organisation; clear progression; referencing and linking"}},
    {{"category": "Lexical Resource", "max_score": 2, "descriptor": "Range and accuracy of vocabulary; appropriate to task"}},
    {{"category": "Grammatical Range & Accuracy", "max_score": 2, "descriptor": "Variety of structures; error-free sentences where possible"}}
  ],
  "model_answer": "<example report, about 160-180 words, Band 8-9 style>"
}}"""

    # write_essay — IELTS Writing Task 2
    diag_note = ""
    word_limit = {"min": 250, "max": 320}
    time_mins = 40
    instruction = (
        "Write at least 250 words. Give reasons for your answer and include relevant examples "
        "from your knowledge or experience. You have 40 minutes."
    )
    if diagnostic:
        diag_note = (
            "\nThis is a **diagnostic** Task 2: keep the prompt clear and standard; the student may write "
            "a shorter answer (minimum 150 words) for time reasons, but the task remains Task 2 style.\n"
        )
        word_limit = {"min": 150, "max": 300}
        time_mins = 25
        instruction = (
            "Write at least 150 words (diagnostic). Give reasons and examples where you can. "
            "You have about 25 minutes."
        )

    return f"""\
Create an IELTS Writing Task 2 practice task.

{topic_line}{level_line}{diag_note}

Return a JSON object with exactly these fields:

{{
  "task_type": "write_essay",
  "topic": "<2-4 word topic name>",
  "prompt": "<clear IELTS Task 2 question — opinion, discussion, problem/solution, or two-part question, 1-2 sentences>",
  "instruction": {json.dumps(instruction)},
  "word_limit": {json.dumps(word_limit)},
  "time_limit_minutes": {time_mins},
  "outline": [
    "Introduction: paraphrase the question and state your position or scope",
    "Body paragraph 1: main idea with explanation and example",
    "Body paragraph 2: further development or alternative perspective",
    "Conclusion: summarise and reinforce your view"
  ],
  "scoring_criteria": [
    {{"category": "Task Response", "max_score": 3, "descriptor": "Fully addresses all parts of the task; clear position throughout"}},
    {{"category": "Coherence & Cohesion", "max_score": 2, "descriptor": "Logical progression; clear paragraphs; cohesive devices"}},
    {{"category": "Lexical Resource", "max_score": 2, "descriptor": "Flexible use of vocabulary; precision and collocations"}},
    {{"category": "Grammatical Range & Accuracy", "max_score": 2, "descriptor": "Mix of complex structures; predominantly error-free"}}
  ],
  "model_answer": "<a well-written model essay, about 260-280 words, Band 8-9 style>"
}}"""


async def writing_agent(
    topic: Optional[str],
    task_type: str = "write_essay",
    learner_band: Optional[float] = None,
    diagnostic: bool = False,
) -> dict:
    """
    Generates an IELTS writing practice task (Task 1 report or Task 2 essay).
    Returns a dict with agent_type, task_type, topic, prompt/passage, scoring criteria, etc.
    """
    client = _get_client()
    prompt = _build_writing_prompt(topic, task_type, learner_band=learner_band, diagnostic=diagnostic)

    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _WRITING_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=3000,
    )

    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from writing agent")

    return _extract_json(text)


# ── Writing evaluator ─────────────────────────────────────────────────────────

_EVAL_SYSTEM = """\
You are an expert IELTS writing examiner.
Evaluate the user's response strictly according to IELTS Task 1 / Task 2 band descriptors.
Return ONLY a valid JSON object — no markdown, no explanation outside the JSON."""


def _build_eval_prompt(task: dict, user_text: str) -> str:
    criteria_text = "\n".join(
        f"  - {c['category']} (max {c['max_score']}): {c['descriptor']}"
        for c in task.get("scoring_criteria", [])
    )

    task_context = ""
    if task.get("task_type") == "summarize_written_text":
        task_context = f"TASK 1 DATA DESCRIPTION (text):\n{task.get('passage', '')}\n\n"
        task_context += "TASK: Write at least 150 words summarising the information; select main features and make comparisons."
    else:
        task_context = f"TASK 2 QUESTION:\n{task.get('prompt', '')}\n\n"
        task_context += "TASK: Write at least 250 words with reasons and examples."

    total_max = sum(c["max_score"] for c in task.get("scoring_criteria", []))

    return f"""\
Evaluate the following IELTS writing response.

{task_context}

SCORING CRITERIA:
{criteria_text}

STUDENT'S RESPONSE:
{user_text}

Return a JSON object with exactly these fields:
{{
  "total_score": <integer sum of category scores>,
  "max_score": {total_max},
  "percentage": <float 0-100, one decimal>,
  "band": "<Excellent | Good | Satisfactory | Needs Improvement | Poor>",
  "overall_feedback": "<2-3 sentence overall assessment>",
  "category_scores": [
    {{
      "category": "<name>",
      "score": <integer>,
      "max_score": <integer>,
      "feedback": "<specific one-sentence feedback for this category>"
    }}
    // one entry per scoring criterion
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "revised_excerpt": "<rewrite the weakest 1-2 sentences from the student's response to show improvement>"
}}"""


async def _writing_judge_once(client, system: str, user_prompt: str) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=2000,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from writing evaluator")
    return _recompute_eval_totals(_extract_json(text))


async def evaluate_writing(task: dict, user_text: str) -> dict:
    """
    Evaluates a student's writing response against the task's scoring criteria.
    Uses a multi-judge pool (median per category, median rubric band) when EVAL_JUDGE_COUNT > 1.
    """
    client = _get_client()
    prompt = _build_eval_prompt(task, user_text)
    n = _eval_judge_count()

    if n == 1:
        return await _writing_judge_once(client, _EVAL_SYSTEM, prompt)

    extras = _WRITING_JUDGE_EXTRAS[:n]
    results = await asyncio.gather(
        *(_writing_judge_once(client, _EVAL_SYSTEM + ex, prompt) for ex in extras),
        return_exceptions=True,
    )
    ok = [r for r in results if isinstance(r, dict)]
    if not ok:
        for r in results:
            if isinstance(r, BaseException):
                raise r
        raise ValueError("All writing evaluators failed")

    return _aggregate_evaluations(ok, task, skill="writing", excerpt_key="revised_excerpt")


# ── Listening agent ───────────────────────────────────────────────────────────

_LISTENING_SYSTEM = """\
You are an expert IELTS Listening test creator.
Generate authentic practice: a script the student would hear (monologue or dialogue with speaker labels),
plus comprehension questions in the same JSON shapes as IELTS reading-style items.
Always return valid JSON exactly matching the schema in the user message.
Inside every JSON string value (especially "transcript" and "passage_with_blanks"), escape double quotes as \\"
and newlines as \\n so the output is valid JSON. Do not use raw line breaks inside a JSON string.
Return ONLY the raw JSON object — no markdown fences, no explanation."""


def _build_listening_prompt(
    topic: Optional[str],
    learner_band: Optional[float] = None,
    diagnostic: bool = False,
) -> str:
    topic_line = (
        f"Topic: {topic}"
        if topic
        else "Choose an everyday or academic listening context (campus, travel, interview, lecture excerpt, etc.)"
    )
    level_line = ""
    if learner_band is not None:
        level_line = (
            f"\nLearner baseline (approximate band): ~{learner_band:.1f}. "
            "Match transcript speed/density and question difficulty to this level.\n"
        )

    if diagnostic:
        return f"""\
Create a SHORT baseline diagnostic IELTS Listening mini-test (script only — audio may be synthesised separately).

{topic_line}{level_line}

The "transcript" field must be 90–130 words, natural speech, with lines like "A: ..." / "B: ..." or a single speaker.
Include exactly **5** items in "questions" (ids q1–q5). Mix: at least one fill_in_blanks, at least one mc_single,
at least one mc_multiple (two correct letters). Remaining items among those types. Questions must test what was heard.

Return a JSON object with exactly these fields:

{{
  "transcript": "<full script to be read aloud>",
  "topic": "<2-4 word topic name>",
  "questions": [
    // exactly 5 question objects, ids q1 through q5, same shape as standard listening (fill_in_blanks, mc_single, mc_multiple)
  ]
}}"""

    return f"""\
Create an IELTS Listening practice session (script only — audio may be synthesised separately).

{topic_line}{level_line}

The "transcript" field must be 180-260 words, natural speech, with lines like "A: ..." and "B: ..." for dialogues
or a single speaker for monologues. Questions test what was heard (not prior knowledge).

Return a JSON object with exactly these fields:

{{
  "transcript": "<full script to be read aloud>",
  "topic": "<2-4 word topic name>",
  "questions": [
    {{
      "id": "q1",
      "type": "fill_in_blanks",
      "passage_with_blanks": "<summary of what was heard with 3 words replaced by [BLANK_1], [BLANK_2], [BLANK_3]>",
      "word_bank": ["<7-8 words: 3 correct + distractors, shuffled>"],
      "question": null,
      "options": null,
      "correct_answers": ["<word for BLANK_1>", "<word for BLANK_2>", "<word for BLANK_3>"],
      "explanation": "<why each blank matches the audio>"
    }},
    {{
      "id": "q2",
      "type": "mc_single",
      "passage_with_blanks": null,
      "word_bank": null,
      "question": "<question about specific information from the audio>",
      "options": ["A. <text>", "B. <text>", "C. <text>", "D. <text>"],
      "correct_answers": ["<letter>"],
      "explanation": "<brief explanation>"
    }},
    {{
      "id": "q3",
      "type": "mc_multiple",
      "passage_with_blanks": null,
      "word_bank": null,
      "question": "<identify TWO correct statements based on the audio>",
      "options": ["A. <text>", "B. <text>", "C. <text>", "D. <text>", "E. <text>"],
      "correct_answers": ["<letter>", "<letter>"],
      "explanation": "<brief explanation>"
    }}
  ]
}}"""


async def listening_agent(
    topic: Optional[str],
    learner_band: Optional[float] = None,
    diagnostic: bool = False,
) -> dict:
    client = _get_client()
    prompt = _build_listening_prompt(topic, learner_band=learner_band, diagnostic=diagnostic)
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _LISTENING_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=8192,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from listening agent")
    data = _extract_json(text)
    data["passage"] = data.get("transcript", "")
    return data


# ── Speaking agent ────────────────────────────────────────────────────────────

_SPEAKING_SYSTEM = """\
You are an expert IELTS Speaking examiner and test designer.
Generate Part 2 cue-card style practice with clear timing and assessment criteria.
Return ONLY valid JSON — no markdown, no explanation outside the JSON."""


def _build_speaking_prompt(topic: Optional[str], learner_band: Optional[float] = None) -> str:
    topic_line = (
        f"Theme hint: {topic}"
        if topic
        else "Choose a common IELTS Part 2 theme (person, place, object, event, experience)."
    )
    level_line = ""
    if learner_band is not None:
        level_line = (
            f"\nLearner baseline (approximate band): ~{learner_band:.1f}. "
            "Pitch cue difficulty and vocabulary to this level.\n"
        )
    return f"""\
Create an IELTS Speaking Part 2 practice task.

{topic_line}{level_line}

Return a JSON object with exactly these fields:
{{
  "part": 2,
  "topic": "<short topic label>",
  "prompt": "<main cue: Describe ... You should say:>",
  "bullet_points": ["<point 1>", "<point 2>", "<point 3>", "<point 4>"],
  "prep_seconds": 60,
  "speak_seconds": 120,
  "follow_up_questions": ["<Part 3 style question 1>", "<question 2>"],
  "model_outline": ["<key idea 1 for a strong answer>", "<key idea 2>", "<key idea 3>"],
  "assessment_criteria": [
    {{"category": "Fluency & Coherence", "max_score": 3, "descriptor": "Natural pace; coherence; hesitation"}},
    {{"category": "Lexical Resource", "max_score": 2, "descriptor": "Range and precision of vocabulary"}},
    {{"category": "Grammatical Range & Accuracy", "max_score": 2, "descriptor": "Variety and control of structures"}},
    {{"category": "Pronunciation (inferred from transcript only)", "max_score": 2, "descriptor": "Approximate from text: clarity of word forms and chunking cues"}}
  ]
}}"""


async def speaking_agent(topic: Optional[str], learner_band: Optional[float] = None) -> dict:
    client = _get_client()
    prompt = _build_speaking_prompt(topic, learner_band=learner_band)
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _SPEAKING_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=2500,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from speaking agent")
    return _extract_json(text)


# ── Speaking evaluator ────────────────────────────────────────────────────────

_SPEAK_EVAL_SYSTEM = """\
You are an expert IELTS Speaking examiner.
The student's answer is provided as TEXT ONLY (from speech-to-text). Scores for pronunciation are approximate
and must be labelled as inferred from the transcript — do not claim you heard audio.
Return ONLY valid JSON — no markdown."""


def _build_speak_eval_prompt(task: dict, transcript: str) -> str:
    criteria_text = "\n".join(
        f"  - {c['category']} (max {c['max_score']}): {c['descriptor']}"
        for c in task.get("assessment_criteria", [])
    )
    total_max = sum(c["max_score"] for c in task.get("assessment_criteria", []))
    bullets = "\n".join(f"  - {b}" for b in task.get("bullet_points", []))
    return f"""\
Evaluate this IELTS Speaking Part 2 response (transcript from speech recognition; may contain errors).

CUE CARD:
Topic: {task.get('topic', '')}
{task.get('prompt', '')}
You should say:
{bullets}

STUDENT TRANSCRIPT (may be imperfect):
{transcript}

CRITERIA:
{criteria_text}

Return a JSON object with exactly these fields:
{{
  "total_score": <integer>,
  "max_score": {total_max},
  "percentage": <float 0-100 one decimal>,
  "band": "<Excellent | Good | Satisfactory | Needs Improvement | Poor>",
  "overall_feedback": "<2-3 sentences; note if limited by transcript quality>",
  "category_scores": [
    {{"category": "<name>", "score": <int>, "max_score": <int>, "feedback": "<one sentence>"}}
  ],
  "strengths": ["<s1>", "<s2>"],
  "improvements": ["<i1>", "<i2>", "<i3>"],
  "better_answer_snippet": "<example improved 2-3 sentences on-topic>"
}}"""


async def _speaking_judge_once(client, system: str, user_prompt: str) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=2000,
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("Empty response from speaking evaluator")
    return _recompute_eval_totals(_extract_json(text))


async def evaluate_speaking(task: dict, transcript: str) -> dict:
    """
    Evaluates a speaking transcript; multi-judge median aggregation when EVAL_JUDGE_COUNT > 1.
    """
    client = _get_client()
    prompt = _build_speak_eval_prompt(task, transcript)
    n = _eval_judge_count()

    if n == 1:
        return await _speaking_judge_once(client, _SPEAK_EVAL_SYSTEM, prompt)

    extras = _SPEAKING_JUDGE_EXTRAS[:n]
    results = await asyncio.gather(
        *(_speaking_judge_once(client, _SPEAK_EVAL_SYSTEM + ex, prompt) for ex in extras),
        return_exceptions=True,
    )
    ok = [r for r in results if isinstance(r, dict)]
    if not ok:
        for r in results:
            if isinstance(r, BaseException):
                raise r
        raise ValueError("All speaking evaluators failed")

    return _aggregate_evaluations(ok, task, skill="speaking", excerpt_key="better_answer_snippet")
