from fastapi import APIRouter

from app.models import DebateRequest, DebateSession, InterventionRequest
from app.services.openai_debate import apply_debate_intervention, create_debate_session

router = APIRouter()


@router.post("", response_model=DebateSession)
def create_debate(request: DebateRequest) -> DebateSession:
    return create_debate_session(request)


@router.post("/interventions", response_model=DebateSession)
def intervene(request: InterventionRequest) -> DebateSession:
    return apply_debate_intervention(request)
