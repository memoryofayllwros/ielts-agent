# Education Agent

**Education Agent** is an AI-powered IELTS preparation system. It targets learners who want to move from roughly **Band 6 → Band 7** (or 6.5 → 7) within **3–6 months**, by closing the loop between practice, diagnosis, and targeted training.

```text
Practice → Diagnosis → Targeted Training → Score Improvement
```

**Positioning:** not a flat question bank, but an **AI IELTS personal coach**—unlimited generation, AI scoring, skill-level diagnostics, adaptive drills, and visible progress.

---

## Document map

| Section | What it covers |
| -------- | -------------- |
| [1. Product goals & users](#1-product-goals--users) | Vision, audience, differentiation |
| [2. Core features](#2-core-features) | Diagnostic, practice, evaluation, analytics UI, adaptive learning |
| [3. AI capabilities](#3-ai-capabilities) | Agents, evaluation modes, speech pipeline |
| [4. Data & analytics](#4-data--analytics) | Skill graph, schema, adaptive algorithm, reporting |
| [5. System architecture](#5-system-architecture) | Services, data layer, scaling, observability |
| [6. Future extensions](#6-future-extensions) | Roadmap ideas |

**End-to-end learning loop (reference):**

```text
Diagnostic → Practice Generation → Answer Evaluation → Skill Diagnostics
    → Targeted Practice Recommendation → Progress Tracking → (repeat)
```

---

## 1. Product goals & users

### 1.1 Goals

- Deliver **high-quality IELTS-style tasks** across Reading, Listening, Writing, and Speaking.
- Provide **AI scoring and feedback** for open-ended work; **objective scoring** for MCQ-style items.
- Surface **skill-level strengths and weaknesses**, not only raw scores.
- Support **personalized difficulty and next-step practice** from diagnostic and ongoing performance.

```text
IELTS Band 6 → Band 7 improvement  (also 6.5 → 7)
```

**Design principle:**

```text
Practice alone is not enough.
Students must see how their skills improve.
```

### 1.2 Target users

- IELTS candidates planning an exam in **3–6 months**.
- Typical targets: **Band 6 / 6.5 → Band 7**.

**User needs:** reliable practice, AI feedback, a clear path, and **visible progress** (session summaries, skill maps, weekly trends).

### 1.3 Differentiation

| Typical app | Education Agent |
| ----------- | ---------------- |
| Item bank + static difficulty | **Generated** tasks, **band-aware** difficulty |
| Score only | **Skill tags** + **weakness → next drill** |
| One-off practice | **Closed loop**: diagnostic → practice → evaluate → adapt |

```text
diagnostic → practice → AI evaluation → skill analysis → targeted practice → band improvement
```

---

## 2. Core features

### 2.1 Diagnostic assessment

First-time **diagnostic** estimates current level across all four skills.

| Skill | Task |
| ----- | ---- |
| Reading | Passage + questions |
| Listening | Short audio + questions |
| Writing | Short essay |
| Speaking | Cue card response |

**Outputs:** estimated band (overall/skill), **skill breakdown**, **initial weaknesses**—used to set difficulty and seed the learning path.

### 2.2 Practice generation

LLM-generated **IELTS-style** content with **structured JSON** (passages, items, keys where applicable, prompts, audio scripts for TTS, etc.).

| Skill | Content |
| ----- | -------- |
| Reading | Academic passages + questions |
| Listening | Script + TTS audio |
| Writing | Task 1 / Task 2 |
| Speaking | Cue card prompts |

**Properties:** large effective item space, **difficulty ≈ Band 4–8**, **focus skills** (e.g. paraphrase) for adaptive drill-downs.

### 2.3 AI evaluation

- **Objective (Reading, Listening):** server-side **answer matching** and **accuracy**; optional per-question **skill** attribution.
- **Open-ended (Writing, Speaking):** rubric aligned with IELTS-style criteria (e.g. Task Response, Coherence & Cohesion, Lexical Resource, Grammar) → **band estimate**, **criterion scores**, **feedback**, **improvement suggestions**.

### 2.4 Skill-based analytics & reporting

Micro-skills (example for **Reading**):

| Skill | Role |
| ----- | ---- |
| Skimming | Main idea |
| Scanning | Locating information |
| Paraphrase recognition | Paraphrase / synonym traps |
| Inference | Implied meaning |
| Detail matching | Specific facts |

Each question can carry metadata, for example:

```json
{
  "question_id": 12,
  "skill": "paraphrase",
  "difficulty": "band6"
}
```

**Per-skill signal:** `skill_accuracy = correct / total` (rolling or per window).

**Session learning summary (example):**

```text
Skills strengthened today:  Scanning, Detail matching
Skills needing improvement: Paraphrase recognition, Inference
```

**Weekly report (example):**

```text
Total questions practiced: 120
Improvement: Scanning accuracy 65% → 82%
Needs improvement: Paraphrase recognition 45%
```

### 2.5 Adaptive practice engine

```text
Practice → Evaluation → Weakness detection → Targeted practice generation
```

Example:

```text
Weakness: Paraphrase recognition
Next: Reading set focused on paraphrased sentences (same band)
```

### 2.6 Learning journey visualization

Example **Reading skill map** (UI):

```text
Scanning              ████████ 80%
Skimming              ██████ 60%
Paraphrase detection  ████ 40%
Inference             █████ 50%
Detail matching       ████████ 85%
```

Users see **current skill levels**, **gaps**, and **suggested next focus**.

### 2.7 Progress tracking

Persisted: sessions, answers, evaluations, band estimates, timestamps—enabling **session**, **weekly**, and **long-term** views.

### 2.8 Platform stack (product view)

- **Frontend:** React  
- **Backend:** FastAPI  
- **Primary store:** MongoDB (users, sessions, responses, evaluations, skill metrics)  
- **Cross-cutting:** speech I/O for Speaking where used  

---

## 3. AI capabilities

The system uses **specialized agents** (not a single monolithic LLM for everything). Below: responsibilities and **contract-shaped** I/o.

### 3.1 Task generator agent

**Role:** generate band- and skill-aware tasks (passages, listening scripts, writing/speaking prompts, structured items + keys).

**Input (illustrative):**

```json
{
  "skill": "reading",
  "difficulty": "band6",
  "focus_skill": "paraphrase"
}
```

**Output (illustrative):**

```json
{
  "passage": "...",
  "questions": ["..."],
  "answers": ["..."]
}
```

### 3.2 Evaluation agent

- **Objective:** match + accuracy (and per-item correctness for analytics).
- **Open:** rubric-based **band estimate**, **criterion scores**, **narrative feedback**.

**Output (illustrative):**

```json
{
  "band_estimate": 6.5,
  "criteria_scores": {},
  "feedback": "..."
}
```

### 3.3 Skill diagnosis agent

**Input:** `responses` + `question_metadata` (skill tags, difficulty).

**Output (illustrative):**

```json
{
  "skill_scores": {
    "scanning": 0.8,
    "paraphrase": 0.4,
    "inference": 0.6
  }
}
```

### 3.4 Adaptive planner agent

**Input:** current `skill_scores`, `target_band`, constraints (time, skill).

**Output (illustrative):**

```json
{
  "recommended_focus": "paraphrase",
  "next_practice_difficulty": "band6"
}
```

### 3.5 Speech processing (Speaking)

```text
Audio → Speech-to-Text → Transcript → LLM evaluation → Band estimate + feedback
```

**Future (optional):** rate of speech, pauses, pronunciation features.

**Engineering note:** keep **LLM / agent work** out of raw HTTP request paths where possible (queues for long jobs); see [§5.3](#53-scaling--async-work).

---

## 4. Data & analytics

### 4.1 Skill graph

Reading (illustrative hierarchy):

```text
Reading
 ├── Skimming
 ├── Scanning
 ├── Paraphrase recognition
 ├── Inference
 └── Detail matching
```

**Uses:** diagnosis, **recommendation**, and **UI skill maps**; other skills (Listening, etc.) can follow the same pattern with their own taxonomies.

### 4.2 Data model (MongoDB-oriented)

**Users**

```json
{
  "_id": "user_id",
  "email": "...",
  "target_band": 7,
  "diagnostic_band": 6
}
```

**Practice sessions**

```json
{
  "_id": "session_id",
  "user_id": "...",
  "skill": "reading",
  "difficulty": "band6",
  "questions": [],
  "answers": []
}
```

**Responses**

```json
{
  "session_id": "...",
  "question_id": "...",
  "user_answer": "...",
  "correct": true
}
```

**Evaluations** (open-ended / session-level scoring artifacts)

```json
{
  "session_id": "...",
  "band_estimate": 6.5,
  "feedback": "...",
  "criteria_scores": {}
}
```

**Skill metrics** (denormalized / aggregated for fast reads)

```json
{
  "user_id": "...",
  "skill": "paraphrase",
  "accuracy": 0.42,
  "last_updated": "..."
}
```

**Skill graph** can be config (versioned JSON/YAML) + DB references, not only embedded in the API code.

### 4.3 Adaptive learning (minimal algorithm)

1. **Collect** per-skill accuracy (or rolling rates).
2. **Detect** weak skills (e.g. `argmin` over skills below a target threshold; production systems add floors, recency, and exposure).
3. **Request** targeted generation: `focus_skill` + `difficulty` (and skill module).

Example weak skill: **paraphrase** → next practice with `focus_skill: "paraphrase"`, `difficulty: "band6"`.

### 4.4 Analytics pipeline

- **Per session:** score, skill highlights, “what to do next” (feeds UI and planner).
- **Scheduled / batch:** weekly aggregates, trends, and optional exports.

---

## 5. System architecture

### 5.1 High-level view

```text
Frontend (React)
        │
        ▼
API Gateway (FastAPI)
        │
        ├── Auth
        ├── Practice
        ├── Evaluation
        ├── Learning analytics
        └── Speech
                │
                ▼
        AI agent layer
                │
                ├── Task generator
                ├── Evaluation
                ├── Skill diagnosis
                └── Adaptive planner
                │
                ▼
        Data layer
                │
                ├── MongoDB (sessions, results, users, lesson_videos + GridFS)
                ├── Skill graph (config / store)
                └── Analytics store (aggregates, rollups)
```

**Principles:** **separate** orchestration/API from **LLM work** where appropriate; **skill-first** analytics; **adaptive** loop backed by real metrics.

**Final reference loop (same as the document map):**

```text
Diagnostic Test → Practice Generation → User Answers → AI Evaluation
      → Skill Diagnostics → Adaptive Practice → Progress Analytics
```

### 5.2 Service split (as you grow)

```text
API Gateway
  ├── Practice service
  ├── Evaluation service
  ├── Speech service
  └── Analytics service
```

### 5.3 Scaling & async work

- Heavy AI calls: **async task queue** (e.g. Celery + Redis, or managed queues).
- **Observability** (production): **LLM** token use and latency; **API** latency and errors; **queue** depth / backlog.

### 5.4 Lesson videos (local / ops)

The **Lessons** feature builds short tutorials from weak micro-skills: an LLM produces a **lesson plan** (title, slide outline, narration script), then **OpenRouter’s video API** generates the actual file using the model set by **`OPENROUTER_LESSON_VIDEO_MODEL`** in `.env` (e.g. **`openai/sora-2-pro`** for Sora 2 on OpenRouter’s unified `/videos` API). The finished bytes are stored in **MongoDB GridFS** (`lesson_mp4` bucket); metadata lives in **`lesson_videos`**.

- **OpenRouter**: requires **`OPENROUTER_API_KEY`**. Video calls use `POST /api/v1/videos`, poll `GET /api/v1/videos/{jobId}`, then `GET /api/v1/videos/{jobId}/content` (same host as chat: `https://openrouter.ai/api/v1/...`).
- **Video model (required)**: set **`OPENROUTER_LESSON_VIDEO_MODEL`** in `.env` to a slug from `GET https://openrouter.ai/api/v1/videos/models` (see **`.env.example`**). For Sora, **`OPENROUTER_LESSON_VIDEO_DURATION`** is snapped to **4, 8, 12, 16, or 20** seconds (see OpenRouter model caps). Also: **`OPENROUTER_LESSON_VIDEO_ASPECT`**, **`OPENROUTER_LESSON_VIDEO_RESOLUTION`**, **`OPENROUTER_LESSON_VIDEO_AUDIO`** (`true`/`false`), and **`OPENROUTER_LESSON_VIDEO_POLL_SEC`** (default **3600** — Sora jobs can run for many minutes).
- **ffmpeg** is **not** required for this path (no local mux).
- **Jobs (MVP)** run via FastAPI **`BackgroundTasks`** in the same process as `uvicorn`. Restarts drop in-flight jobs; for production durability, run the same pipeline behind a **Redis** worker (RQ, Celery, Dramatiq, etc.).
- **API**: `GET/POST /api/lessons`, `GET /api/lessons/{id}/video` (auth required; same pattern as other Bearer routes).

---

## 6. Future extensions

| Area | Ideas |
| ---- | ----- |
| **Speaking analysis** | Speech rate, pauses, pronunciation-style signals |
| **Deeper learning analytics** | Vocabulary tracking, grammar error patterns, writing trends over time |
| **Full mock exam** | Timed L/R/W/S in one run → estimated overall band |

---

## Summary

Education Agent is an **adaptive, skill-aware IELTS training system**: generated practice, multi-agent AI for tasks and feedback, a **skill graph** and **metrics** for honest diagnostics, and a **closed loop** from weakness detection to the next best exercise—so learners see **how** and **where** they improve, not only a score.
