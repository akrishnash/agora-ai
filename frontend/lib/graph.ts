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
  turnIndex: number;
};

export type ClaimNode = Node<ClaimNodeData, "claim">;

// Layout + dynamics tuning
const COL_W = 300;
const ROW_H = 168;
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
 * Pure function of (session, visibleCount) — which is what makes the timeline
 * scrubber work: any point in the debate re-derives exactly. Each turn is a
 * node; its `target_id` is an edge colored by the relation; and challenges /
 * supports / revisions propagate confidence and status onto earlier nodes so
 * the graph visibly reacts as the debate unfolds.
 */
export function deriveGraph(
  session: DebateSession,
  visibleCount: number
): { nodes: ClaimNode[]; edges: Edge[] } {
  const turns = session.turns.slice(0, Math.max(0, visibleCount));
  if (turns.length === 0) return { nodes: [], edges: [] };

  const expertById = new Map(session.experts.map((e) => [e.id, e]));
  const byId = new Map(turns.map((t) => [t.id, t]));

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

  // 2) Depth from root (for a left-to-right layered layout).
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    const t = byId.get(id);
    if (!t || !t.target_id || !byId.has(t.target_id) || seen.has(id)) {
      depth.set(id, 0);
      return 0;
    }
    seen.add(id);
    const d = depthOf(t.target_id, seen) + 1;
    depth.set(id, d);
    return d;
  };
  turns.forEach((t) => depthOf(t.id));

  // 3) Position: column = depth, stacked vertically and centered per column.
  const columns = new Map<number, string[]>();
  turns.forEach((t) => {
    const d = depth.get(t.id)!;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(t.id);
  });
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((ids, d) => {
    const n = ids.length;
    ids.forEach((id, i) => {
      pos.set(id, { x: d * COL_W, y: (i - (n - 1) / 2) * ROW_H });
    });
  });

  const newestId = turns[turns.length - 1].id;

  const nodes: ClaimNode[] = turns.map((t) => {
    const current = conf.get(t.id) ?? t.confidence;
    return {
      id: t.id,
      type: "claim",
      position: pos.get(t.id) ?? { x: 0, y: 0 },
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
        turnIndex: t.id.startsWith("t") ? Number(t.id.slice(1)) : 0,
      },
    };
  });

  const edges: Edge[] = turns
    .filter((t) => t.target_id && byId.has(t.target_id))
    .map((t) => {
      const color = RELATION_COLOR[t.relation];
      const isNew = t.id === newestId;
      return {
        id: `${t.target_id}-${t.id}`,
        source: t.target_id!,
        target: t.id,
        type: "smoothstep",
        animated: isNew,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        style: {
          stroke: color,
          strokeWidth: isNew ? 2.4 : 1.6,
          opacity: t.relation === "challenges" ? 0.9 : 0.65,
        },
      };
    });

  return { nodes, edges };
}

/** Live headline metrics for the progress bar (derived, moves with the debate). */
export function summarizeGraph(
  session: DebateSession,
  visibleCount: number
): { claims: number; consensus: number; contested: number; revised: number } {
  const { nodes } = deriveGraph(session, visibleCount);
  const claimNodes = nodes.filter((n) => !n.data.isModerator);
  const consensus = claimNodes.length
    ? Math.round(claimNodes.reduce((s, n) => s + n.data.confidence, 0) / claimNodes.length)
    : 0;
  return {
    claims: claimNodes.length,
    consensus,
    contested: nodes.filter((n) => n.data.status === "contested").length,
    revised: nodes.filter((n) => n.data.status === "revised").length,
  };
}
