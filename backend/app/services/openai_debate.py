import json
import os
import time
import traceback
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

from openai import OpenAI

from app.models import (
    DebateRequest,
    DebateSession,
    DebateTurn,
    EvidenceSource,
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
                    "sources",
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
                    "sources": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["label", "source_type", "relevance"],
                            "properties": {
                                "label": {"type": "string"},
                                "source_type": {"type": "string"},
                                "relevance": {"type": "string"},
                            },
                        },
                    },
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

PANEL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["experts"],
    "properties": {
        "experts": SESSION_SCHEMA["properties"]["experts"],
    },
}

TURN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "speaker_id",
        "headline",
        "claim",
        "evidence",
        "sources",
        "relation",
        "target_id",
        "confidence",
    ],
    "properties": {
        key: value
        for key, value in SESSION_SCHEMA["properties"]["turns"]["items"]["properties"].items()
        if key != "id"
    },
}

BRIEF_SCHEMA: dict[str, Any] = SESSION_SCHEMA["properties"]["brief"]

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
- sources: 1-2 compact evidence leads. Use named public frameworks, reports, historical precedents, \
or research categories you would inspect next. Do not invent URLs or paper titles.
- confidence: 0-100, how strongly this claim is held.
- At least one turn must "challenge" another, and at least one expert must "revise" after being \
challenged. Avoid assistant-speak ("certainly", "great point"); these are confident professionals.

BRIEF:
- strongest_position: defensible even under challenge.
- weakest_assumption: the most vulnerable premise raised.
- unresolved_disagreement: something the panel genuinely could not settle.
- next_question: something a researcher could actually investigate next."""


def create_debate_session(request: DebateRequest) -> DebateSession:
    if request.demo_only or not os.getenv("OPENAI_API_KEY"):
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


def create_debate_stream_events(request: DebateRequest) -> Iterator[dict[str, Any]]:
    if request.demo_only or not os.getenv("OPENAI_API_KEY"):
        yield from _demo_stream_events(request)
        return

    try:
        yield from _openai_turn_stream_events(request)
    except Exception as e:
        print(f"Error streaming OpenAI debate (falling back to demo stream): {e}")
        traceback.print_exc()
        yield {"type": "error", "message": "Live turn generation failed; switching to deterministic replay."}
        yield from _demo_stream_events(request)


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
                "- Rewrite the brief to reflect the updated convergence and sharpest remaining disagreement.\n"
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
    return _call_openai_schema(user_prompt, "debate_session", SESSION_SCHEMA)


def _call_openai_schema(user_prompt: str, name: str, schema: dict[str, Any]) -> dict[str, Any]:
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
                "name": name,
                "schema": schema,
                "strict": True,
            }
        },
    )
    return json.loads(response.output_text)


def _placeholder_brief() -> ModeratorBrief:
    return ModeratorBrief(
        strongest_position="Debate in progress.",
        weakest_assumption="Debate in progress.",
        unresolved_disagreement="Debate in progress.",
        next_question="Debate in progress.",
    )


def _event_payload(event_type: str, **payload: Any) -> dict[str, Any]:
    return {"type": event_type, **payload}


def _demo_stream_events(request: DebateRequest) -> Iterator[dict[str, Any]]:
    demo = build_demo_debate(request)
    session = demo.model_copy(update={"turns": [], "brief": _placeholder_brief()})
    yield _event_payload("session", session=session.model_dump(mode="json"))
    for turn in demo.turns:
        time.sleep(0.45)
        yield _event_payload("turn", turn=turn.model_dump(mode="json"))
    yield _event_payload("brief", brief=demo.brief.model_dump(mode="json"))
    yield _event_payload("done")


def _sanitize_experts(raw_experts: Any) -> list[Expert]:
    if not isinstance(raw_experts, list):
        return []

    experts: list[Expert] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_experts[:5]):
        if not isinstance(raw, dict):
            continue
        raw_id = str(raw.get("id") or f"expert_{index + 1}").strip().lower().replace(" ", "_")
        expert_id = raw_id or f"expert_{index + 1}"
        if expert_id in seen:
            expert_id = f"{expert_id}_{index + 1}"
        seen.add(expert_id)
        stance = raw.get("stance")
        experts.append(
            Expert(
                id=expert_id,
                name=str(raw.get("name") or f"Expert {index + 1}")[:80],
                role=str(raw.get("role") or "Domain Expert")[:120],
                stance=stance if stance in ("support", "oppose", "mixed") else "mixed",
                confidence=_clamp_confidence(raw.get("confidence")),
            )
        )

    return experts


def _fallback_experts() -> list[Expert]:
    return [
        Expert(id="safety", name="Dr. Mira Chen", role="AI Safety Researcher", stance="mixed", confidence=71),
        Expert(id="open", name="Rafael Okafor", role="Open-Source Advocate", stance="support", confidence=84),
        Expert(id="security", name="Anika Rao", role="Security Researcher", stance="oppose", confidence=79),
        Expert(id="economist", name="Prof. Elias Grant", role="Innovation Economist", stance="support", confidence=67),
        Expert(id="policy", name="Leah Moretti", role="Technology Policy Lawyer", stance="mixed", confidence=73),
    ]


def _pick_expert(experts: list[Expert], stance: str, fallback_index: int) -> Expert:
    return next((expert for expert in experts if expert.stance == stance), experts[fallback_index % len(experts)])


def _turn_directive(index: int, experts: list[Expert], turns: list[DebateTurn]) -> dict[str, str | None]:
    if index == 0:
        return {"speaker_id": "moderator", "relation": "opens", "target_id": None}
    if index == 1:
        return {"speaker_id": _pick_expert(experts, "support", 0).id, "relation": "supports", "target_id": "t0"}
    if index == 2:
        return {"speaker_id": _pick_expert(experts, "oppose", 1).id, "relation": "challenges", "target_id": "t1"}
    if index == 3:
        return {"speaker_id": experts[2 % len(experts)].id, "relation": "supports", "target_id": "t1"}
    if index == 4:
        return {"speaker_id": _pick_expert(experts, "mixed", 3).id, "relation": "revises", "target_id": "t2"}
    return {"speaker_id": experts[4 % len(experts)].id, "relation": "challenges", "target_id": turns[-1].id if turns else "t0"}


def _sanitize_single_turn(
    raw: dict[str, Any],
    index: int,
    experts: list[Expert],
    turns: list[DebateTurn],
    directive: dict[str, str | None],
) -> DebateTurn:
    expert_ids = {expert.id for expert in experts}
    speaker_id = str(raw.get("speaker_id") or directive["speaker_id"])
    if index == 0:
        speaker_id = "moderator"
    elif speaker_id not in expert_ids:
        speaker_id = str(directive["speaker_id"])

    relation = raw.get("relation") or directive["relation"]
    if index == 0:
        relation = "opens"
    elif relation not in ("supports", "challenges", "revises"):
        relation = directive["relation"] or "supports"

    prior_ids = {turn.id for turn in turns}
    target_id = raw.get("target_id")
    if index == 0:
        target_id = None
    elif target_id not in prior_ids:
        target_id = directive["target_id"] if directive["target_id"] in prior_ids else turns[-1].id

    headline = str(raw.get("headline") or raw.get("claim") or "Claim").strip()[:120] or "Claim"
    return DebateTurn(
        id=f"t{index}",
        speaker_id=speaker_id,
        headline=headline,
        claim=str(raw.get("claim") or headline).strip(),
        evidence=str(raw.get("evidence") or "").strip(),
        sources=_sanitize_sources(raw.get("sources")),
        relation=relation,
        target_id=target_id,
        confidence=_clamp_confidence(raw.get("confidence"), 50 if index == 0 else 65),
    )


def _openai_turn_stream_events(request: DebateRequest) -> Iterator[dict[str, Any]]:
    panel_payload = _call_openai_schema(
        user_prompt=(
            f"Topic: {request.topic}\n"
            f"Format: {request.format}\n\n"
            "Create exactly 5 fictional experts for this specific question. Return only experts. "
            "Use compact lowercase ids suitable for JSON references."
        ),
        name="expert_panel",
        schema=PANEL_SCHEMA,
    )
    experts = _sanitize_experts(panel_payload.get("experts")) or _fallback_experts()
    session = DebateSession(
        id=uuid4(),
        topic=request.topic,
        format=request.format,
        experts=experts,
        turns=[],
        brief=_placeholder_brief(),
        mode="openai",
    )
    yield _event_payload("session", session=session.model_dump(mode="json"))

    turns: list[DebateTurn] = []
    for index in range(6):
        directive = _turn_directive(index, experts, turns)
        turn_payload = _call_openai_schema(
            user_prompt=(
                f"Topic: {request.topic}\n"
                f"Format: {request.format}\n"
                f"Experts JSON: {[expert.model_dump() for expert in experts]}\n"
                f"Prior turns JSON: {[turn.model_dump() for turn in turns]}\n\n"
                f"Generate ONLY turn t{index}. This is a turn-by-turn debate, so condition "
                "your claim on the prior turns above.\n"
                f"- speaker_id must be {directive['speaker_id']}.\n"
                f"- relation must be {directive['relation']}.\n"
                f"- target_id must be {directive['target_id']}.\n"
                "- Do not summarize the whole debate. Make one concrete move."
            ),
            name="debate_turn",
            schema=TURN_SCHEMA,
        )
        turn = _sanitize_single_turn(turn_payload, index, experts, turns, directive)
        turns.append(turn)
        yield _event_payload("turn", turn=turn.model_dump(mode="json"))

    brief_payload = _call_openai_schema(
        user_prompt=(
            f"Topic: {request.topic}\n"
            f"Experts JSON: {[expert.model_dump() for expert in experts]}\n"
            f"Turns JSON: {[turn.model_dump() for turn in turns]}\n\n"
            "Write the final moderator brief from these already-generated turns. "
            "Do not add new claims; synthesize only what the panel actually argued."
        ),
        name="moderator_brief",
        schema=BRIEF_SCHEMA,
    )
    brief = ModeratorBrief(**brief_payload)
    yield _event_payload("brief", brief=brief.model_dump(mode="json"))
    yield _event_payload("done")


def _clamp_confidence(value: Any, default: int = 60) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return default


def _sanitize_sources(raw_sources: Any) -> list[EvidenceSource]:
    if not isinstance(raw_sources, list):
        return []

    sources: list[EvidenceSource] = []
    for raw in raw_sources[:2]:
        if not isinstance(raw, dict):
            continue
        label = str(raw.get("label", "")).strip()[:120]
        source_type = str(raw.get("source_type", "")).strip()[:60]
        relevance = str(raw.get("relevance", "")).strip()[:180]
        if label and source_type and relevance:
            sources.append(
                EvidenceSource(
                    label=label,
                    source_type=source_type,
                    relevance=relevance,
                )
            )
    return sources


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
                sources=_sanitize_sources(raw.get("sources")),
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
