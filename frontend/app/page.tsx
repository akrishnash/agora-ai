"use client";

import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Gavel,
  GitBranch,
  MessageSquarePlus,
  Pause,
  Play,
  Scale,
  ShieldAlert,
  Sparkles,
  Vote
} from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Expert = {
  id: string;
  name: string;
  role: string;
  stance: "support" | "oppose" | "mixed";
  confidence: number;
  accent: string;
};

type DebateTurn = {
  speakerId: string;
  claim: string;
  evidence: string;
  relation: "opens" | "supports" | "challenges" | "revises";
};

type ClaimNode = {
  label: string;
  confidence: number;
  status: "supported" | "contested" | "revised";
};

const experts: Expert[] = [
  {
    id: "safety",
    name: "Dr. Mira Chen",
    role: "AI Safety Researcher",
    stance: "mixed",
    confidence: 71,
    accent: "var(--cyan)"
  },
  {
    id: "open",
    name: "Rafael Okafor",
    role: "Open-Source Advocate",
    stance: "support",
    confidence: 84,
    accent: "var(--green)"
  },
  {
    id: "security",
    name: "Anika Rao",
    role: "Security Researcher",
    stance: "oppose",
    confidence: 79,
    accent: "var(--rose)"
  },
  {
    id: "economist",
    name: "Prof. Elias Grant",
    role: "Innovation Economist",
    stance: "support",
    confidence: 67,
    accent: "var(--amber)"
  },
  {
    id: "policy",
    name: "Leah Moretti",
    role: "Technology Policy Lawyer",
    stance: "mixed",
    confidence: 73,
    accent: "var(--violet)"
  }
];

const turns: DebateTurn[] = [
  {
    speakerId: "moderator",
    claim:
      "Motion opened: powerful AI systems should be open source by default unless clear misuse risks are demonstrated.",
    evidence: "Format: expert opening statements, cross-examination, user intervention, final reasoning brief.",
    relation: "opens"
  },
  {
    speakerId: "open",
    claim:
      "Open access improves auditability. More independent researchers can find failure modes before deployment.",
    evidence: "Supported by the history of open cryptography review and reproducible ML safety research.",
    relation: "supports"
  },
  {
    speakerId: "security",
    claim:
      "Capability release is not the same as source transparency. Some model weights can directly lower the cost of misuse.",
    evidence: "Cyber, biosecurity, and persuasion risks scale differently from normal software vulnerabilities.",
    relation: "challenges"
  },
  {
    speakerId: "economist",
    claim:
      "Concentrating frontier systems in a few firms creates market power and slows downstream innovation.",
    evidence: "Platform economics suggests open ecosystems often expand total market creation.",
    relation: "supports"
  },
  {
    speakerId: "safety",
    claim:
      "The defensible policy is staged openness: publish evaluations, tools, and smaller models while gating the highest-risk capabilities.",
    evidence: "This balances independent scrutiny with proportional release controls.",
    relation: "revises"
  }
];

const claimNodes: ClaimNode[] = [
  { label: "Auditability increases with access", confidence: 82, status: "supported" },
  { label: "Misuse risk rises with capability", confidence: 78, status: "contested" },
  { label: "Open ecosystems accelerate innovation", confidence: 74, status: "supported" },
  { label: "Staged release is the strongest compromise", confidence: 86, status: "revised" }
];

const prompts = [
  "Security researcher, challenge the open-source advocate.",
  "What evidence would change your mind?",
  "Run a Supreme Court cross-examination.",
  "Summarize the strongest disagreement so far."
];

const formats = ["Oxford", "Scientific Review", "Supreme Court", "Boardroom"];

export default function Home() {
  const [topic, setTopic] = useState("Should AGI models be open source?");
  const [format, setFormat] = useState("Oxford");
  const [isLive, setIsLive] = useState(true);
  const [intervention, setIntervention] = useState("");

  const consensus = useMemo(() => {
    const support = experts.filter((expert) => expert.stance === "support").length;
    const mixed = experts.filter((expert) => expert.stance === "mixed").length;
    return Math.round(((support + mixed * 0.5) / experts.length) * 100);
  }, []);

  return (
    <main className={styles.app}>
      <section className={styles.header}>
        <div>
          <div className={styles.brand}>
            <Brain size={22} />
            <span>Agora AI</span>
          </div>
          <h1>Reason through hard questions with a live expert panel.</h1>
        </div>
        <div className={styles.statusPill}>
          <Sparkles size={16} />
          Build Week MVP
        </div>
      </section>

      <section className={styles.queryBar} aria-label="Debate setup">
        <label className={styles.topicField}>
          <span>Question</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>
        <div className={styles.formats} aria-label="Debate format">
          {formats.map((item) => (
            <button
              className={item === format ? styles.formatActive : styles.format}
              key={item}
              onClick={() => setFormat(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button className={styles.startButton} type="button">
          Start
          <ArrowRight size={18} />
        </button>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.panelColumn} aria-label="Expert panel">
          <div className={styles.sectionHeader}>
            <span>Generated Panel</span>
            <BadgeCheck size={16} />
          </div>
          <div className={styles.expertList}>
            {experts.map((expert) => (
              <article className={styles.expert} key={expert.id}>
                <div className={styles.avatar} style={{ backgroundColor: expert.accent }}>
                  {expert.name
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </div>
                <div>
                  <h2>{expert.name}</h2>
                  <p>{expert.role}</p>
                  <div className={styles.expertMeta}>
                    <span>{expert.stance}</span>
                    <span>{expert.confidence}% confidence</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.consensus}>
            <div>
              <span>Consensus drift</span>
              <strong>{consensus}%</strong>
            </div>
            <div className={styles.meter} aria-hidden="true">
              <span style={{ width: `${consensus}%` }} />
            </div>
          </div>
        </aside>

        <section className={styles.debateColumn} aria-label="Live debate">
          <div className={styles.debateTopbar}>
            <div>
              <span className={styles.eyebrow}>{format} Debate</span>
              <h2>{topic}</h2>
            </div>
            <button
              className={styles.iconButton}
              onClick={() => setIsLive((current) => !current)}
              title={isLive ? "Pause debate" : "Resume debate"}
              type="button"
            >
              {isLive ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>

          <div className={styles.transcript}>
            {turns.map((turn, index) => {
              const expert = experts.find((item) => item.id === turn.speakerId);
              const isModerator = turn.speakerId === "moderator";
              return (
                <article className={styles.turn} key={`${turn.speakerId}-${index}`}>
                  <div
                    className={styles.turnMarker}
                    style={{ backgroundColor: expert?.accent ?? "var(--blue)" }}
                  />
                  <div className={styles.turnBody}>
                    <div className={styles.turnHeader}>
                      <span>{isModerator ? "Moderator" : expert?.name}</span>
                      <small>{turn.relation}</small>
                    </div>
                    <p>{turn.claim}</p>
                    <div className={styles.evidence}>
                      <Scale size={15} />
                      {turn.evidence}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.interventionBox}>
            <MessageSquarePlus size={18} />
            <textarea
              aria-label="Intervene in the debate"
              onChange={(event) => setIntervention(event.target.value)}
              placeholder="Interrupt, challenge a speaker, or add new evidence..."
              value={intervention}
            />
            <button type="button">Inject</button>
          </div>
          <div className={styles.promptRow}>
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => setIntervention(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <aside className={styles.graphColumn} aria-label="Argument graph">
          <div className={styles.sectionHeader}>
            <span>Argument Graph</span>
            <GitBranch size={16} />
          </div>
          <div className={styles.graphCanvas}>
            {claimNodes.map((node, index) => (
              <div className={styles.claimNode} key={node.label}>
                <div className={styles.nodeIcon}>
                  {node.status === "contested" ? (
                    <ShieldAlert size={16} />
                  ) : node.status === "revised" ? (
                    <Gavel size={16} />
                  ) : (
                    <Vote size={16} />
                  )}
                </div>
                <div>
                  <p>{node.label}</p>
                  <span>{node.confidence}% confidence</span>
                </div>
                {index < claimNodes.length - 1 ? <i aria-hidden="true" /> : null}
              </div>
            ))}
          </div>

          <div className={styles.brief}>
            <span>Moderator Brief</span>
            <h2>Current strongest position</h2>
            <p>
              Staged openness is winning: publish evaluations and safety tools broadly,
              but gate high-risk model weights until misuse thresholds are clearer.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
