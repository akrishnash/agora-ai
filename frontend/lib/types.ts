export type DebateFormat = "Oxford" | "Scientific Review" | "Supreme Court" | "Boardroom";
export type Stance = "support" | "oppose" | "mixed";
export type Relation = "opens" | "supports" | "challenges" | "revises";
export type SessionMode = "demo" | "openai";

// Derived on the client by the graph engine — not sent by the API.
export type NodeStatus = "open" | "supported" | "contested" | "revised";

export type Expert = {
  id: string;
  name: string;
  role: string;
  stance: Stance;
  confidence: number;
};

export type DebateTurn = {
  id: string;
  speaker_id: string;
  headline: string;
  claim: string;
  evidence: string;
  relation: Relation;
  target_id: string | null;
  confidence: number;
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
  brief: ModeratorBrief;
  mode: SessionMode;
};
