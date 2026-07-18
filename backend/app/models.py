from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


DebateFormat = Literal["Oxford", "Scientific Review", "Supreme Court", "Boardroom"]
Stance = Literal["support", "oppose", "mixed"]
Relation = Literal["opens", "supports", "challenges", "revises"]
SessionMode = Literal["demo", "openai"]


class DebateRequest(BaseModel):
    topic: str = Field(min_length=8, max_length=240)
    format: DebateFormat = "Oxford"
    demo_only: bool = False


class Expert(BaseModel):
    id: str
    name: str
    role: str
    stance: Stance
    confidence: int = Field(ge=0, le=100)


class EvidenceSource(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    source_type: str = Field(min_length=1, max_length=60)
    relevance: str = Field(min_length=1, max_length=180)


class DebateTurn(BaseModel):
    """A single move in the debate.

    Each turn is also a node in the argument graph. ``target_id`` links this
    claim to the prior claim it answers, and ``relation`` colors that edge.
    ``confidence`` is how strongly this claim is held when it is first made;
    the frontend graph engine then propagates confidence as later turns
    support, challenge, or revise earlier nodes.
    """

    id: str
    speaker_id: str
    headline: str = Field(min_length=1, max_length=120)
    claim: str
    evidence: str
    sources: list[EvidenceSource] = Field(default_factory=list)
    relation: Relation
    target_id: Optional[str] = None
    confidence: int = Field(ge=0, le=100)


class ModeratorBrief(BaseModel):
    strongest_position: str
    weakest_assumption: str
    unresolved_disagreement: str
    next_question: str


class DebateSession(BaseModel):
    id: UUID
    topic: str
    format: DebateFormat
    experts: list[Expert]
    turns: list[DebateTurn]
    brief: ModeratorBrief
    mode: SessionMode = "demo"


class InterventionRequest(BaseModel):
    session: DebateSession
    instruction: str = Field(min_length=4, max_length=500)
