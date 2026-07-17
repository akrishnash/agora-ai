"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Flame,
  Info,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Scale,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Unlock,
  Users,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDebate, injectIntervention } from "@/lib/api";
import type { DebateFormat, DebateSession } from "@/lib/types";
import styles from "./page.module.css";

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const FORMATS: { value: DebateFormat; label: string; desc: string }[] = [
  { value: "Oxford",          label: "Oxford",          desc: "Formal polarised debate" },
  { value: "Scientific Review", label: "Scientific",   desc: "Evidence & peer consensus" },
  { value: "Supreme Court",   label: "Supreme Court",  desc: "Constitutional adjudication" },
  { value: "Boardroom",       label: "Boardroom",      desc: "Executive risk assessment" }
];

const SUGGESTED_TOPICS = [
  {
    title: "Should AGI models be open source?",
    desc: "Transparent safety audits vs. critical security misuse risks",
    format: "Oxford" as DebateFormat,
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
  },
  {
    title: "Should carbon offset markets be abolished?",
    desc: "Market efficiency vs. greenwashing and systemic integrity",
    format: "Scientific Review" as DebateFormat,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
  },
  {
    title: "Should AI code assistants require licensing?",
    desc: "Copyright law and developer productivity vs. market control",
    format: "Boardroom" as DebateFormat,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
  }
];

const QUICK_INTERVENTIONS = [
  "Security researcher, directly challenge the open-source advocate's claims.",
  "Introduce new evidence: studies show model weight leakage increases biosecurity risks.",
  "Ask the economists to quantify the market concentration effects."
];

const TURN_INTERVAL_MS = 2400;

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function getExpertIcon(id: string) {
  const s = id.toLowerCase();
  if (s.includes("safety"))    return <Brain size={16} />;
  if (s.includes("open"))      return <Unlock size={16} />;
  if (s.includes("security"))  return <Shield size={16} />;
  if (s.includes("economist") || s.includes("finance")) return <TrendingUp size={16} />;
  if (s.includes("policy") || s.includes("law")) return <Scale size={16} />;
  return <Users size={16} />;
}

function getRelationMeta(relation: string) {
  switch (relation) {
    case "opens":     return { label: "Opens",    cls: "opens",     Icon: Play };
    case "supports":  return { label: "Supports", cls: "supports",  Icon: CheckCircle2 };
    case "challenges":return { label: "Challenges",cls:"challenges",Icon: Flame };
    case "revises":   return { label: "Revises",  cls: "revises",   Icon: RefreshCw };
    default:          return { label: "Argues",   cls: "default",   Icon: MessageSquare };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [topic, setTopic]               = useState("");
  const [format, setFormat]             = useState<DebateFormat>("Oxford");
  const [session, setSession]           = useState<DebateSession | null>(null);
  const [isInitializing, setIsInit]     = useState(false);
  const [isIntervening, setIsIntervene] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [backendOk, setBackendOk]       = useState<boolean | null>(null);
  const [visibleCount, setVisible]      = useState(0);
  const [isSimulating, setSimulating]   = useState(false);
  const [interventionText, setIText]    = useState("");
  const [highlightedExpert, setHighlighted] = useState<string | null>(null);
  const [justIntervenedMsg, setJustIntervenedMsg] = useState<string | null>(null);

  const timerRef       = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef  = useRef<HTMLDivElement>(null);

  // Health check
  useEffect(() => {
    fetch("http://127.0.0.1:8001/health")
      .then((r) => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [visibleCount]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Simulation engine ──────────────────────────────────────────────────────
  const startSimulation = useCallback((total: number, from = 1) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulating(true);
    setVisible(from);

    timerRef.current = setInterval(() => {
      setVisible((prev) => {
        if (prev >= total) {
          clearInterval(timerRef.current!);
          setSimulating(false);
          return total;
        }
        return prev + 1;
      });
    }, TURN_INTERVAL_MS);
  }, []);

  function skipSimulation() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulating(false);
    if (session) setVisible(session.turns.length);
  }

  // ── Start a new debate ─────────────────────────────────────────────────────
  async function handleStart(t?: string, f?: DebateFormat) {
    const resolvedTopic  = t ?? topic.trim();
    const resolvedFormat = f ?? format;
    if (!resolvedTopic) return;

    setError(null);
    setIsInit(true);
    setSession(null);
    setVisible(0);
    setSimulating(false);
    setJustIntervenedMsg(null);

    try {
      const s = await createDebate(resolvedTopic, resolvedFormat);
      setSession(s);
      startSimulation(s.turns.length, 1);
    } catch {
      setError("Could not reach the Agora backend on port 8001. Start the server and try again.");
    } finally {
      setIsInit(false);
    }
  }

  // ── User intervention ──────────────────────────────────────────────────────
  async function handleIntervene(text: string) {
    if (!session || !text.trim() || isIntervening || isSimulating) return;

    setError(null);
    setIsIntervene(true);
    setIText("");
    setJustIntervenedMsg(text);

    try {
      const prev = session.turns.length;
      const updated = await injectIntervention(session, text);
      setSession(updated);
      startSimulation(updated.turns.length, prev);
    } catch {
      setError("Intervention failed. Check if the backend is running.");
    } finally {
      setIsIntervene(false);
    }
  }

  function handleReset() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSession(null);
    setVisible(0);
    setSimulating(false);
    setTopic("");
    setError(null);
    setJustIntervenedMsg(null);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const visibleTurns = useMemo(
    () => (session ? session.turns.slice(0, visibleCount) : []),
    [session, visibleCount]
  );

  const activeSpeaker = useMemo(() => {
    if (!session || !isSimulating || visibleCount >= session.turns.length) return null;
    const next = session.turns[visibleCount];
    return session.experts.find((e) => e.id === next?.speaker_id) ?? null;
  }, [session, isSimulating, visibleCount]);

  const isFinished = session != null && visibleCount >= session.turns.length;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.bgMesh} aria-hidden="true">
        <div className={styles.bgBlob1} />
        <div className={styles.bgBlob2} />
        <div className={styles.bgBlob3} />
        <div className={styles.bgGrid} />
      </div>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <button className={styles.logo} onClick={handleReset} aria-label="Go to home">
          <div className={styles.logoIcon}>
            <Sparkles size={18} />
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Agora AI</span>
            <span className={styles.logoTagline}>Reasoning Engine</span>
          </div>
        </button>

        <div className={styles.headerRight}>
          {session && (
            <span className={styles.modeBadge} data-mode={session.mode}>
              {session.mode === "openai" ? (
                <><Zap size={11} /> GPT-4o Live</>
              ) : (
                <><Play size={11} /> Demo Mode</>
              )}
            </span>
          )}
          <div className={styles.engineStatus} data-ok={backendOk === true ? "true" : "false"}>
            <span className={styles.engineDot} />
            <span>{backendOk == null ? "Connecting…" : backendOk ? "Engine online" : "Engine offline"}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className={styles.main}>
        {!session ? (
          /* ─── SETUP SCREEN ─────────────────────────────────────────────── */
          <div className={styles.setupWrapper}>
            {/* Hero */}
            <div className={styles.hero}>
              <div className={styles.heroPill}>
                <Sparkles size={12} />
                <span>OpenAI Build Week 2026 · Hackathon Finalist</span>
              </div>

              <h1 className={styles.heroTitle}>
                Where hard questions<br />
                <span className={styles.heroAccent}>find their answer</span>
              </h1>

              <p className={styles.heroSub}>
                Agora assembles a panel of domain experts, runs a structured evidence-backed debate,
                maps the argument graph in real time, and distills it into a rigorous decision brief.
              </p>
            </div>

            {/* Setup card + topics */}
            <div className={styles.setupGrid}>
              {/* Left card: configure */}
              <div className={styles.setupCard}>
                <h2 className={styles.cardTitle}>
                  <MessageSquare size={18} />
                  New Reasoning Session
                </h2>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="topic-input">
                    What should the panel debate?
                  </label>
                  <textarea
                    id="topic-input"
                    className={styles.textarea}
                    rows={3}
                    placeholder="e.g. Should AGI models be open source?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleStart();
                      }
                    }}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Debate format</label>
                  <div className={styles.formatGrid}>
                    {FORMATS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        className={`${styles.formatBtn} ${format === f.value ? styles.formatActive : ""}`}
                        onClick={() => setFormat(f.value)}
                      >
                        <span className={styles.formatLabel}>{f.label}</span>
                        <span className={styles.formatDesc}>{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.startBtn}
                  disabled={isInitializing || !topic.trim()}
                  onClick={() => handleStart()}
                >
                  {isInitializing ? (
                    <><Loader2 size={18} className={styles.spin} /> Assembling panel…</>
                  ) : (
                    <><Play size={18} /> Convene Panel</>
                  )}
                </button>

                {error && (
                  <div className={styles.errorBanner}>
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Right card: suggested topics */}
              <div className={styles.topicsCard}>
                <h2 className={styles.cardTitle}>
                  <Sparkles size={18} />
                  Curated Scenarios
                </h2>
                <div className={styles.topicsList}>
                  {SUGGESTED_TOPICS.map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      className={styles.topicBtn}
                      onClick={() => {
                        setTopic(t.title);
                        setFormat(t.format);
                        handleStart(t.title, t.format);
                      }}
                    >
                      <div
                        className={styles.topicStripe}
                        style={{ background: t.gradient }}
                      />
                      <div className={styles.topicBody}>
                        <div className={styles.topicMeta}>
                          <span className={styles.topicFormat}>{t.format}</span>
                          <ChevronRight size={14} className={styles.topicArrow} />
                        </div>
                        <span className={styles.topicTitle}>{t.title}</span>
                        <span className={styles.topicDesc}>{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Manifesto */}
            <p className={styles.manifesto}>
              Search engines organize information. <strong>Agora organizes reasoning.</strong>
            </p>
          </div>
        ) : (
          /* ─── ARENA ─────────────────────────────────────────────────────── */
          <div className={styles.arena}>
            {/* Topic bar */}
            <div className={styles.topicBar}>
              <button className={styles.backBtn} onClick={handleReset}>
                <ArrowLeft size={15} />
                <span>New debate</span>
              </button>
              <div className={styles.topicBarCenter}>
                <div className={styles.topicBarMeta}>
                  <span className={styles.topicBarFormat}>{session.format}</span>
                  <span className={styles.topicBarStatus}>
                    {isSimulating ? "Debate in progress…" : isIntervening ? "Re-orchestrating…" : "Analysis complete"}
                  </span>
                </div>
                <h2 className={styles.topicBarTitle}>{session.topic}</h2>
              </div>
              {isSimulating && (
                <button className={styles.skipBtn} onClick={skipSimulation}>
                  Skip →
                </button>
              )}
            </div>

            {/* Three-column grid */}
            <div className={styles.arenaGrid}>
              {/* ── COL 1: Experts ── */}
              <aside className={styles.col}>
                <div className={styles.colHeader}>
                  <Users size={14} />
                  <span>Expert Panel</span>
                  <span className={styles.colCount}>{session.experts.length}</span>
                </div>
                <div className={styles.expertList}>
                  {session.experts.map((exp) => {
                    const isActive   = activeSpeaker?.id === exp.id;
                    const isHighlight = highlightedExpert === exp.id;
                    return (
                      <div
                        key={exp.id}
                        className={`${styles.expertCard} ${isActive ? styles.expertPulse : ""} ${isHighlight ? styles.expertHighlight : ""}`}
                        onMouseEnter={() => setHighlighted(exp.id)}
                        onMouseLeave={() => setHighlighted(null)}
                        data-stance={exp.stance}
                      >
                        {/* Avatar */}
                        <div className={styles.expertAvatarWrap}>
                          <div className={styles.expertAvatar} data-stance={exp.stance}>
                            {getExpertIcon(exp.id)}
                          </div>
                          {isActive && <div className={styles.avatarRing} />}
                        </div>

                        <div className={styles.expertInfo}>
                          <span className={styles.expertName}>{exp.name}</span>
                          <span className={styles.expertRole}>{exp.role}</span>

                          <div className={styles.expertMeter}>
                            <div className={styles.expertMeterTrack}>
                              <div
                                className={styles.expertMeterFill}
                                data-stance={exp.stance}
                                style={{ width: `${exp.confidence}%` }}
                              />
                            </div>
                            <span className={styles.expertConf}>{exp.confidence}%</span>
                          </div>
                        </div>

                        <div className={styles.expertStance} data-stance={exp.stance}>
                          {exp.stance}
                        </div>

                        {isActive && (
                          <div className={styles.typingBubble}>
                            <span /><span /><span />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* ── COL 2: Transcript ── */}
              <section className={styles.transcript}>
                <div className={styles.colHeader}>
                  <FileText size={14} />
                  <span>Live Argument Log</span>
                  <span className={styles.colCount}>{visibleCount}/{session.turns.length}</span>
                </div>

                <div className={styles.turnList} ref={transcriptRef}>
                  {/* Intervention notice */}
                  {justIntervenedMsg && (
                    <div className={styles.interventionBanner}>
                      <Zap size={13} />
                      <span>You intervened: <em>"{justIntervenedMsg}"</em></span>
                    </div>
                  )}

                  {visibleTurns.map((turn, i) => {
                    const isMod  = turn.speaker_id === "moderator";
                    const expert = session.experts.find((e) => e.id === turn.speaker_id);
                    const rel    = getRelationMeta(turn.relation);
                    const RelIcon = rel.Icon;

                    return (
                      <article
                        key={`${turn.speaker_id}-${i}`}
                        className={`${styles.turn} ${isMod ? styles.turnMod : styles.turnExpert}`}
                        style={{ animationDelay: `${(i % 3) * 40}ms` }}
                      >
                        <div className={styles.turnHead}>
                          {/* Avatar / icon */}
                          {isMod ? (
                            <div className={styles.modAvatar}>
                              <MessageSquare size={13} />
                            </div>
                          ) : (
                            <div className={styles.turnAvatar} data-stance={expert?.stance}>
                              {expert ? (
                                <span className={styles.initials}>{getInitials(expert.name)}</span>
                              ) : (
                                getExpertIcon(turn.speaker_id)
                              )}
                            </div>
                          )}

                          <div className={styles.turnMeta}>
                            <span className={styles.turnSpeaker}>
                              {isMod ? "Moderator" : expert?.name ?? turn.speaker_id}
                            </span>
                            {!isMod && expert && (
                              <span className={styles.turnRole}>{expert.role}</span>
                            )}
                          </div>

                          <div className={`${styles.relBadge} ${styles[`rel_${rel.cls}`]}`}>
                            <RelIcon size={11} />
                            <span>{rel.label}</span>
                          </div>
                        </div>

                        <div className={styles.turnBody}>
                          <p className={styles.claim}>{turn.claim}</p>
                          {turn.evidence && (
                            <div className={styles.evidenceBox}>
                              <span className={styles.evidenceTag}>
                                <Info size={11} /> Evidence
                              </span>
                              <p className={styles.evidenceText}>{turn.evidence}</p>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {/* Next speaker typing */}
                  {activeSpeaker && (
                    <div className={styles.typingRow}>
                      <div className={styles.turnAvatar} data-stance={activeSpeaker.stance}>
                        <span className={styles.initials}>{getInitials(activeSpeaker.name)}</span>
                      </div>
                      <div className={styles.typingContent}>
                        <span className={styles.turnSpeaker}>{activeSpeaker.name}</span>
                        <div className={styles.typingDots}>
                          <span /><span /><span />
                        </div>
                      </div>
                    </div>
                  )}

                  {isIntervening && (
                    <div className={styles.reorchestrating}>
                      <Loader2 size={14} className={styles.spin} />
                      <span>Re-orchestrating the argument graph…</span>
                    </div>
                  )}
                </div>

                {/* Intervention input */}
                <div className={styles.interventionBox}>
                  {isFinished && !isIntervening && (
                    <div className={styles.quickInterventions}>
                      {QUICK_INTERVENTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className={styles.quickBtn}
                          onClick={() => handleIntervene(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder={
                        isSimulating
                          ? "Wait for the debate to finish before intervening…"
                          : isIntervening
                          ? "Applying your intervention…"
                          : "Direct a speaker, challenge a claim, or inject evidence…"
                      }
                      disabled={isSimulating || isIntervening}
                      value={interventionText}
                      onChange={(e) => setIText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleIntervene(interventionText);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.sendBtn}
                      disabled={isSimulating || isIntervening || !interventionText.trim()}
                      onClick={() => handleIntervene(interventionText)}
                    >
                      {isIntervening ? <Loader2 size={15} className={styles.spin} /> : <Send size={15} />}
                    </button>
                  </div>
                  {error && (
                    <div className={styles.errorBanner} style={{ marginTop: "0.5rem" }}>
                      <AlertTriangle size={13} />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* ── COL 3: Graph + Brief ── */}
              <aside className={styles.col}>
                {/* Argument map */}
                <div className={styles.colHeader}>
                  <TrendingUp size={14} />
                  <span>Argument Map</span>
                </div>
                <div className={styles.graphPanel}>
                  {session.graph.map((node, i) => (
                    <div key={i} className={styles.graphNode} data-status={node.status}>
                      <div className={styles.graphNodeTop}>
                        <span className={styles.nodeStatus} data-status={node.status}>
                          {node.status}
                        </span>
                        <span className={styles.nodeConf}>{node.confidence}%</span>
                      </div>
                      <p className={styles.nodeLabel}>{node.label}</p>
                      <div className={styles.nodeTrack}>
                        <div
                          className={styles.nodeFill}
                          data-status={node.status}
                          style={{ width: `${node.confidence}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Decision brief */}
                <div className={styles.colHeader} style={{ marginTop: "1.25rem" }}>
                  <FileText size={14} />
                  <span>Decision Brief</span>
                </div>
                <div className={styles.briefPanel}>
                  {[
                    { title: "Strongest Position",       key: "strongest_position" as const,       color: "--green-400" },
                    { title: "Weakest Assumption",       key: "weakest_assumption" as const,       color: "--amber-400" },
                    { title: "Unresolved Disagreement",  key: "unresolved_disagreement" as const,  color: "--red-400" },
                    { title: "Next Research Question",   key: "next_question" as const,            color: "--indigo-400" }
                  ].map(({ title, key, color }) => (
                    <div key={key} className={styles.briefBlock}>
                      <span
                        className={styles.briefTitle}
                        style={{ color: `var(${color})` }}
                      >
                        {title}
                      </span>
                      <p className={styles.briefText}>{session.brief[key]}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span>Search engines organize information.</span>
        <strong> Agora organizes reasoning.</strong>
        <span className={styles.footerDivider}>·</span>
        <span className={styles.footerSub}>OpenAI Build Week 2026</span>
      </footer>
    </div>
  );
}
