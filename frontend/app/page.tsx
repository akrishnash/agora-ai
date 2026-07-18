"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Flame,
  GitBranch,
  Info,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Send,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDebate, injectIntervention } from "@/lib/api";
import { summarizeGraph } from "@/lib/graph";
import type { DebateFormat, DebateSession } from "@/lib/types";
import styles from "./page.module.css";

const ArgumentGraph = dynamic(() => import("./ArgumentGraph"), {
  ssr: false,
  loading: () => <div className={styles.graphLoading}>Preparing canvas…</div>,
});

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const FORMATS: { value: DebateFormat; label: string; desc: string }[] = [
  { value: "Oxford",            label: "Oxford",        desc: "Formal polarised debate" },
  { value: "Scientific Review", label: "Scientific",    desc: "Evidence & peer consensus" },
  { value: "Supreme Court",     label: "Supreme Court", desc: "Constitutional adjudication" },
  { value: "Boardroom",         label: "Boardroom",     desc: "Executive risk assessment" },
];

const SUGGESTED_TOPICS = [
  {
    title: "Should frontier AI models be open source?",
    desc: "Transparent safety audits vs. critical security misuse risks",
    format: "Oxford" as DebateFormat,
    gradient: "#10a37f",
  },
  {
    title: "Should nuclear energy replace coal for baseload power?",
    desc: "Decarbonization speed vs. waste, cost, and safety trade-offs",
    format: "Scientific Review" as DebateFormat,
    gradient: "#6e6e80",
  },
  {
    title: "Should social media be banned for users under 16?",
    desc: "Child wellbeing vs. speech, enforcement, and access rights",
    format: "Supreme Court" as DebateFormat,
    gradient: "#c2760a",
  },
];

const QUICK_INTERVENTIONS = [
  "Security researcher, directly challenge the open-source advocate's strongest claim.",
  "Introduce new evidence: studies show model-weight leakage increases biosecurity risk.",
  "Ask the economist to quantify the market-concentration effect.",
];

const TURN_INTERVAL_MS = 1600;

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

function getRelationMeta(relation: string) {
  switch (relation) {
    case "opens":      return { label: "Opens",      cls: "opens",      Icon: Play };
    case "supports":   return { label: "Supports",   cls: "supports",   Icon: MessageSquare };
    case "challenges": return { label: "Challenges", cls: "challenges", Icon: Flame };
    case "revises":    return { label: "Revises",    cls: "revises",    Icon: RefreshCw };
    default:           return { label: "Argues",     cls: "default",    Icon: MessageSquare };
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
  const [justIntervenedMsg, setJustIntervenedMsg] = useState<string | null>(null);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Health check
  useEffect(() => {
    fetch("http://127.0.0.1:8001/health")
      .then((r) => setBackendOk(r.ok))
      .catch(() => setBackendOk(false));
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Playback engine ──────────────────────────────────────────────────────
  const startSimulation = useCallback((total: number, from = 1) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulating(true);
    setVisible(from);
    timerRef.current = setInterval(() => {
      setVisible((prev) => {
        if (prev >= total) {
          if (timerRef.current) clearInterval(timerRef.current);
          setSimulating(false);
          return total;
        }
        return prev + 1;
      });
    }, TURN_INTERVAL_MS);
  }, []);

  const pause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulating(false);
  }, []);

  const stepTo = useCallback((n: number) => {
    if (!session) return;
    pause();
    setVisible(Math.max(0, Math.min(session.turns.length, n)));
  }, [session, pause]);

  const togglePlay = useCallback(() => {
    if (!session) return;
    const total = session.turns.length;
    if (isSimulating) { pause(); return; }
    if (visibleCount >= total) startSimulation(total, 1); // replay from start
    else startSimulation(total, visibleCount);
  }, [session, isSimulating, visibleCount, pause, startSimulation]);

  // ── Start a new debate ───────────────────────────────────────────────────
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

  // ── User intervention ────────────────────────────────────────────────────
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

  // ── Derived values ───────────────────────────────────────────────────────
  const visibleTurns = useMemo(
    () => (session ? session.turns.slice(0, visibleCount) : []),
    [session, visibleCount]
  );

  const activeSpeaker = useMemo(() => {
    if (!session || !isSimulating || visibleCount >= session.turns.length) return null;
    const next = session.turns[visibleCount];
    return session.experts.find((e) => e.id === next?.speaker_id) ?? null;
  }, [session, isSimulating, visibleCount]);

  const summary = useMemo(
    () => (session ? summarizeGraph(session, visibleCount) : null),
    [session, visibleCount]
  );

  const total = session?.turns.length ?? 0;
  const isFinished = session != null && visibleCount >= total && !isIntervening;
  const canIntervene = session != null && !isSimulating && !isIntervening && visibleCount > 0;

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
          <div className={styles.logoIcon}><GitBranch size={18} /></div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Agora AI</span>
            <span className={styles.logoTagline}>Reasoning Engine</span>
          </div>
        </button>

        <div className={styles.headerRight}>
          {session && (
            <span className={styles.modeBadge} data-mode={session.mode}>
              {session.mode === "openai" ? (<><Zap size={11} /> Live model</>) : (<><Play size={11} /> Demo mode</>)}
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
            <div className={styles.hero}>
              <div className={styles.heroPill}>
                <Sparkles size={12} />
                <span>OpenAI Build Week 2026 · Reasoning Arena</span>
              </div>
              <h1 className={styles.heroTitle}>
                Where hard questions<br />
                <span className={styles.heroAccent}>find their answer</span>
              </h1>
              <p className={styles.heroSub}>
                Agora assembles a panel of domain experts, runs a structured evidence-backed debate,
                and maps it into a living argument graph you can challenge, rewind, and resolve.
              </p>
            </div>

            <div className={styles.setupGrid}>
              <div className={styles.setupCard}>
                <h2 className={styles.cardTitle}><MessageSquare size={18} /> New Reasoning Session</h2>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="topic-input">What should the panel debate?</label>
                  <textarea
                    id="topic-input"
                    className={styles.textarea}
                    rows={3}
                    placeholder="e.g. Should frontier AI models be open source?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStart(); }
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
                  {isInitializing ? (<><Loader2 size={18} className={styles.spin} /> Assembling panel…</>) : (<><Play size={18} /> Convene Panel</>)}
                </button>

                {error && (<div className={styles.errorBanner}><AlertTriangle size={15} /><span>{error}</span></div>)}
              </div>

              <div className={styles.topicsCard}>
                <h2 className={styles.cardTitle}><Sparkles size={18} /> Curated Scenarios</h2>
                <div className={styles.topicsList}>
                  {SUGGESTED_TOPICS.map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      className={styles.topicBtn}
                      onClick={() => { setTopic(t.title); setFormat(t.format); handleStart(t.title, t.format); }}
                    >
                      <div className={styles.topicStripe} style={{ background: t.gradient }} />
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

            <p className={styles.manifesto}>
              Search engines organize information. <strong>Agora organizes reasoning.</strong>
            </p>
          </div>
        ) : (
          /* ─── ARENA ─────────────────────────────────────────────────────── */
          <div className={styles.arena}>
            {/* Topic bar + live metrics */}
            <div className={styles.topicBar}>
              <button className={styles.backBtn} onClick={handleReset}><ArrowLeft size={15} /><span>New</span></button>
              <div className={styles.topicBarCenter}>
                <div className={styles.topicBarMeta}>
                  <span className={styles.topicBarFormat}>{session.format}</span>
                  <span className={styles.topicBarStatus}>
                    {isSimulating ? "Debate in progress…" : isIntervening ? "Re-orchestrating…" : "Analysis complete"}
                  </span>
                </div>
                <h2 className={styles.topicBarTitle}>{session.topic}</h2>
              </div>

              {summary && (
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Activity size={11} /> Consensus</span>
                    <span className={styles.metricValue}>{summary.consensus}%</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Flame size={11} /> Contested</span>
                    <span className={styles.metricValue}>{summary.contested}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Target size={11} /> Turn</span>
                    <span className={styles.metricValue}>{visibleCount}/{total}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Three-column grid */}
            <div className={styles.arenaGrid}>
              {/* ── COL 1: Experts ── */}
              <aside className={styles.col}>
                <div className={styles.colHeader}><Users size={14} /><span>Expert Panel</span><span className={styles.colCount}>{session.experts.length}</span></div>
                <div className={styles.expertList}>
                  {session.experts.map((exp) => {
                    const isActive = activeSpeaker?.id === exp.id;
                    return (
                      <div key={exp.id} className={`${styles.expertCard} ${isActive ? styles.expertPulse : ""}`} data-stance={exp.stance}>
                        <div className={styles.expertAvatarWrap}>
                          <div className={styles.expertAvatar} data-stance={exp.stance}>{getInitials(exp.name)}</div>
                          {isActive && <div className={styles.avatarRing} />}
                        </div>
                        <div className={styles.expertInfo}>
                          <span className={styles.expertName}>{exp.name}</span>
                          <span className={styles.expertRole}>{exp.role}</span>
                          <div className={styles.expertMeter}>
                            <div className={styles.expertMeterTrack}>
                              <div className={styles.expertMeterFill} data-stance={exp.stance} style={{ width: `${exp.confidence}%` }} />
                            </div>
                            <span className={styles.expertConf}>{exp.confidence}%</span>
                          </div>
                        </div>
                        <div className={styles.expertStance} data-stance={exp.stance}>{exp.stance}</div>
                        {isActive && <div className={styles.typingBubble}><span /><span /><span /></div>}
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* ── COL 2: Argument graph (HERO) ── */}
              <section className={styles.graphCol}>
                <div className={styles.colHeader}>
                  <GitBranch size={14} /><span>Live Argument Graph</span>
                  <div className={styles.legend}>
                    <span className={styles.legendItem} data-rel="supports">Supports</span>
                    <span className={styles.legendItem} data-rel="challenges">Challenges</span>
                    <span className={styles.legendItem} data-rel="revises">Revises</span>
                  </div>
                </div>

                <div className={styles.graphCanvas}>
                  <ArgumentGraph session={session} visibleCount={visibleCount} />
                  {isIntervening && (
                    <div className={styles.graphOverlay}>
                      <Loader2 size={18} className={styles.spin} />
                      <span>Re-orchestrating the argument graph…</span>
                    </div>
                  )}
                </div>

                {/* Timeline scrubber */}
                <div className={styles.timeline}>
                  <button className={styles.playBtn} onClick={togglePlay} aria-label={isSimulating ? "Pause" : "Play"}>
                    {isSimulating ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button className={styles.stepBtn} onClick={() => stepTo(visibleCount - 1)} disabled={visibleCount <= 0} aria-label="Step back"><SkipBack size={14} /></button>
                  <div className={styles.scrubTrack}>
                    {session.turns.map((t, i) => {
                      const on = i < visibleCount;
                      const cur = i === visibleCount - 1;
                      return (
                        <button
                          key={t.id}
                          className={styles.scrubDot}
                          data-on={on ? "true" : "false"}
                          data-current={cur ? "true" : "false"}
                          data-rel={t.relation}
                          title={t.headline}
                          onClick={() => stepTo(i + 1)}
                        />
                      );
                    })}
                  </div>
                  <button className={styles.stepBtn} onClick={() => stepTo(visibleCount + 1)} disabled={visibleCount >= total} aria-label="Step forward"><SkipForward size={14} /></button>
                  <span className={styles.timelineCount}>{visibleCount}/{total}</span>
                </div>
              </section>

              {/* ── COL 3: Transcript + intervention ── */}
              <section className={styles.transcript}>
                <div className={styles.colHeader}><FileText size={14} /><span>Argument Log</span><span className={styles.colCount}>{visibleCount}/{total}</span></div>

                <div className={styles.turnList} ref={transcriptRef}>
                  {justIntervenedMsg && (
                    <div className={styles.interventionBanner}><Zap size={13} /><span>You intervened: <em>&ldquo;{justIntervenedMsg}&rdquo;</em></span></div>
                  )}

                  {visibleTurns.map((turn) => {
                    const isMod  = turn.speaker_id === "moderator";
                    const expert = session.experts.find((e) => e.id === turn.speaker_id);
                    const rel    = getRelationMeta(turn.relation);
                    const RelIcon = rel.Icon;
                    return (
                      <article key={turn.id} className={`${styles.turn} ${isMod ? styles.turnMod : styles.turnExpert}`}>
                        <div className={styles.turnHead}>
                          {isMod ? (
                            <div className={styles.modAvatar}><MessageSquare size={13} /></div>
                          ) : (
                            <div className={styles.turnAvatar} data-stance={expert?.stance}>
                              <span className={styles.initials}>{getInitials(expert?.name ?? "?")}</span>
                            </div>
                          )}
                          <div className={styles.turnMeta}>
                            <span className={styles.turnSpeaker}>{isMod ? "Moderator" : expert?.name ?? turn.speaker_id}</span>
                            {!isMod && expert && <span className={styles.turnRole}>{expert.role}</span>}
                          </div>
                          <div className={`${styles.relBadge} ${styles[`rel_${rel.cls}`]}`}><RelIcon size={11} /><span>{rel.label}</span></div>
                        </div>
                        <div className={styles.turnBody}>
                          <p className={styles.claim}>{turn.claim}</p>
                          {turn.evidence && (
                            <div className={styles.evidenceBox}>
                              <span className={styles.evidenceTag}><Info size={11} /> Evidence</span>
                              <p className={styles.evidenceText}>{turn.evidence}</p>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {activeSpeaker && (
                    <div className={styles.typingRow}>
                      <div className={styles.turnAvatar} data-stance={activeSpeaker.stance}><span className={styles.initials}>{getInitials(activeSpeaker.name)}</span></div>
                      <div className={styles.typingContent}>
                        <span className={styles.turnSpeaker}>{activeSpeaker.name}</span>
                        <div className={styles.typingDots}><span /><span /><span /></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Intervention input */}
                <div className={styles.interventionBox}>
                  {canIntervene && (
                    <div className={styles.quickInterventions}>
                      {QUICK_INTERVENTIONS.map((q) => (
                        <button key={q} type="button" className={styles.quickBtn} onClick={() => handleIntervene(q)}>{q}</button>
                      ))}
                    </div>
                  )}
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder={isSimulating ? "Pause the debate to intervene…" : isIntervening ? "Applying your intervention…" : "Challenge a claim, direct a speaker, or inject evidence…"}
                      disabled={isSimulating || isIntervening}
                      value={interventionText}
                      onChange={(e) => setIText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleIntervene(interventionText); }}
                    />
                    <button type="button" className={styles.sendBtn} disabled={isSimulating || isIntervening || !interventionText.trim()} onClick={() => handleIntervene(interventionText)}>
                      {isIntervening ? <Loader2 size={15} className={styles.spin} /> : <Send size={15} />}
                    </button>
                  </div>
                  {error && (<div className={styles.errorBanner} style={{ marginTop: "0.5rem" }}><AlertTriangle size={13} /><span>{error}</span></div>)}
                </div>
              </section>
            </div>

            {/* Executive decision brief (reveals when the debate settles) */}
            <div className={`${styles.briefStrip} ${isFinished ? styles.briefStripOn : ""}`}>
              <div className={styles.briefStripHead}>
                <div className={styles.briefStripTitle}><FileText size={15} /> Decision Brief</div>
                <div className={styles.briefStripConsensus}>
                  <span>Panel consensus</span>
                  <strong>{summary?.consensus ?? 0}%</strong>
                </div>
              </div>
              <div className={styles.briefGrid}>
                {[
                  { title: "Strongest Position",      key: "strongest_position" as const,      cls: "green" },
                  { title: "Weakest Assumption",      key: "weakest_assumption" as const,      cls: "amber" },
                  { title: "Unresolved Disagreement", key: "unresolved_disagreement" as const, cls: "red" },
                  { title: "Next Research Question",  key: "next_question" as const,           cls: "indigo" },
                ].map(({ title, key, cls }) => (
                  <div key={key} className={styles.briefBlock} data-accent={cls}>
                    <span className={styles.briefBlockTitle}>{title}</span>
                    <p className={styles.briefBlockText}>{session.brief[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER (setup only) */}
      {!session && (
        <footer className={styles.footer}>
          <span>Search engines organize information.</span>
          <strong> Agora organizes reasoning.</strong>
          <span className={styles.footerDivider}>·</span>
          <span className={styles.footerSub}>OpenAI Build Week 2026</span>
        </footer>
      )}
    </div>
  );
}
