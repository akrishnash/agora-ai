from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env (OPENAI_API_KEY, OPENAI_MODEL) before anything reads os.environ.
load_dotenv()

from app.routes.debates import router as debates_router

app = FastAPI(
    title="Agora AI API",
    description="Debate orchestration API for Agora AI.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debates_router, prefix="/debates", tags=["debates"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
