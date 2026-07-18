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
    # Allow localhost AND any private LAN IPv4 origin (e.g. http://192.168.x.x:3000),
    # so the app works whether it is opened via localhost or the network URL.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|0\.0\.0\.0|(\d{1,3}\.){3}\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debates_router, prefix="/debates", tags=["debates"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
