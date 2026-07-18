import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env (OPENAI_API_KEY, OPENAI_MODEL) before anything reads os.environ.
load_dotenv()

from app.routes.debates import router as debates_router

LOCAL_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1|0\.0\.0\.0|(\d{1,3}\.){3}\d{1,3})(:\d+)?"


def _csv_env(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [value.strip() for value in raw.split(",") if value.strip()]


app = FastAPI(
    title="Agora AI API",
    description="Debate orchestration API for Agora AI.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_csv_env("AGORA_CORS_ORIGINS"),
    allow_origin_regex=os.getenv("AGORA_CORS_ORIGIN_REGEX") or LOCAL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debates_router, prefix="/debates", tags=["debates"])


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "mode": "openai" if os.getenv("OPENAI_API_KEY") else "demo",
        "environment": os.getenv("AGORA_ENV", "development"),
    }
