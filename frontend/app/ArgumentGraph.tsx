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
} from "@xyflow/react";
import { CheckCircle2, Flame, Gavel, RefreshCw } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { deriveGraph, type ClaimNode as ClaimNodeType } from "@/lib/graph";
import type { DebateSession } from "@/lib/types";
import styles from "./ArgumentGraph.module.css";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
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

const ClaimNode = memo(function ClaimNode({ data }: NodeProps<ClaimNodeType>) {
  const RelIcon = REL[data.relation];
  const stance = data.isModerator ? "mod" : data.expert?.stance ?? "mixed";

  return (
    <div className={styles.node} data-status={data.status} data-newest={data.isNewest ? "true" : "false"}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.nodeHead}>
        <div className={styles.avatar} data-stance={stance}>
          {data.isModerator ? "AG" : getInitials(data.expert?.name ?? "??")}
        </div>
        <div className={styles.who}>
          <span className={styles.name}>
            {data.isModerator ? "Moderator" : data.expert?.name ?? "Expert"}
          </span>
          <span className={styles.role}>
            {data.isModerator ? "Agora" : data.expert?.role ?? ""}
          </span>
        </div>
        <div className={styles.relBadge} data-rel={data.relation}>
          <RelIcon size={11} />
        </div>
      </div>

      <p className={styles.headline}>{data.headline}</p>

      <div className={styles.meter}>
        <div className={styles.track}>
          <div className={styles.fill} data-status={data.status} style={{ width: `${data.confidence}%` }} />
        </div>
        <span className={styles.conf}>{data.confidence}%</span>
      </div>

      <div className={styles.nodeFoot}>
        <span className={styles.statusPill} data-status={data.status}>
          {STATUS_LABEL[data.status]}
        </span>
        {data.delta !== 0 && (
          <span className={styles.delta} data-dir={data.delta < 0 ? "down" : "up"}>
            {data.delta < 0 ? "▼" : "▲"} {Math.abs(data.delta)}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
});

const NODE_TYPES = { claim: ClaimNode };

function GraphInner({ session, visibleCount }: { session: DebateSession; visibleCount: number }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ClaimNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = deriveGraph(session, visibleCount);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [session, visibleCount, setNodes, setEdges]);

  // Fit only once the new nodes are actually measured — otherwise React Flow
  // fits to zero-size nodes and pans the whole graph off-screen.
  useEffect(() => {
    if (!initialized) return;
    const id = requestAnimationFrame(() =>
      rf.fitView({ padding: 0.2, duration: 400, maxZoom: 1.15 })
    );
    return () => cancelAnimationFrame(id);
  }, [initialized, nodes, rf]);

  // Re-fit when the canvas resizes (e.g. the decision brief expands beneath it).
  // Debounced trailing fit so we settle on the FINAL size, not mid-animation.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1.15, duration: 200 }), 130);
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
        fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className={styles.flow}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148,163,184,0.12)" />
        <Controls showInteractive={false} className={styles.controls} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export default function ArgumentGraph(props: { session: DebateSession; visibleCount: number }) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
