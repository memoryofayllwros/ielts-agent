# IELTS Reading Practice Agent

An AI-powered web app for practising IELTS Academic Reading–style tasks. It generates a fresh passage and questions every session, grades your answers instantly, and tracks your score history per user.

---

## Features

- **AI-generated content** — Claude (via OpenRouter) writes a unique 150–200 word academic passage each session
- **Three IELTS-style reading task types**
  - Fill in the Blanks — select missing words from a word bank
  - Multiple Choice (Single) — pick the one correct answer
  - Multiple Choice (Multiple) — pick the two correct answers
- **Instant grading** — answers are compared server-side (correct answers are never sent to the browser)
- **Explanations** — every question shows why each answer is right or wrong
- **Per-user authentication** — sign up / sign in with email + password; JWT sessions
- **Progress tracking** — session history with scores stored in MongoDB; review any past session in full

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Claude Sonnet 4.6 via [OpenRouter](https://openrouter.ai) (`openai` SDK) |
| Backend | Python · FastAPI · Uvicorn |
| Auth | JWT (`PyJWT`) · bcrypt password hashing |
| Database | MongoDB Atlas (`motor` async driver) |
| Frontend | React 18 · MUI v5 · React Router v6 · Vite |

---

## Project Structure

```
ielts-reading-agent/
├── backend/
│   ├── main.py          # FastAPI app, routes, scoring logic
│   ├── ai.py            # OpenRouter / Claude integration
│   ├── auth.py          # JWT creation/validation, bcrypt helpers
│   ├── database.py      # MongoDB operations (users, sessions, results)
│   └── models.py        # Pydantic request/response models
├── frontend/
│   ├── package.json     # Vite + React + MUI dependencies
│   ├── vite.config.js   # Path aliases, dev proxy to :8000
│   ├── index.html       # Vite entry point
│   └── src/
│       ├── index.jsx              # App bootstrap (HashRouter + providers)
│       ├── App.jsx                # Routes, ProtectedRoute, Sidenav layout
│       ├── context/
│       │   ├── index.jsx          # MaterialUIControllerProvider (sidenav state)
│       │   └── AuthContext.jsx    # Auth state, login/register/logout
│       ├── assets/theme/          # MUI theme (colours, typography, overrides)
│       ├── services/api.js        # All API calls with Bearer auth + 401 handling
│       ├── components/
│       │   ├── MDBox/             # MUI Box wrapper
│       │   ├── MDButton/          # MUI Button wrapper
│       │   ├── MDTypography/      # MUI Typography wrapper
│       │   ├── Sidenav/           # Collapsible drawer with active route highlighting
│       │   ├── LayoutContainers/DashboardLayout/
│       │   └── Navbars/DashboardNavbar/  # Sticky navbar with user chip + sign out
│       └── pages/
│           ├── AuthPage/          # Sign in / sign up (tabbed)
│           ├── PracticePage/      # Generate → answer → results flow
│           └── ProgressPage/      # Session history table + full review view
├── requirements.txt
└── .env
```

---

## Setup

### 1. Clone and create a virtual environment

```bash
git clone <repo-url>
cd ielts-reading-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```
OPENROUTER_API_KEY=your_openrouter_key_here
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>
JWT_SECRET=change-this-to-a-random-secret
```

The app uses the MongoDB database name `ielts_reading_agent`. If you previously used the older `pte_reading_agent` database, either rename it in Atlas or copy collections if you need to keep existing data.

### 3. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Run the backend

```bash
cd backend
source ../venv/bin/activate
python main.py
```

Open **http://localhost:8000** in your browser.

> **Frontend development (hot reload)**
> Run `npm run dev` inside `frontend/` — Vite proxies `/api` requests to `:8000`.
> Open **http://localhost:5173** instead.

---

## How It Works

### Authentication

- Passwords are hashed with **bcrypt** and stored in the `users` MongoDB collection.
- On sign-in, a **JWT** (7-day expiry) is issued and stored in `localStorage`.
- Every protected API request includes `Authorization: Bearer <token>`; the backend validates it via FastAPI `Depends`.
- A 401 response automatically clears the session and reloads the auth screen.

### Generating a session (`POST /api/practice/generate`)

1. The frontend sends an optional topic hint.
2. `ai.py` sends a structured prompt to Claude via OpenRouter, requesting a JSON object with the passage and three questions (one of each type).
3. The full session — including correct answers and explanations — is saved to MongoDB (`sessions` collection).
4. Only the passage and question bodies (no answers) are returned to the browser.

### Submitting answers (`POST /api/practice/submit`)

1. The frontend sends the session ID and the user's answers.
2. The backend fetches the session from MongoDB and compares answers server-side.
3. Scoring:
   - Fill in the Blanks: 1 point per blank (partial credit)
   - Multiple Choice Single / Multiple: 1 point for a fully correct selection
4. Results — score, per-question breakdown, and explanations — are saved to MongoDB (`results` collection) and returned to the browser.

### Progress (`GET /api/progress`)

Returns the 50 most recent results for the authenticated user, ordered by date, plus total session count and average score.

### Result review (`GET /api/results/{result_id}`)

Returns full detail for one past result: the original passage, each question, the user's answers, correct answers, and explanations — scoped to the authenticated user.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | — | Create a new account |
| `POST` | `/api/auth/login` | — | Sign in and receive a JWT |
| `POST` | `/api/practice/generate` | ✓ | Generate a new practice session |
| `POST` | `/api/practice/submit` | ✓ | Submit answers and get results |
| `GET` | `/api/progress` | ✓ | Retrieve score history (last 50) |
| `GET` | `/api/results/{id}` | ✓ | Full detail for one past result |
