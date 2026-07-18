import json
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models import DebateRequest, DebateSession, InterventionRequest
from app.services.openai_debate import (
    apply_debate_intervention,
    create_debate_session,
    create_debate_stream_events,
)

router = APIRouter()


@router.post("", response_model=DebateSession)
def create_debate(request: DebateRequest) -> DebateSession:
    return create_debate_session(request)


def _ndjson(events: Iterator[dict]) -> Iterator[str]:
    for event in events:
        yield json.dumps(event) + "\n"


@router.post("/stream")
def stream_debate(request: DebateRequest) -> StreamingResponse:
    return StreamingResponse(
        _ndjson(create_debate_stream_events(request)),
        media_type="application/x-ndjson",
    )


@router.post("/interventions", response_model=DebateSession)
def intervene(request: InterventionRequest) -> DebateSession:
    return apply_debate_intervention(request)
