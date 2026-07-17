import json
import os
import traceback
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

SYSTEM_PROMPT = """You are the orchestrator of Agora AI, an elite multi-agent reasoning platform.

Your role is to produce a structured expert debate that feels LIVE, SMART, and genuinely contentious.

STRICT RULES FOR EXPERTS:
- Each expert speaks from a specific discipline (e.g., biosecurity, innovation economics, constitutional law, AI safety).
- Every claim must be clear, decisive, and under 3 sentences.
- Every evidence citation must reference a real category of source: a peer-reviewed study, a historical precedent, a policy framework, or a published report. Never vague.
- Experts must DIRECTLY RESPOND to the prior speaker — agree partially, challenge a specific word, or concede a point.
- At least one expert must revise their initial stance after hearing counterarguments.
- Avoid AI-assistant language like "certainly", "absolutely", "great point". Experts are confident professionals.

STRICT RULES FOR THE MODERATOR:
- Opens the debate with a precise framing of the motion and what the panel will decide.
- Is neutral but sharp — surfaces the core tension in one sentence.

STRICT RULES FOR THE ARGUMENT GRAPH:
- Each node should represent a factual or normative CLAIM made in the debate (not just a topic heading).
- Status must reflect the current debate state: "supported" if backed with unchallenged evidence, "contested" if challenged, "revised" if an expert updated their position.
- Confidence scores should reflect how strongly the evidence supports the node.

STRICT RULES FOR THE BRIEF:
- The strongest position must be one that can be defended even if challenged.
- The weakest assumption is the most vulnerable premise in the debate.
- The unresolved disagreement must be something the panel genuinely could not resolve.
- The next question must be something a researcher could actually investigate.

DO NOT impersonate real people. Use fictional expert names with real disciplines."""


def create_debate_session(request: DebateRequest) -> DebateSession:
    if not os.getenv("OPENAI_API_KEY"):
        return build_demo_debate(request)

    try:
        payload = _call_openai(
            user_prompt=(
                f"Topic: {request.topic}\n"
                f"Format: {request.format}\n\n"
                "Build a high-quality expert debate for this topic.\n"
                "Requirements:\n"
                "- Generate 5 diverse experts whose disciplines are ideal for this specific question.\n"
                "- Each expert should have a name, clear role, and a distinct initial stance.\n"
                "- The moderator turn must frame the central tension of the debate in one sharp sentence.\n"
                "- Expert turns should directly respond to each other, not speak in isolation.\n"
                "- At least one expert must challenge a prior claim using a specific piece of evidence.\n"
                "- At least one expert must revise their position after hearing a counterargument.\n"
                "- The argument graph nodes must represent actual claims made, not just topic labels.\n"
                "- The moderator brief must be analytically sharp and use domain-specific language."
            )
        )
        return _session_from_payload(payload, request)
    except Exception as e:
        print(f"Error calling OpenAI API (falling back to demo mode): {e}")
        traceback.print_exc()
        return build_demo_debate(request)


def apply_debate_intervention(request: InterventionRequest) -> DebateSession:
    if not os.getenv("OPENAI_API_KEY"):
        return build_demo_intervention(request)

    try:
        payload = _call_openai(
            user_prompt=(
                f"Current debate session (JSON):\n{request.session.model_dump_json()}\n\n"
                f"User intervention: {request.instruction}\n\n"
                "Apply this intervention to the debate. Requirements:\n"
                "- Add 1-2 new turns that directly respond to the intervention instruction.\n"
                "- Route the intervention to the correct speaker(s) based on the instruction.\n"
                "- If the intervention challenges a position, show the challenged expert either defending or revising their claim.\n"
                "- Update the argument graph: change node statuses and confidence scores to reflect the new state of the debate.\n"
                "- Rewrite the moderator brief to reflect the updated consensus, revised positions, and sharpest remaining disagreement.\n"
                "- Do not repeat claims already made. Build on what came before."
            )
        )
        updated = _session_from_payload(
            payload,
            DebateRequest(topic=request.session.topic, format=request.session.format),
        )
        updated.id = request.session.id
        return updated
    except Exception as e:
        print(f"Error applying intervention via OpenAI API (falling back to demo mode): {e}")
        traceback.print_exc()
        return build_demo_intervention(request)


def _call_openai(user_prompt: str) -> dict[str, Any]:
    client = OpenAI()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
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
