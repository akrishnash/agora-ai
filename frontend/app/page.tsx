"use client";

import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Gavel,
  GitBranch,
  Loader2,
  MessageSquarePlus,
  Pause,
  Play,
  Scale,
  ShieldAlert,
  Sparkles,
  Vote
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createDebate, injectIntervention } from "@/lib/api";
import type { DebateFormat, DebateSession, Expert } from "@/lib/types";
import styles from "./page.module.css";

const accentByIndex = [
  "var(--cyan)",
  "var(--green)",
  "var(--rose)",
  "var(--amber)",
  "var(--violet)",
  "var(--blue)"
];

const fallbackTopic = "Should AGI models be open source?";
const formats: DebateFormat[] = ["Oxford", "Scientific Review", "Supreme Court", "Boardroom"];
const prompts = [
  "Security researcher, challenge the open-source advocate.",
  "What evidence would change your mind?",
  "Run a Supreme Court cross-examination.",
  "Summarize the strongest disagreement so far."
];

function expertAccent(experts: Expert[], speakerId: string) {
  const index = experts.findIndex((expert) => expert.id === speakerId);
  return accentByIndex[index >= 0 ? index % accentByIndex.length : 5];
}

export default function Home() {
  const [topic, setTopic] = useState(fallbackTopic);
  const [format, setFormat] = useState<DebateFormat>("Oxford");
  const [session, setSession] = useState<DebateSession | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [intervention, setIntervention] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDebate() {
    setIsLoading(true);
    setError(null);
    try {
      const nextSession = await createDebate(topic, format);
      setSession(nextSession);
    } catch {
      setError("Could not reach the Agora API. Start FastAPI on port 8001, then try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitIntervention(instruction = intervention) {
    if (!session || !instruction.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const nextSession = await injectIntervention(session, instruction.trim());
      setSession(nextSession);
      setIntervention("");
    } catch {
      setError("The intervention could not be applied. Check the backend and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void startDebate();
  }, []);

  const experts = session?.experts ?? [];
  const consensus = useMemo(() => {
    if (experts.length === 0) return 0;
    const support = experts.filter((expert) => expert.stance === "support").length;
    const mixed = experts.filter((expert) => expert.stance === "mixed").length;
    return Math.round(((support + mixed * 0.5) / experts.length) * 100);
  }, [experts]);

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
        <div className={styles.headerBadges}>
          {session ? <div className={styles.modePill}>{session.mode} mode</div> : null}
          <div className={styles.statusPill}>
            <Sparkles size={16} />
            Build Week MVP
          </div>
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
        <button className={styles.startButton} disabled={isLoading} onClick={startDebate} type="button">
          {isLoading ? <Loader2 className={styles.spin} size={18} /> : <ArrowRight size={18} />}
          Start
        </button>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <section className={styles.workspace}>
        <aside className={styles.panelColumn} aria-label="Expert panel">
          <div className={styles.sectionHeader}>
            <span>Generated Panel</span>
            <BadgeCheck size={16} />
          </div>
          <div className={styles.expertList}>
            {experts.map((expert, index) => (
              <article className={styles.expert} key={expert.id}>
                <div
                  className={styles.avatar}
                  style={{ backgroundColor: accentByIndex[index % accentByIndex.length] }}
                >
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
              <span className={styles.eyebrow}>{session?.format ?? format} Debate</span>
              <h2>{session?.topic ?? topic}</h2>
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
            {session?.turns.map((turn, index) => {
              const expert = experts.find((item) => item.id === turn.speaker_id);
              const isModerator = turn.speaker_id === "moderator";
              return (
                <article className={styles.turn} key={`${turn.speaker_id}-${index}`}>
                  <div
                    className={styles.turnMarker}
                    style={{ backgroundColor: expertAccent(experts, turn.speaker_id) }}
                  />
                  <div className={styles.turnBody}>
                    <div className={styles.turnHeader}>
                      <span>{isModerator ? "Moderator" : expert?.name ?? turn.speaker_id}</span>
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
            }) ?? <div className={styles.loadingState}>Assembling the room...</div>}
          </div>

          <div className={styles.interventionBox}>
            <MessageSquarePlus size={18} />
            <textarea
              aria-label="Intervene in the debate"
              onChange={(event) => setIntervention(event.target.value)}
              placeholder="Interrupt, challenge a speaker, or add new evidence..."
              value={intervention}
            />
            <button disabled={isLoading || !session} onClick={() => submitIntervention()} type="button">
              Inject
            </button>
          </div>
          <div className={styles.promptRow}>
            {prompts.map((prompt) => (
              <button
                disabled={isLoading || !session}
                key={prompt}
                onClick={() => submitIntervention(prompt)}
                type="button"
              >
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
            {session?.graph.map((node, index) => (
              <div className={styles.claimNode} key={`${node.label}-${index}`}>
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
                {index < session.graph.length - 1 ? <i aria-hidden="true" /> : null}
              </div>
            )) ?? <div className={styles.loadingState}>No graph yet.</div>}
          </div>

          <div className={styles.brief}>
            <span>Moderator Brief</span>
            <h2>Current strongest position</h2>
            <p>{session?.brief.strongest_position ?? "The moderator is preparing the brief."}</p>
            {session ? (
              <dl className={styles.briefDetails}>
                <dt>Weakest assumption</dt>
                <dd>{session.brief.weakest_assumption}</dd>
                <dt>Unresolved disagreement</dt>
                <dd>{session.brief.unresolved_disagreement}</dd>
                <dt>Next question</dt>
                <dd>{session.brief.next_question}</dd>
              </dl>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
