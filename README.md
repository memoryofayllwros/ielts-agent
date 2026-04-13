# IELTS Practice Agent

An AI-powered web app for practising all four IELTS skills: **Reading**, **Listening**, **Writing**, and **Speaking**. It generates tasks via Claude (OpenRouter), scores objective answers and open-ended writing/speaking (rubric-based), and tracks history per user in MongoDB.

---

## Features

- **Reading** — Academic passage with gap-fill and multiple-choice questions (answers graded server-side).
- **Listening** — Script to play with browser text-to-speech or optional server TTS via OpenRouter; same objective question types as reading.
- **Writing** — Task 1 (report from text data) or Task 2 (essay); AI feedback against IELTS-style criteria.
- **Speaking** — Part 2 cue card; record audio (transcribed via OpenRouter if `OPENROUTER_API_KEY` is set) or type / dictate a transcript; approximate rubric feedback from text.
- **Auth & progress** — JWT sessions; filter progress by skill; review past attempts.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI (content + rubrics) | Claude via [OpenRouter](https://openrouter.ai) (`openai` SDK) |
| Optional STT / TTS | OpenRouter chat API (`input_audio` + streaming audio output), same `OPENROUTER_API_KEY` |
| Backend | Python · FastAPI · Uvicorn |
| Auth | JWT (`PyJWT`) · bcrypt |
| Database | MongoDB (`motor`) |
| Frontend | React 18 · MUI v5 · React Router v6 · Vite |

---

## Environment variables

Create a `.env` file in the project root (or set in your shell):

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Yes | Chat completions (all skills), plus optional STT/TTS via OpenRouter multimodal APIs |
| `MONGODB_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes (prod) | JWT signing |
| `OPENROUTER_TRANSCRIBE_MODEL` | No | Model for speaking audio → text (default `google/gemini-2.0-flash-001`) |
| `OPENROUTER_TTS_MODEL` | No | Model for listening server TTS (default `openai/gpt-4o-mini`; must support audio output) |

---

## Project structure (high level)

```
├── backend/
│   ├── main.py           # FastAPI routes (generate / submit / progress / TTS)
│   ├── ai.py             # Reading generation (OpenRouter)
│   ├── agents.py         # Listening, writing, speaking agents + evaluators
│   ├── speech_openai.py  # STT/TTS via OpenRouter (same key) + MP3 cache
│   ├── auth.py · database.py · models.py
├── frontend/src/
│   ├── pages/
│   │   ├── PracticeHub/          # Skill picker
│   │   ├── ObjectivePracticePage/ # Reading + Listening flows
│   │   ├── ReadingPracticePage/ · ListeningPracticePage/
│   │   ├── WritingPracticePage/ · SpeakingPracticePage/
│   │   ├── ProgressPage/ · AuthPage/
│   ├── components/PracticeQuestions/
│   └── services/api.js
└── requirements.txt
```

The MongoDB database name is still `ielts_reading_agent` (legacy); sessions and results now include a `skill` field (`reading` | `listening` | `writing` | `speaking`).

---

## Setup

### 1. Virtual environment

```bash
cd ielts-reading-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. `.env`

See table above. Minimum: `OPENROUTER_API_KEY`, `MONGODB_URL`, `JWT_SECRET`.

### 3. Frontend build

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Run backend

```bash
cd backend
source ../venv/bin/activate
python main.py
```

Open **http://localhost:8000**.

> **Dev with hot reload:** `npm run dev` in `frontend/` (Vite proxies `/api` to `:8000`), open **http://localhost:5173**.

---

## API (summary)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/practice/generate` | Body: `{ skill, topic?, writing_task_type? }` |
| `POST` | `/api/practice/submit` | Reading / listening objective answers |
| `POST` | `/api/practice/submit-writing` | `{ session_id, essay_text }` |
| `POST` | `/api/practice/submit-speaking` | `multipart`: `session_id`, optional `audio`, optional `transcript` |
| `POST` | `/api/practice/submit-speaking-json` | `{ session_id, transcript }` |
| `POST` | `/api/listening/tts` | `{ session_id }` → `audio/mpeg` (OpenRouter streaming TTS) |
| `GET` | `/api/progress?skill=` | Optional skill filter |
| `GET` | `/api/results/{id}` | Detail including `skill`, `evaluation`, etc. |

---

## How it works (short)

1. **Generate** stores full session data (including hidden answers / model text) in MongoDB; the client receives only what it needs to practise.
2. **Reading / listening submit** compares answers on the server; results store `question_results`.
3. **Writing / speaking submit** runs an LLM evaluator; results store `user_response` and `evaluation` JSON.
4. **TTS** — Browser `speechSynthesis` always works; server TTS uses OpenRouter (same key as chat) when configured.
