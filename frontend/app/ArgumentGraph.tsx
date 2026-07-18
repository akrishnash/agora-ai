"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { CheckCircle2, Flame, Gavel, RefreshCw } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { getCredentialCode, getSpeakerTitle } from "@/lib/credentials";
import { deriveGraph, type AgoraNode, type ClaimNode as ClaimNodeType, type LaneNode as LaneNodeType } from "@/lib/graph";
import type { DebateSession } from "@/lib/types";
import styles from "./ArgumentGraph.module.css";

function signalLabel(value: number) {
  if (value >= 75) return "High";
  if (value >= 50) return "Medium";
  return "Low";
}

const STATUS_LABEL = {
  open: "Framing",
  supported: "Supported",
  contested: "Contested",
  revised: "Revised",
} as const;

const REL = {
  opens: Gavel,
  supports: CheckCircle2,
  challenges: Flame,
  revises: RefreshCw,
} as const;

/** A speaker's lane — pinned avatar + name on the left, faint band across. */
const LaneNode = memo(function LaneNode({ data }: NodeProps<LaneNodeType>) {
  const stance = data.isModerator ? "mod" : data.expert?.stance ?? "mixed";
  return (
    <div
      className={styles.lane}
      data-active={data.active ? "true" : "false"}
      style={{ width: data.width, height: data.height }}
    >
      <div className={styles.laneRail} data-stance={stance}>
        <div className={styles.laneAvatar} data-stance={stance}>
          {getCredentialCode(data.expert?.role, data.isModerator)}
        </div>
        <div className={styles.laneWho}>
          <span className={styles.laneName}>{getSpeakerTitle(data.expert?.role, data.isModerator)}</span>
          <span className={styles.laneRole}>{getCredentialCode(data.expert?.role, data.isModerator)} credential</span>
        </div>
        {data.active && <span className={styles.laneSpeaking}>speaking</span>}
      </div>
    </div>
  );
});

/** A single claim spoken by one person, in that person's lane. */
const ClaimNode = memo(function ClaimNode({ data }: NodeProps<ClaimNodeType>) {
  const RelIcon = REL[data.relation];

  return (
    <div
      className={styles.node}
      data-status={data.status}
      data-newest={data.isNewest ? "true" : "false"}
      data-active={data.isActive ? "true" : "false"}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.nodeHead}>
        <span className={styles.order}>{data.order}</span>
        <span className={styles.headName}>{getSpeakerTitle(data.expert?.role, data.isModerator)}</span>
        <div className={styles.relBadge} data-rel={data.relation}>
          <RelIcon size={10} />
        </div>
      </div>

      <p className={styles.headline}>{data.headline}</p>

      <div className={styles.meter}>
        <div className={styles.track}>
          <div className={styles.fill} data-status={data.status} style={{ width: `${data.confidence}%` }} />
        </div>
        <span className={styles.conf}>{signalLabel(data.confidence)}</span>
      </div>

      <div className={styles.nodeFoot}>
        <span className={styles.statusPill} data-status={data.status}>
          {STATUS_LABEL[data.status]}
        </span>
        {data.delta !== 0 && (
          <span className={styles.delta} data-dir={data.delta < 0 ? "down" : "up"}>
            {data.delta < 0 ? "▼" : "▲"} shift
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
});

const NODE_TYPES = { claim: ClaimNode, lane: LaneNode } as unknown as NodeTypes;

function GraphInner({
  session,
  visibleCount,
  activeSpeakerId,
}: {
  session: DebateSession;
  visibleCount: number;
  activeSpeakerId: string | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgoraNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = deriveGraph(session, visibleCount, activeSpeakerId);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [session, visibleCount, activeSpeakerId, setNodes, setEdges]);

  // Fit only once the new nodes are measured — avoids the empty/clipped-graph race.
  useEffect(() => {
    if (!initialized) return;
    const id = requestAnimationFrame(() => rf.fitView({ padding: 0.16, duration: 400, maxZoom: 1.1 }));
    return () => cancelAnimationFrame(id);
  }, [initialized, nodes, rf]);

  // Re-fit on canvas resize (e.g. the decision brief expands beneath it).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => rf.fitView({ padding: 0.16, maxZoom: 1.1, duration: 200 }), 130);
    });
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [rf]);

  return (
    <div ref={wrapRef} className={styles.flowWrap}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={1.6}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className={styles.flow}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(13,13,13,0.06)" />
        <Controls showInteractive={false} className={styles.controls} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export default function ArgumentGraph(props: {
  session: DebateSession;
  visibleCount: number;
  activeSpeakerId: string | null;
}) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
