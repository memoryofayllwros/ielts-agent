Below is an **improved version of your README markdown**.
I preserved your structure but improved:

* clarity
* professional documentation tone
* architecture explanation
* added **Diagnostic Test** (baseline assessment)
* added **adaptive practice concept**
* improved **API description**
* improved **system flow explanation**

Nothing in the design contradicts your current codebase.

You can paste this directly into `README.md`.

---

# IELTS Practice Agent

An **AI-powered IELTS practice platform** for training all four IELTS skills:

* **Reading**
* **Listening**
* **Writing**
* **Speaking**

The system generates practice tasks using LLMs via OpenRouter, evaluates answers automatically (objective scoring or rubric-based feedback), and stores user progress in MongoDB.

A **diagnostic test** determines each user's baseline band level, enabling **adaptive practice difficulty** for more effective training.

---

# Features

## Diagnostic Test (Baseline Assessment)

On first use, the system can run a short **diagnostic test** to estimate the user's IELTS band level across all four skills.

Diagnostic structure:

| Skill     | Task                             |
| --------- | -------------------------------- |
| Reading   | Short passage + 5 questions      |
| Listening | Short audio script + 5 questions |
| Writing   | Short Task 2 essay               |
| Speaking  | Cue card response                |

The estimated baseline band score is stored in the user profile and used to guide practice difficulty.

---

## Reading Practice

* Academic IELTS-style passages
* Question types:

  * Gap-fill
  * Multiple choice
* Server-side answer grading
* Detailed result tracking

---

## Listening Practice

* Generated listening scripts
* Audio playback options:

  * Browser **Text-to-Speech**
  * Optional **server TTS** via OpenRouter
* Objective question grading (same types as reading)

---

## Writing Practice

Supports both IELTS writing tasks:

* **Task 1** — data report
* **Task 2** — argumentative essay

AI evaluates writing using IELTS-style rubric criteria:

* Task Response
* Coherence & Cohesion
* Lexical Resource
* Grammatical Range & Accuracy

Structured feedback and band estimation are returned.

---

## Speaking Practice

Simulates **IELTS Speaking Part 2**:

* Cue card prompt
* 1 minute preparation
* Spoken answer

Input options:

* Record audio
* Upload audio
* Dictate transcript
* Type response

Audio can be transcribed via OpenRouter STT before evaluation.

Speaking feedback includes approximate scoring for:

* Fluency
* Lexical resource
* Grammar
* Pronunciation (estimated from transcript)

---

## Authentication & Progress Tracking

* Secure login with JWT
* Track practice history
* Filter progress by skill
* Review detailed results

---

# Tech Stack

| Layer                      | Technology                                     |
| -------------------------- | ---------------------------------------------- |
| AI generation & evaluation | Claude via [OpenRouter](https://openrouter.ai) |
| STT / TTS (optional)       | OpenRouter multimodal APIs                     |
| Backend                    | Python · FastAPI · Uvicorn                     |
| Authentication             | JWT (`PyJWT`) · bcrypt                         |
| Database                   | MongoDB (`motor`)                              |
| Frontend                   | React 18 · MUI v5 · React Router v6 · Vite     |

---

# System Architecture

```
Frontend (React)
        │
        ▼
FastAPI Backend
        │
        ├── Practice Generation (LLM)
        ├── Answer Evaluation
        ├── Speech Processing
        │
        ▼
MongoDB
        ├── Users
        ├── Practice Sessions
        ├── Results
        └── Diagnostic Scores
```

### Key Design Principles

* **Server-side answer validation**
* **Hidden answers stored in database**
* **Session-based practice tracking**
* **LLM evaluation for open-ended tasks**

---

# Environment Variables

Create a `.env` file in the project root:

| Variable                      | Required         | Purpose                               |
| ----------------------------- | ---------------- | ------------------------------------- |
| `OPENROUTER_API_KEY`          | Yes              | LLM content generation and evaluation |
| `MONGODB_URL`                 | Yes              | MongoDB connection string             |
| `JWT_SECRET`                  | Yes (production) | JWT signing key                       |
| `OPENROUTER_TRANSCRIBE_MODEL` | No               | Model for audio → text transcription  |
| `OPENROUTER_TTS_MODEL`        | No               | Model for server text-to-speech       |

Defaults:

```
OPENROUTER_TRANSCRIBE_MODEL=google/gemini-2.0-flash-001
OPENROUTER_TTS_MODEL=openai/gpt-4o-mini
```

---

# Project Structure

```
├── backend/
│   ├── main.py
│   │
│   ├── ai.py
│   │   LLM content generation
│   │
│   ├── agents.py
│   │   Listening / writing / speaking agents
│   │
│   ├── speech_openai.py
│   │   STT + TTS integration via OpenRouter
│   │
│   ├── auth.py
│   ├── database.py
│   └── models.py
│
├── frontend/src/
│
│   ├── pages/
│   │
│   │   PracticeHub/
│   │   Skill selection dashboard
│   │
│   │   ObjectivePracticePage/
│   │   Shared reading/listening flow
│   │
│   │   ReadingPracticePage/
│   │   ListeningPracticePage/
│   │   WritingPracticePage/
│   │   SpeakingPracticePage/
│   │
│   │   ProgressPage/
│   │   AuthPage/
│
│   ├── components/
│   │   PracticeQuestions/
│   │
│   └── services/
│       api.js
│
└── requirements.txt
```

The MongoDB database name remains:

```
ielts_reading_agent
```

(slightly legacy naming but still functional).

Sessions and results now include a `skill` field:

```
reading | listening | writing | speaking
```

---

# Setup

## 1. Create Virtual Environment

```
cd ielts-reading-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 2. Configure Environment

Create `.env` in project root.

Minimum required:

```
OPENROUTER_API_KEY=
MONGODB_URL=
JWT_SECRET=
```

---

## 3. Build Frontend

```
cd frontend
npm install
npm run build
cd ..
```

---

## 4. Run Backend

```
cd backend
source ../venv/bin/activate
python main.py
```

Open:

```
http://localhost:8000
```

---

## Development Mode

Run frontend with hot reload:

```
cd frontend
npm run dev
```

Open:

```
http://localhost:5173
```

Vite proxies `/api` requests to the backend.

---

# API Endpoints

## Practice

| Method | Endpoint                             | Description                 |
| ------ | ------------------------------------ | --------------------------- |
| POST   | `/api/practice/generate`             | Generate a practice session |
| POST   | `/api/practice/submit`               | Submit objective answers    |
| POST   | `/api/practice/submit-writing`       | Submit writing response     |
| POST   | `/api/practice/submit-speaking`      | Submit speaking audio       |
| POST   | `/api/practice/submit-speaking-json` | Submit transcript only      |

---

## Listening Audio

| Method | Endpoint             | Description                          |
| ------ | -------------------- | ------------------------------------ |
| POST   | `/api/listening/tts` | Generate audio from listening script |

Returns:

```
audio/mpeg
```

---

## Progress

| Method | Endpoint                      | Description             |
| ------ | ----------------------------- | ----------------------- |
| GET    | `/api/progress`               | User practice history   |
| GET    | `/api/progress?skill=reading` | Filter by skill         |
| GET    | `/api/results/{id}`           | Detailed attempt result |

---

# System Workflow

### 1. Practice Generation

```
Client
   │
POST /api/practice/generate
   │
LLM generates passage + questions
   │
Session stored in MongoDB
   │
Client receives practice data
```

Hidden answers remain server-side.

---

### 2. Objective Question Evaluation

```
Client answers
   │
POST /api/practice/submit
   │
Server compares with hidden answers
   │
Score calculated
   │
Results stored in database
```

---

### 3. Writing Evaluation

```
Essay text
   │
LLM rubric evaluation
   │
Structured feedback
   │
Band estimate
```

---

### 4. Speaking Evaluation

```
Audio
   │
Speech-to-text (optional)
   │
Transcript
   │
LLM evaluation
   │
Band estimate + feedback
```

---

### 5. Progress Tracking

Each attempt stores:

* user response
* score / band estimate
* evaluation feedback
* timestamp

This enables longitudinal learning analytics.

---

# License

Open-source project for IELTS practice experimentation and AI-assisted language learning.

