"""
Vercel serverless entry point for the IELTS Practice FastAPI backend.

Vercel bundles this file together with everything listed in
vercel.json `includeFiles` (the entire backend/ package).
"""
import sys
import os

# Make `import backend.foo` and `import foo` (bare) both work
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_backend = os.path.join(_root, "backend")
for _p in (_root, _backend):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Load .env when running locally via `vercel dev`; on Vercel itself the
# environment variables are injected by the platform.
from dotenv import load_dotenv
load_dotenv(os.path.join(_root, ".env"))

# Import the FastAPI application.
# main.py uses a lifespan context manager that calls init_db().
# Vercel's ASGI adapter honours the ASGI lifespan protocol, so init_db()
# runs once per cold-start and the motor client is reused on warm starts.
from main import app  # noqa: F401  (re-exported as the ASGI handler)
