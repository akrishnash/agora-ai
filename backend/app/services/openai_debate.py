import json
import os
from typing import Any
from uuid import uuid4

from openai import OpenAI

from app.models import (
    ClaimNode,
    DebateRequest,
    DebateSession,
    DebateTurn,
    Expert,
    InterventionRequest,
    ModeratorBrief,
)
from app.services.demo_debate import build_demo_debate, build_demo_intervention

SESSION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["experts", "turns", "graph", "brief"],
    "properties": {
        "experts": {
            "type": "array",
            "minItems": 5,
            "maxItems": 6,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "name", "role", "stance", "confidence"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "stance": {"type": "string", "enum": ["support", "oppose", "mixed"]},
                    "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
                },
            },
        },
        "turns": {
            "type": "array",
            "minItems": 4,
            "maxItems": 8,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["speaker_id", "claim", "evidence", "relation"],
                "properties": {
                    "speaker_id": {"type": "string"},
                    "claim": {"type": "string"},
                    "evidence": {"type": "string"},
                    "relation": {
                        "type": "string",
                        "enum": ["opens", "supports", "challenges", "revises"],
                    },
                },
            },
        },
        "graph": {
            "type": "array",
            "minItems": 3,
            "maxItems": 6,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["label", "confidence", "status"],
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
                    "status": {
                        "type": "string",
                        "enum": ["supported", "contested", "revised"],
                    },
                },
            },
        },
        "brief": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "strongest_position",
                "weakest_assumption",
                "unresolved_disagreement",
                "next_question",
            ],
            "properties": {
                "strongest_position": {"type": "string"},
                "weakest_assumption": {"type": "string"},
                "unresolved_disagreement": {"type": "string"},
                "next_question": {"type": "string"},
            },
        },
    },
}

SYSTEM_PROMPT = """You are Agora AI's debate orchestrator.
Create a compact, high-signal expert debate for a hackathon product UI.
Do not impersonate real people. Use fictional expert names and real disciplines.
Every expert turn must make one clear claim and cite a type of evidence, report, study, or historical precedent.
Include genuine disagreement. At least one turn should revise or qualify a previous position.
Keep claims concise enough for a live interface."""


def create_debate_session(request: DebateRequest) -> DebateSession:
    if not os.getenv("OPENAI_API_KEY"):
        return build_demo_debate(request)

    try:
        payload = _call_openai(
            user_prompt=(
                f"Topic: {request.topic}\n"
                f"Format: {request.format}\n"
                "Build the initial expert panel, debate turns, argument graph, and moderator brief."
            )
        )
        return _session_from_payload(payload, request)
    except Exception:
        return build_demo_debate(request)


def apply_debate_intervention(request: InterventionRequest) -> DebateSession:
    if not os.getenv("OPENAI_API_KEY"):
        return build_demo_intervention(request)

    try:
        payload = _call_openai(
            user_prompt=(
                "Existing debate session JSON:\n"
                f"{request.session.model_dump_json()}\n\n"
                f"User intervention: {request.instruction}\n"
                "Update the session with 1-2 new turns, revised graph nodes, and a sharper brief."
            )
        )
        updated = _session_from_payload(
            payload,
            DebateRequest(topic=request.session.topic, format=request.session.format),
        )
        updated.id = request.session.id
        return updated
    except Exception:
        return build_demo_intervention(request)


def _call_openai(user_prompt: str) -> dict[str, Any]:
    client = OpenAI()
    model = os.getenv("OPENAI_MODEL", "gpt-5.6")
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "debate_session",
                "schema": SESSION_SCHEMA,
                "strict": True,
            }
        },
    )
    return json.loads(response.output_text)


def _session_from_payload(payload: dict[str, Any], request: DebateRequest) -> DebateSession:
    return DebateSession(
        id=uuid4(),
        topic=request.topic,
        format=request.format,
        experts=[Expert(**expert) for expert in payload["experts"]],
        turns=[DebateTurn(**turn) for turn in payload["turns"]],
        graph=[ClaimNode(**node) for node in payload["graph"]],
        brief=ModeratorBrief(**payload["brief"]),
        mode="openai",
    )
