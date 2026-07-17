import json
import os
import traceback
from typing import Any
from uuid import uuid4

from openai import OpenAI

from app.models import (
    DebateRequest,
    DebateSession,
    DebateTurn,
    Expert,
    InterventionRequest,
    ModeratorBrief,
)
from app.services.demo_debate import build_demo_debate, build_demo_intervention

# Kept permissive on purpose: numeric/string bounds and array-size limits are not
# reliably honored across all models in strict mode, so we validate/clamp in Python
# (see _sanitize_payload) rather than risk a schema rejection mid-demo.
SESSION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["experts", "turns", "brief"],
    "properties": {
        "experts": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "name", "role", "stance", "confidence"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "stance": {"type": "string", "enum": ["support", "oppose", "mixed"]},
                    "confidence": {"type": "integer"},
                },
            },
        },
        "turns": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "id",
                    "speaker_id",
                    "headline",
                    "claim",
                    "evidence",
                    "relation",
                    "target_id",
                    "confidence",
                ],
                "properties": {
                    "id": {"type": "string"},
                    "speaker_id": {"type": "string"},
                    "headline": {"type": "string"},
                    "claim": {"type": "string"},
                    "evidence": {"type": "string"},
                    "relation": {
                        "type": "string",
                        "enum": ["opens", "supports", "challenges", "revises"],
                    },
                    "target_id": {"type": ["string", "null"]},
                    "confidence": {"type": "integer"},
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

You produce a structured expert debate that feels LIVE, SMART, and genuinely contentious. \
The debate is rendered as a growing ARGUMENT GRAPH: every turn is a node, and every turn \
(except the opening) points to the earlier claim it responds to. Get the structure right.

EXPERTS (exactly 5):
- Each expert speaks from a specific discipline ideal for THIS question (e.g. biosecurity, \
innovation economics, constitutional law, epidemiology, AI safety).
- Give each a fictional name, a crisp role, an initial stance (support / oppose / mixed), \
and an initial confidence 0-100. Never impersonate real people.

TURNS (6, forming the graph):
- id: "t0", "t1", "t2", ... in order.
- The FIRST turn is the moderator: speaker_id "moderator", relation "opens", target_id null. \
It frames the central tension of the motion in one sharp sentence.
- Every later turn is spoken by one of the experts (speaker_id = that expert's id) and MUST set \
target_id to the id of an EARLIER turn it directly answers.
- relation is how this turn relates to its target: "supports", "challenges", or "revises".
- headline: a punchy 4-8 word label for the node (this is what shows in the graph).
- claim: the full argument, decisive, under 3 sentences, directly engaging the target turn — \
agree and extend, challenge a specific word, or concede and revise.
- evidence: reference a real CATEGORY of source (peer-reviewed study, historical precedent, \
policy framework, published report). Never vague.
- confidence: 0-100, how strongly this claim is held.
- At least one turn must "challenge" another, and at least one expert must "revise" after being \
challenged. Avoid assistant-speak ("certainly", "great point"); these are confident professionals.

BRIEF:
- strongest_position: defensible even under challenge.
- weakest_assumption: the most vulnerable premise raised.
- unresolved_disagreement: something the panel genuinely could not settle.
- next_question: something a researcher could actually investigate next."""


def create_debate_session(request: DebateRequest) -> DebateSession:
    if not os.getenv("OPENAI_API_KEY"):
        return build_demo_debate(request)

    try:
        payload = _call_openai(
            user_prompt=(
                f"Topic: {request.topic}\n"
                f"Format: {request.format}\n\n"
                "Build a high-quality expert debate for this exact topic, as an argument graph.\n"
                "- 5 experts whose disciplines are ideal for THIS specific question.\n"
                "- Turn t0 is the moderator framing the central tension (target_id null).\n"
                "- Each later turn sets target_id to the earlier turn it answers, with the right relation.\n"
                "- At least one genuine challenge and at least one revision after being challenged.\n"
                "- Headlines are short node labels; claims are sharp and evidence is specific."
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
        existing_ids = [t.id for t in request.session.turns]
        next_index = len(existing_ids)
        payload = _call_openai(
            user_prompt=(
                f"Current debate session (JSON):\n{request.session.model_dump_json()}\n\n"
                f"User intervention: {request.instruction}\n\n"
                "Return the FULL updated debate (same experts, ALL prior turns unchanged, plus new turns).\n"
                f"- Keep every existing turn exactly as-is, including ids {existing_ids}.\n"
                f"- Append 1-2 NEW turns with ids starting at 't{next_index}'.\n"
                "- Route the intervention to the right speaker; set each new turn's target_id to the "
                "existing turn it responds to.\n"
                "- If the intervention challenges a position, show that expert defending or revising it "
                "(use relation 'challenges' then 'revises'), and lower the revised claim's confidence "
                "relative to the original.\n"
                "- Rewrite the brief to reflect the updated consensus and sharpest remaining disagreement.\n"
                "- Do not repeat claims already made; build on what came before."
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


def _clamp_confidence(value: Any, default: int = 60) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return default


def _sanitize_turns(raw_turns: list[dict[str, Any]]) -> list[DebateTurn]:
    """Guarantee a well-formed, fully-connected argument graph.

    Models occasionally emit duplicate ids, dangling target_ids, or an opening
    turn that points somewhere. We rewrite ids to canonical "t{i}", remap each
    target to a real earlier node (falling back to the previous turn), and clamp
    values so the graph always renders.
    """
    canonical: list[DebateTurn] = []
    # Map each raw id (as first seen) to its canonical id.
    id_map: dict[str, str] = {}
    for i, raw in enumerate(raw_turns):
        raw_id = str(raw.get("id", f"t{i}"))
        id_map.setdefault(raw_id, f"t{i}")

    for i, raw in enumerate(raw_turns):
        new_id = f"t{i}"

        # Resolve the target to a valid EARLIER canonical id.
        target: str | None = None
        if i > 0:
            raw_target = raw.get("target_id")
            mapped = id_map.get(str(raw_target)) if raw_target is not None else None
            if mapped is not None and int(mapped[1:]) < i:
                target = mapped
            else:
                target = f"t{i - 1}"  # sensible default: answer the previous turn

        relation = raw.get("relation", "supports")
        if i == 0:
            relation = "opens"
            target = None
        elif relation not in ("supports", "challenges", "revises"):
            relation = "supports"

        headline = str(raw.get("headline") or raw.get("claim", "Claim"))[:120].strip() or "Claim"

        canonical.append(
            DebateTurn(
                id=new_id,
                speaker_id=str(raw.get("speaker_id", "moderator" if i == 0 else "expert")),
                headline=headline,
                claim=str(raw.get("claim", "")).strip() or headline,
                evidence=str(raw.get("evidence", "")).strip(),
                relation=relation,
                target_id=target,
                confidence=_clamp_confidence(raw.get("confidence"), 50 if i == 0 else 65),
            )
        )
    return canonical


def _session_from_payload(payload: dict[str, Any], request: DebateRequest) -> DebateSession:
    experts = [
        Expert(
            id=str(e["id"]),
            name=str(e["name"]),
            role=str(e["role"]),
            stance=e["stance"] if e.get("stance") in ("support", "oppose", "mixed") else "mixed",
            confidence=_clamp_confidence(e.get("confidence")),
        )
        for e in payload["experts"]
    ]
    return DebateSession(
        id=uuid4(),
        topic=request.topic,
        format=request.format,
        experts=experts,
        turns=_sanitize_turns(payload["turns"]),
        brief=ModeratorBrief(**payload["brief"]),
        mode="openai",
    )
