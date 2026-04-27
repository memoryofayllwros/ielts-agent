"""LLM: structured lesson packages (slides + narration + rich content) by lesson_kind."""
from __future__ import annotations

import json
from typing import Any, Optional

import json_repair

from ai import MODEL, _get_client
from skills_taxonomy import get_skill_label, get_skill_meta

# Extra system hints keyed by speaking cluster prefix (S1..S4) or "default"
WEAKNESS_TEMPLATE_HINTS: dict[str, str] = {
    "S1": "Prioritise fluency: natural pacing, fillers to reduce, linking phrases for coherence.",
    "S2": "Prioritise pronunciation: stress patterns, chunking, clear intonation on key words.",
    "S3": "Prioritise lexical resource: collocations, less common vocabulary, paraphrase of simple ideas.",
    "S4": "Prioritise grammar: complex sentences, tense consistency, subordination without errors.",
    "default": "Keep exam-focused, concise, and actionable for independent learners.",
}


def _template_hint_for_skill(skill_id: str) -> str:
    if len(skill_id) >= 2 and skill_id[0] in "Ss" and skill_id[1].isdigit():
        key = f"S{skill_id[1]}"
        return WEAKNESS_TEMPLATE_HINTS.get(key, WEAKNESS_TEMPLATE_HINTS["default"])
    return WEAKNESS_TEMPLATE_HINTS["default"]


_SYSTEM_BASE = """You are an expert IELTS tutor. You create structured micro-lessons for short video segments.
Return ONLY a raw JSON object — no markdown fences, no commentary before or after the JSON."""


async def generate_lesson_package(
    skill_id: str,
    *,
    module: str,
    learner_band: Optional[float] = None,
    lesson_kind: str = "skill_explainer",
    curriculum: Optional[dict[str, Any]] = None,
    weakness_vector: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """
    Returns dict with: title, slides, narration, content (rich fields), evaluation_hook, lesson_kind.
    """
    meta = get_skill_meta(skill_id)
    label = meta.get("label") or get_skill_label(skill_id)
    desc = (meta.get("description") or "").strip()
    curr = curriculum or {}
    topic = str(curr.get("topic") or "general")
    scenario = str(curr.get("scenario") or "everyday")
    difficulty = str(curr.get("difficulty") or "band6")
    band_line = ""
    if learner_band is not None:
        band_line = f"\nLearner approximate overall band: {learner_band:.1f}. Match depth to this level.\n"
    wv_line = ""
    if weakness_vector:
        wv_line = f"\nWeakness vector (higher = needs work): {json.dumps(weakness_vector, ensure_ascii=False)[:400]}\n"

    template_hint = _template_hint_for_skill(skill_id)

    if lesson_kind in ("speaking_scenario", "listening_to_speaking"):
        user = _prompt_speaking_style(
            module=module,
            skill_id=skill_id,
            label=label,
            desc=desc,
            band_line=band_line,
            wv_line=wv_line,
            template_hint=template_hint,
            topic=topic,
            scenario=scenario,
            difficulty=difficulty,
            with_roleplay=lesson_kind == "listening_to_speaking",
        )
    elif lesson_kind == "listening_context":
        user = _prompt_listening_style(
            module=module,
            skill_id=skill_id,
            label=label,
            desc=desc,
            band_line=band_line,
            topic=topic,
            scenario=scenario,
            difficulty=difficulty,
        )
    else:
        user = _prompt_explainer_style(
            module=module,
            skill_id=skill_id,
            label=label,
            desc=desc,
            band_line=band_line,
            wv_line=wv_line,
            template_hint=template_hint,
        )

    client = _get_client()
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_BASE},
            {"role": "user", "content": user},
        ],
        temperature=0.55,
        max_tokens=4096,
    )
    raw = (resp.choices[0].message.content or "").strip()
    if not raw:
        raise RuntimeError("Empty LLM response for lesson")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = json_repair.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("Lesson JSON is not an object")
    return _normalise_package(data, label, skill_id, lesson_kind)


def _prompt_explainer_style(
    *,
    module: str,
    skill_id: str,
    label: str,
    desc: str,
    band_line: str,
    wv_line: str,
    template_hint: str,
) -> str:
    return f"""Create a micro-lesson for IELTS {module.title()} focused on this skill:

Skill id: {skill_id}
Skill name: {label}
Skill description: {desc}
{band_line}{wv_line}
Teaching focus hint: {template_hint}

Rules:
- 4 to 7 slides. Each slide has "heading" (short) and "bullets" (2-4 strings, concise).
- One field "narration": a SINGLE continuous script for voiceover (plain text, no stage directions).
- Narration should flow when read aloud (about 250–450 words).
- Field "title": catchy lesson title.

Also include extended fields for the lesson player:
- "model_answer": object with "text" (one short Band-7 style example sentence or two tied to the skill).
- "highlighted_phrases": array of 3-6 useful phrases from the model answer.
- "explanation": one short paragraph tying bullets to the exam.
- "practice_prompt": one instruction line for the learner to try aloud.
- "listening_dialogue": [] (empty for non-listening explainer).
- "comprehension_questions": [] (empty).
- "roleplay_prompt": "" (empty).
- "video_scene_description": one sentence describing B-roll for a short educational clip (no faces of celebrities).

JSON shape (exact keys):
{{
  "title": "...",
  "slides": [{{ "heading": "...", "bullets": ["...", "..."] }}],
  "narration": "...",
  "model_answer": {{ "text": "..." }},
  "highlighted_phrases": ["..."],
  "explanation": "...",
  "practice_prompt": "...",
  "listening_dialogue": [],
  "comprehension_questions": [],
  "roleplay_prompt": "",
  "video_scene_description": "..."
}}
"""


def _prompt_speaking_style(
    *,
    module: str,
    skill_id: str,
    label: str,
    desc: str,
    band_line: str,
    wv_line: str,
    template_hint: str,
    topic: str,
    scenario: str,
    difficulty: str,
    with_roleplay: bool,
) -> str:
    roleplay_line = ""
    if with_roleplay:
        roleplay_line = (
            '- "roleplay_prompt": after watching, learner plays ONE role in the dialogue; '
            "state role and first line they should respond to.\n"
            '- "comprehension_questions": 1-2 short questions with "id", "question", "answer_hint".\n'
        )
    else:
        roleplay_line = (
            '- "comprehension_questions": optional 1 short question with "id", "question", "answer_hint".\n'
            '- "roleplay_prompt": optional short follow-up speaking cue (can be empty string).\n'
        )
    return f"""Create a **speaking scenario** micro-lesson for IELTS {module.title()}.

Skill id: {skill_id}
Skill name: {label}
Skill description: {desc}
Curriculum topic id: {topic}
Curriculum scenario id: {scenario}
Target difficulty label: {difficulty}
{band_line}{wv_line}
Teaching focus: {template_hint}

Rules:
- 4-6 slides with "heading" and "bullets" as in a coaching deck.
- "narration": 220-400 words, natural tutor voice, references the scenario.
- "title": catchy title mentioning the scenario.
- "model_answer": {{"text": "..."}} — Band 7-8 style Part 2 / monologue snippet fitting the scenario (not the skill id text).
- "highlighted_phrases": collocations / chunks from the model answer.
- "explanation": short paragraph mapping weak areas to better phrasing.
- "practice_prompt": clear instruction for 60s practice.
- "listening_dialogue": array of 4-8 turns {{ "speaker": "A"|"B", "line": "..."}} matching the scenario (British English).
- "video_scene_description": vivid one-paragraph brief for B-roll of the setting (documentary tone, no celebrity faces).
{roleplay_line}

JSON keys exactly:
title, slides, narration, model_answer, highlighted_phrases, explanation, practice_prompt,
listening_dialogue, comprehension_questions, roleplay_prompt, video_scene_description

comprehension_questions: array of {{"id":"q1","question":"...","answer_hint":"..."}}
"""


def _prompt_listening_style(
    *,
    module: str,
    skill_id: str,
    label: str,
    desc: str,
    band_line: str,
    topic: str,
    scenario: str,
    difficulty: str,
) -> str:
    return f"""Create a **listening-in-context** micro-lesson for IELTS Listening.

Skill id: {skill_id}
Skill name: {label}
Skill description: {desc}
Topic: {topic}, Scenario: {scenario}, Difficulty: {difficulty}
{band_line}

Rules:
- Slides summarise strategy (4-6 slides).
- Narration 200-380 words explaining how to listen for answers in this scenario.
- "listening_dialogue": 6-12 short turns, realistic IELTS Section 1-3 style.
- "comprehension_questions": 2 questions with id q1, q2 and answer_hint (few words).
- "model_answer": {{"text": "..."}} summarising the key information from the dialogue.
- "highlighted_phrases": useful phrases heard in the dialogue.
- "practice_prompt": shadowing line for the learner.
- "roleplay_prompt": "".
- "video_scene_description": setting for video B-roll.

JSON keys: title, slides, narration, model_answer, highlighted_phrases, explanation, practice_prompt,
listening_dialogue, comprehension_questions, roleplay_prompt, video_scene_description
"""


def _normalise_package(
    data: dict[str, Any],
    label: str,
    skill_id: str,
    lesson_kind: str,
) -> dict[str, Any]:
    title = str(data.get("title") or label).strip()
    slides = data.get("slides") or []
    narration = str(data.get("narration") or "").strip()
    if not narration or len(narration) < 80:
        raise RuntimeError("Lesson narration too short or missing")
    if not isinstance(slides, list) or len(slides) < 2:
        raise RuntimeError("Lesson slides missing or too few")
    norm_slides = []
    for s in slides[:12]:
        if not isinstance(s, dict):
            continue
        h = str(s.get("heading") or "").strip()
        bullets = s.get("bullets") or []
        if not isinstance(bullets, list):
            bullets = []
        bullets = [str(b).strip() for b in bullets if str(b).strip()][:6]
        if h or bullets:
            norm_slides.append({"heading": h or "Slide", "bullets": bullets})
    if len(norm_slides) < 2:
        raise RuntimeError("Could not normalise lesson slides")

    ma = data.get("model_answer") or {}
    if isinstance(ma, str):
        ma = {"text": ma}
    elif not isinstance(ma, dict):
        ma = {"text": ""}
    model_text = str(ma.get("text") or "").strip() or narration[:400]

    hp = data.get("highlighted_phrases") or []
    if not isinstance(hp, list):
        hp = []
    hp = [str(x).strip() for x in hp if str(x).strip()][:12]

    ld = data.get("listening_dialogue") or []
    if not isinstance(ld, list):
        ld = []

    cq = data.get("comprehension_questions") or []
    norm_cq = []
    if isinstance(cq, list):
        for i, q in enumerate(cq):
            if not isinstance(q, dict):
                continue
            qid = str(q.get("id") or f"q{i+1}")
            norm_cq.append(
                {
                    "id": qid,
                    "question": str(q.get("question") or "").strip(),
                    "answer_hint": str(q.get("answer_hint") or "").strip(),
                }
            )

    content = {
        "model_answer": {"text": model_text},
        "highlighted_phrases": hp,
        "explanation": str(data.get("explanation") or "").strip(),
        "practice_prompt": str(data.get("practice_prompt") or "").strip(),
        "listening_dialogue": ld,
        "comprehension_questions": norm_cq,
        "roleplay_prompt": str(data.get("roleplay_prompt") or "").strip(),
        "video_scene_description": str(data.get("video_scene_description") or "").strip(),
    }

    eval_hook: dict[str, Any]
    if lesson_kind == "listening_to_speaking":
        eval_hook = {"type": "speaking_response", "target_micro_skill": skill_id}
    elif lesson_kind == "listening_context" and norm_cq:
        eval_hook = {"type": "comprehension_only", "target_micro_skill": skill_id}
    elif lesson_kind == "speaking_scenario":
        eval_hook = {"type": "speaking_response", "target_micro_skill": skill_id}
    else:
        eval_hook = {"type": "none", "target_micro_skill": skill_id}

    return {
        "title": title,
        "slides": norm_slides,
        "narration": narration,
        "content": content,
        "evaluation_hook": eval_hook,
        "lesson_kind": lesson_kind,
    }


async def generate_lesson_json(
    skill_id: str,
    *,
    module: str,
    learner_band: Optional[float] = None,
) -> dict[str, Any]:
    """Backward-compatible: explainer package, slides+narration only for old callers."""
    pkg = await generate_lesson_package(
        skill_id,
        module=module,
        learner_band=learner_band,
        lesson_kind="skill_explainer",
        curriculum=None,
        weakness_vector=None,
    )
    return {"title": pkg["title"], "slides": pkg["slides"], "narration": pkg["narration"]}


def build_seedance_video_prompt(
    *,
    title: str,
    slides: list[dict[str, Any]],
    narration: str,
    module: str,
    skill_label: str,
) -> str:
    """
    Single text-to-video prompt for OpenRouter (video model from OPENROUTER_LESSON_VIDEO_MODEL in .env).
    Keeps length reasonable for provider limits.
    """
    lines = [
        f"Professional IELTS {module.title()} coaching video for independent learners.",
        f"Lesson title on screen early: \"{title}\".",
        f"Micro-skill focus: {skill_label}.",
        "Visual style: clean modern educational motion graphics, readable titles, soft teal and slate palette, no faces of real celebrities, no brand logos.",
        "Pacing: calm and clear, suitable for English language learners preparing for IELTS.",
        "Structure as short scenes with on-screen headings and simple diagrams or icons where helpful:",
    ]
    for i, s in enumerate(slides[:7], start=1):
        h = str(s.get("heading") or f"Part {i}")
        bullets = s.get("bullets") or []
        btxt = "; ".join(str(b).strip() for b in bullets[:4] if str(b).strip())
        lines.append(f"Scene {i}: Heading \"{h}\". Key ideas: {btxt or 'core teaching point for this beat.'}")
    narr_snip = (narration or "").strip().replace("\n", " ")
    if len(narr_snip) > 1400:
        narr_snip = narr_snip[:1400] + "…"
    lines.append(
        "Audio: clear British-English teacher voiceover, encouraging and exam-focused, synced with visuals. "
        "Themes from this teaching script (paraphrase naturally; do not read as a wall of text): "
        f"{narr_snip}"
    )
    text = "\n".join(lines)
    if len(text) > 4800:
        text = text[:4800] + "\n…"
    return text


def build_scenario_broll_prompt(
    *,
    title: str,
    video_scene_description: str,
    topic: str,
    scenario: str,
    module: str,
) -> str:
    """Short cinematic B-roll style prompt for first clip."""
    scene = (video_scene_description or "").strip() or f"Everyday {topic} setting: {scenario}."
    if len(scene) > 1200:
        scene = scene[:1200] + "…"
    return (
        f"Cinematic realistic B-roll for an English lesson titled \"{title}\". "
        f"Setting: {scene} "
        f"No readable text overlays, no celebrity faces, no brand logos. "
        f"Documentary lighting, {module} learning context, calm ambient mood, 16:9 educational stock feel."
    )


def build_dialogue_scene_prompt(
    *,
    title: str,
    listening_dialogue: list[dict[str, Any]],
    topic: str,
    scenario: str,
) -> str:
    """Visual mood for listening: environment matches dialogue setting."""
    snippet = ""
    for t in listening_dialogue[:4]:
        if isinstance(t, dict):
            snippet += (t.get("line") or "")[:80] + " "
    snippet = snippet.strip()[:400]
    return (
        f"Realistic scene for IELTS listening practice: {topic}, {scenario}. "
        f"Atmosphere only (no subtitles): {snippet or 'polite everyday conversation in a public setting.'} "
        f"Lesson: \"{title}\". Natural lighting, no celebrity faces, no logos."
    )
