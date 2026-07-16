export type DebateFormat = "Oxford" | "Scientific Review" | "Supreme Court" | "Boardroom";
export type Stance = "support" | "oppose" | "mixed";
export type Relation = "opens" | "supports" | "challenges" | "revises";
export type NodeStatus = "supported" | "contested" | "revised";
export type SessionMode = "demo" | "openai";

export type Expert = {
  id: string;
  name: string;
  role: string;
  stance: Stance;
  confidence: number;
};

export type DebateTurn = {
  speaker_id: string;
  claim: string;
  evidence: string;
  relation: Relation;
};

export type ClaimNode = {
  label: string;
  confidence: number;
  status: NodeStatus;
};

export type ModeratorBrief = {
  strongest_position: string;
  weakest_assumption: string;
  unresolved_disagreement: string;
  next_question: string;
};

export type DebateSession = {
  id: string;
  topic: string;
  format: DebateFormat;
  experts: Expert[];
  turns: DebateTurn[];
  graph: ClaimNode[];
  brief: ModeratorBrief;
  mode: SessionMode;
};
