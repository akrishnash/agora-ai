from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


DebateFormat = Literal["Oxford", "Scientific Review", "Supreme Court", "Boardroom"]
Stance = Literal["support", "oppose", "mixed"]
Relation = Literal["opens", "supports", "challenges", "revises"]
NodeStatus = Literal["supported", "contested", "revised"]


class DebateRequest(BaseModel):
    topic: str = Field(min_length=8, max_length=240)
    format: DebateFormat = "Oxford"


class Expert(BaseModel):
    id: str
    name: str
    role: str
    stance: Stance
    confidence: int = Field(ge=0, le=100)


class DebateTurn(BaseModel):
    speaker_id: str
    claim: str
    evidence: str
    relation: Relation


class ClaimNode(BaseModel):
    label: str
    confidence: int = Field(ge=0, le=100)
    status: NodeStatus


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
    graph: list[ClaimNode]
    brief: ModeratorBrief
