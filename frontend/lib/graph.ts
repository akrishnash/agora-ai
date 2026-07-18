import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DebateSession, Expert, NodeStatus, Relation } from "./types";

export type ClaimNodeData = {
  headline: string;
  claim: string;
  evidence: string;
  relation: Relation;
  expert: Expert | null;
  isModerator: boolean;
  confidence: number; // current, after dynamics
  baseConfidence: number; // as first stated
  delta: number; // current - base
  status: NodeStatus;
  isNewest: boolean;
  isActive: boolean; // speaker is the one currently talking
  order: number; // 1-based turn order (conversation step)
};

export type LaneData = {
  speakerId: string;
  expert: Expert | null;
  isModerator: boolean;
  active: boolean;
  width: number;
  height: number;
};

export type ClaimNode = Node<ClaimNodeData, "claim">;
export type LaneNode = Node<LaneData, "lane">;
export type AgoraNode = ClaimNode | LaneNode;

// Layout + dynamics tuning
const RAIL_W = 152; // left rail where each speaker's avatar/name sits
const TURN_DX = 224; // horizontal step between consecutive turns (time →)
const LANE_H = 122; // vertical height of each speaker lane
const CARD_H = 92;
const CARD_Y = (LANE_H - CARD_H) / 2;
const CHALLENGE_PENALTY = 24;
const SUPPORT_BOOST = 6;
const MIN_CONF = 16;
const MAX_CONF = 98;

const RELATION_COLOR: Record<Relation, string> = {
  opens: "#6e6e80",
  supports: "#10a37f",
  challenges: "#d1453b",
  revises: "#c2760a",
};

/**
 * Derive the argument graph from the first `visibleCount` turns.
 *
 * Layout is a **conversation**: one horizontal lane per speaker, and each turn
 * is placed at (chronological column, speaker lane). Reading left-to-right you
 * watch the discussion move from one person to the next; the colored edges show
 * who is answering whom, and challenges/supports/revisions propagate confidence
 * onto earlier nodes so the graph reacts live. Pure function of
 * (session, visibleCount, activeSpeakerId) — which is what powers the scrubber.
 */
export function deriveGraph(
  session: DebateSession,
  visibleCount: number,
  activeSpeakerId?: string | null
): { nodes: AgoraNode[]; edges: Edge[] } {
  const turns = session.turns.slice(0, Math.max(0, visibleCount));
  if (turns.length === 0) return { nodes: [], edges: [] };

  const expertById = new Map(session.experts.map((e) => [e.id, e]));
  const byId = new Map(turns.map((t) => [t.id, t]));
  const absIndex = new Map(session.turns.map((t, i) => [t.id, i]));

  // Lane order = order in which each speaker first appears across the whole debate,
  // so a speaker's row stays put even before/after they talk.
  const laneOf = new Map<string, number>();
  for (const t of session.turns) {
    if (!laneOf.has(t.speaker_id)) laneOf.set(t.speaker_id, laneOf.size);
  }

  // 1) Confidence + status dynamics, applied turn by turn.
  const conf = new Map<string, number>();
  const status = new Map<string, NodeStatus>();
  for (const t of turns) {
    conf.set(t.id, t.confidence);
    status.set(t.id, t.relation === "opens" ? "open" : "supported");
    if (t.target_id && conf.has(t.target_id)) {
      const prev = conf.get(t.target_id) ?? 60;
      if (t.relation === "challenges") {
        conf.set(t.target_id, Math.max(MIN_CONF, prev - CHALLENGE_PENALTY));
        if (status.get(t.target_id) !== "revised") status.set(t.target_id, "contested");
      } else if (t.relation === "revises") {
        status.set(t.target_id, "revised");
        conf.set(t.target_id, Math.max(MIN_CONF, prev - 8));
      } else if (t.relation === "supports") {
        conf.set(t.target_id, Math.min(MAX_CONF, prev + SUPPORT_BOOST));
      }
    }
  }

  const newestId = turns[turns.length - 1].id;
  const laneWidth = RAIL_W + turns.length * TURN_DX + 24;

  // 2) Lane background nodes (one per speaker that has spoken).
  const speakersSeen = new Map<string, string>(); // speakerId -> first turn id
  for (const t of turns) if (!speakersSeen.has(t.speaker_id)) speakersSeen.set(t.speaker_id, t.id);

  const laneNodes: LaneNode[] = [...speakersSeen.keys()].map((speakerId) => {
    const lane = laneOf.get(speakerId) ?? 0;
    const isModerator = speakerId === "moderator";
    return {
      id: `lane-${speakerId}`,
      type: "lane",
      position: { x: 0, y: lane * LANE_H },
      data: {
        speakerId,
        expert: expertById.get(speakerId) ?? null,
        isModerator,
        active: speakerId === activeSpeakerId,
        width: laneWidth,
        height: LANE_H,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
      style: { width: laneWidth, height: LANE_H },
    };
  });

  // 3) Claim nodes at (chronological column, speaker lane).
  const claimNodes: ClaimNode[] = turns.map((t) => {
    const lane = laneOf.get(t.speaker_id) ?? 0;
    const col = absIndex.get(t.id) ?? 0;
    const current = conf.get(t.id) ?? t.confidence;
    return {
      id: t.id,
      type: "claim",
      position: { x: RAIL_W + col * TURN_DX, y: lane * LANE_H + CARD_Y },
      zIndex: 1,
      data: {
        headline: t.headline,
        claim: t.claim,
        evidence: t.evidence,
        relation: t.relation,
        expert: expertById.get(t.speaker_id) ?? null,
        isModerator: t.speaker_id === "moderator",
        confidence: current,
        baseConfidence: t.confidence,
        delta: current - t.confidence,
        status: status.get(t.id) ?? "supported",
        isNewest: t.id === newestId,
        isActive: t.speaker_id === activeSpeakerId,
        order: col + 1,
      },
    };
  });

  // 4) Edges: each turn → the earlier claim it answers, colored by relation.
  const edges: Edge[] = turns
    .filter((t) => t.target_id && byId.has(t.target_id))
    .map((t) => {
      const color = RELATION_COLOR[t.relation];
      const isNew = t.id === newestId;
      return {
        id: `${t.target_id}-${t.id}`,
        source: t.target_id!,
        target: t.id,
        type: "default",
        animated: isNew,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        style: {
          stroke: color,
          strokeWidth: isNew ? 2.4 : 1.6,
          opacity: t.relation === "challenges" ? 0.9 : 0.62,
        },
        zIndex: 2,
      };
    });

  return { nodes: [...laneNodes, ...claimNodes], edges };
}

/** Live headline metrics for the progress bar (derived, moves with the debate). */
export function summarizeGraph(
  session: DebateSession,
  visibleCount: number
): { claims: number; convergence: number; contested: number; revised: number } {
  const { nodes } = deriveGraph(session, visibleCount);
  const claimNodes = nodes.filter(
    (n): n is ClaimNode => n.type === "claim" && !(n.data as ClaimNodeData).isModerator
  );
  const convergence = claimNodes.length
    ? Math.round(claimNodes.reduce((s, n) => s + n.data.confidence, 0) / claimNodes.length)
    : 0;
  const claimAll = nodes.filter((n): n is ClaimNode => n.type === "claim");
  return {
    claims: claimNodes.length,
    convergence,
    contested: claimAll.filter((n) => n.data.status === "contested").length,
    revised: claimAll.filter((n) => n.data.status === "revised").length,
  };
}
