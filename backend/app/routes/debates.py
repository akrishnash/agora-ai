from fastapi import APIRouter

from app.models import DebateRequest, DebateSession
from app.services.demo_debate import build_demo_debate

router = APIRouter()


@router.post("", response_model=DebateSession)
def create_debate(request: DebateRequest) -> DebateSession:
    return build_demo_debate(request)
