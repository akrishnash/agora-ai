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
  Maximize2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, checkApiHealth, createDebate, injectIntervention, streamDebate } from "@/lib/api";
import { getCredentialCode, getSpeakerTitle } from "@/lib/credentials";
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
  { value: "Scientific Review", label: "Scientific",    desc: "Evidence & peer review" },
  { value: "Supreme Court",     label: "Supreme Court", desc: "Constitutional adjudication" },
  { value: "Boardroom",         label: "Boardroom",     desc: "Executive risk assessment" },
];

const SUGGESTED_TOPICS = [
  {
    title: "Should frontier AI model weights be open sourced?",
    desc: "Transparent safety audits vs. critical security misuse risks",
    format: "Oxford" as DebateFormat,
    gradient: "#11110f",
  },
  {
    title: "Should AI agents be allowed to act on behalf of users?",
    desc: "Productivity gains vs. permissioning, fraud, and auditability",
    format: "Boardroom" as DebateFormat,
    gradient: "#4f4f49",
  },
  {
    title: "Should autonomous coding agents modify production code?",
    desc: "Engineering velocity vs. security, review, and rollback risk",
    format: "Supreme Court" as DebateFormat,
    gradient: "#85857c",
  },
];

const QUICK_INTERVENTIONS = [
  "Security researcher, directly challenge the open-source advocate's strongest claim.",
  "Introduce new evidence: studies show model-weight leakage increases biosecurity risk.",
  "Ask the economist to quantify the market-concentration effect.",
];

const TURN_INTERVAL_MS = 1600;
const STREAM_TURN_REVEAL_MS = 1400;
const EXPECTED_DEBATE_TURNS = 6;
const INTRO_DURATION_MS = 3600;
const DEMO_ONLY_MODE = true;
type ArenaTab = "debate" | "verdict";

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function getRelationMeta(relation: string) {
  switch (relation) {
    case "opens":      return { label: "Opens",      cls: "opens",      Icon: Play };
    case "supports":   return { label: "Supports",   cls: "supports",   Icon: MessageSquare };
    case "challenges": return { label: "Challenges", cls: "challenges", Icon: Flame };
    case "revises":    return { label: "Revises",    cls: "revises",    Icon: RefreshCw };
    default:           return { label: "Argues",     cls: "default",    Icon: MessageSquare };
  }
}

function signalLabel(value: number) {
  if (value >= 75) return "High";
  if (value >= 50) return "Medium";
  return "Low";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [topic, setTopic]               = useState("");
  const [format, setFormat]             = useState<DebateFormat>("Oxford");
  const [session, setSession]           = useState<DebateSession | null>(null);
  const [isInitializing, setIsInit]     = useState(false);
  const [isGenerating, setGenerating]   = useState(false);
  const [isIntervening, setIsIntervene] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [backendOk, setBackendOk]       = useState<boolean | null>(null);
  const [visibleCount, setVisible]      = useState(0);
  const [isSimulating, setSimulating]   = useState(false);
  const [isGraphFocus, setGraphFocus]   = useState(false);
  const [activeArenaTab, setActiveArenaTab] = useState<ArenaTab>("debate");
  const [hiddenExpertIds, setHiddenExpertIds] = useState<Set<string>>(() => new Set());
  const [introQuestion, setIntroQuestion] = useState<string | null>(null);
  const [typedIntroQuestion, setTypedIntroQuestion] = useState("");
  const [interventionText, setIText]    = useState("");
  const [justIntervenedMsg, setJustIntervenedMsg] = useState<string | null>(null);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const generationRunRef = useRef(0);

  // Health check
  useEffect(() => {
    checkApiHealth().then(setBackendOk);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (!isGraphFocus) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGraphFocus(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGraphFocus]);

  useEffect(() => {
    if (!introQuestion) return;

    const characters = Array.from(introQuestion);
    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setTypedIntroQuestion(characters.slice(0, index).join(""));
      if (index >= characters.length) clearInterval(timer);
    }, 34);

    return () => clearInterval(timer);
  }, [introQuestion]);

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
    setGenerating(true);
    setJustIntervenedMsg(null);
    setHiddenExpertIds(new Set());
    setTypedIntroQuestion("");
    setIntroQuestion(resolvedTopic);
    setActiveArenaTab("debate");

    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    let receivedTurns = 0;
    let receivedSession = false;
    let revealChain: Promise<void> = Promise.resolve();

    try {
      if (DEMO_ONLY_MODE) {
        const s = await createDebate(resolvedTopic, resolvedFormat, { demoOnly: true });
        if (generationRunRef.current !== runId) return;
        setSession(s);
        setIsInit(false);
        await wait(INTRO_DURATION_MS);
        if (generationRunRef.current !== runId) return;
        setIntroQuestion(null);
        setTypedIntroQuestion("");
        startSimulation(s.turns.length, 1);
        return;
      }

      await streamDebate(resolvedTopic, resolvedFormat, (event) => {
        if (generationRunRef.current !== runId) return;

        if (event.type === "session") {
          receivedSession = true;
          receivedTurns = event.session.turns.length;
          setSession(event.session);
          setVisible(receivedTurns);
          setIsInit(false);
          return;
        }

        if (event.type === "turn") {
          revealChain = revealChain.then(async () => {
            await wait(STREAM_TURN_REVEAL_MS);
            if (generationRunRef.current !== runId) return;
            receivedTurns += 1;
            setSession((current) => (
              current ? { ...current, turns: [...current.turns, event.turn] } : current
            ));
            setVisible(receivedTurns);
          });
          return;
        }

        if (event.type === "brief") {
          revealChain = revealChain.then(() => {
            if (generationRunRef.current !== runId) return;
            setSession((current) => (current ? { ...current, brief: event.brief } : current));
          });
          return;
        }

        if (event.type === "error") {
          setError(event.message);
        }
      });
      await revealChain;
    } catch {
      if (!receivedSession) {
        try {
          const s = await createDebate(resolvedTopic, resolvedFormat, { demoOnly: DEMO_ONLY_MODE });
          setSession(s);
          setIntroQuestion(null);
          setTypedIntroQuestion("");
          startSimulation(s.turns.length, 1);
        } catch {
          setIntroQuestion(null);
          setTypedIntroQuestion("");
          setError(`Could not reach the Agora backend at ${API_BASE_URL}. Check the API URL and try again.`);
        }
      }
    } finally {
      if (generationRunRef.current === runId) {
        setIsInit(false);
        setGenerating(false);
      }
    }
  }

  // ── User intervention ────────────────────────────────────────────────────
  async function handleIntervene(text: string) {
    if (!session || !text.trim() || isIntervening || isGenerating || isSimulating) return;
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
      setError(`Intervention failed. Check that the Agora backend is reachable at ${API_BASE_URL}.`);
    } finally {
      setIsIntervene(false);
    }
  }

  function handleReset() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSession(null);
    setVisible(0);
    setSimulating(false);
    setGenerating(false);
    generationRunRef.current += 1;
    setGraphFocus(false);
    setActiveArenaTab("debate");
    setTopic("");
    setError(null);
    setHiddenExpertIds(new Set());
    setIntroQuestion(null);
    setTypedIntroQuestion("");
    setJustIntervenedMsg(null);
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const visibleExperts = useMemo(
    () => session ? session.experts.filter((expert) => !hiddenExpertIds.has(expert.id)) : [],
    [hiddenExpertIds, session]
  );
  const hiddenExperts = useMemo(
    () => session ? session.experts.filter((expert) => hiddenExpertIds.has(expert.id)) : [],
    [hiddenExpertIds, session]
  );
  const visibleExpertIds = useMemo(
    () => new Set(visibleExperts.map((expert) => expert.id)),
    [visibleExperts]
  );
  const panelSession = useMemo(() => {
    if (!session) return null;
    return {
      ...session,
      experts: visibleExperts,
      turns: session.turns.filter((turn) => turn.speaker_id === "moderator" || visibleExpertIds.has(turn.speaker_id)),
    };
  }, [session, visibleExpertIds, visibleExperts]);
  const panelVisibleCount = useMemo(
    () => session
      ? session.turns
        .slice(0, visibleCount)
        .filter((turn) => turn.speaker_id === "moderator" || visibleExpertIds.has(turn.speaker_id))
        .length
      : 0,
    [session, visibleCount, visibleExpertIds]
  );
  const panelTurnIndexes = useMemo(
    () => session
      ? session.turns
        .map((turn, index) => (
          turn.speaker_id === "moderator" || visibleExpertIds.has(turn.speaker_id) ? index + 1 : null
        ))
        .filter((index): index is number => index != null)
      : [],
    [session, visibleExpertIds]
  );
  const visibleTurns = useMemo(
    () => (panelSession ? panelSession.turns.slice(0, panelVisibleCount) : []),
    [panelSession, panelVisibleCount]
  );

  const activeSpeaker = useMemo(() => {
    if (!session) return null;
    if (isGenerating) {
      const latest = session.turns.at(-1);
      const expert = session.experts.find((e) => e.id === latest?.speaker_id) ?? null;
      return expert && !hiddenExpertIds.has(expert.id) ? expert : null;
    }
    if (!isSimulating || visibleCount >= session.turns.length) return null;
    const next = session.turns[visibleCount];
    const expert = session.experts.find((e) => e.id === next?.speaker_id) ?? null;
    return expert && !hiddenExpertIds.has(expert.id) ? expert : null;
  }, [hiddenExpertIds, session, isGenerating, isSimulating, visibleCount]);

  const summary = useMemo(
    () => (panelSession ? summarizeGraph(panelSession, panelVisibleCount) : null),
    [panelSession, panelVisibleCount]
  );

  const replayTotal = session?.turns.length ?? 0;
  const total = panelSession?.turns.length ?? 0;
  const displayTotal = isGenerating ? Math.max(total, EXPECTED_DEBATE_TURNS) : total;
  const traceRows = useMemo(() => {
    if (!session || !summary) return [];
    const latestTurn = visibleTurns.at(-1);
    return [
      {
        label: "Run Mode",
        value: session.mode === "openai" ? "Turn-by-turn OpenAI" : "Curated replay",
      },
      {
        label: "Trace State",
        value: `${panelVisibleCount}/${displayTotal} claims revealed`,
      },
      {
        label: "Belief Events",
        value: `${summary.contested} contested · ${summary.revised} revised`,
      },
      {
        label: "Latest Lineage",
        value: latestTurn?.target_id ? `${latestTurn.target_id} → ${latestTurn.id}` : "root claim",
      },
    ];
  }, [displayTotal, panelVisibleCount, session, summary, visibleTurns]);

  const isFinished = session != null && visibleCount >= replayTotal && !isGenerating && !isIntervening;
  const canIntervene = session != null && !isGenerating && !isSimulating && !isIntervening && visibleCount > 0;
  const verdictItems = session ? [
    { title: "Decision",                key: "strongest_position" as const,      cls: "green" },
    { title: "Weakest Assumption",      key: "weakest_assumption" as const,      cls: "amber" },
    { title: "Unresolved Disagreement", key: "unresolved_disagreement" as const, cls: "red" },
    { title: "Next Research Question",  key: "next_question" as const,           cls: "indigo" },
  ] : [];

  function stepToPanel(n: number) {
    if (!session) return;
    pause();
    if (n <= 0) {
      setVisible(0);
      return;
    }
    setVisible(panelTurnIndexes[Math.min(panelTurnIndexes.length, n) - 1] ?? replayTotal);
  }

  function hideExpert(id: string) {
    setHiddenExpertIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  function showExpert(id: string) {
    setHiddenExpertIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {introQuestion && (
        <div className={styles.introOverlay} aria-live="polite">
          <div className={styles.introFrame}>
            <span className={styles.introKicker}>Question intake</span>
            <div className={styles.introQuestion}>
              <span>{typedIntroQuestion}</span>
            </div>
            <div className={styles.introStatus}>
              <span>Credential lenses assembled</span>
              <span>Argument graph initializing</span>
              <span>Replay trace queued</span>
            </div>
          </div>
        </div>
      )}

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
                  {session.mode === "openai" ? (<><Zap size={11} /> Turn-by-turn</>) : (<><Play size={11} /> Curated replay</>)}
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
                What should the panel debate?
              </h1>
              <p className={styles.heroSub}>
                Ask a hard AI question. Agora turns it into a replayable argument map.
              </p>
            </div>

            <div className={styles.setupGrid}>
              <div className={styles.setupCard}>
                <div className={styles.field}>
                  <label className="sr-only" htmlFor="topic-input">What should the panel debate?</label>
                  <textarea
                    id="topic-input"
                    className={styles.textarea}
                    rows={2}
                    placeholder="e.g. Should frontier AI model weights be open sourced?"
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
                  disabled={isInitializing || isGenerating || !topic.trim()}
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
                    {isGenerating ? "Revealing one claim at a time…" : isSimulating ? "Replaying trace…" : isIntervening ? "Applying your challenge…" : "Analysis complete"}
                  </span>
                </div>
                <h2 className={styles.topicBarTitle}>{session.topic}</h2>
              </div>

              {summary && (
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Activity size={11} /> Convergence</span>
                    <span className={styles.metricValue}>{signalLabel(summary.convergence)}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Flame size={11} /> Contested</span>
                    <span className={styles.metricValue}>{summary.contested}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}><Target size={11} /> Claims</span>
                    <span className={styles.metricValue}>{panelVisibleCount}/{displayTotal}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.guideStrip}>
              <span><b>1</b><GitBranch size={12} /> Watch each claim appear</span>
              <span><b>2</b><FileText size={12} /> Read the exact argument</span>
              <span><b>3</b><Send size={12} /> Challenge after the trace finishes</span>
            </div>

            <div className={styles.arenaTabs} role="tablist" aria-label="Arena views">
              <button
                className={styles.arenaTab}
                data-active={activeArenaTab === "debate" ? "true" : "false"}
                type="button"
                role="tab"
                aria-selected={activeArenaTab === "debate"}
                onClick={() => setActiveArenaTab("debate")}
              >
                <GitBranch size={14} />
                <span>Debate Trace</span>
              </button>
              <button
                className={styles.arenaTab}
                data-active={activeArenaTab === "verdict" ? "true" : "false"}
                type="button"
                role="tab"
                aria-selected={activeArenaTab === "verdict"}
                onClick={() => setActiveArenaTab("verdict")}
              >
                <FileText size={14} />
                <span>Final Verdict</span>
                <em>{isFinished ? "Ready" : `${panelVisibleCount}/${displayTotal}`}</em>
              </button>
            </div>

            {/* Three-column grid */}
            {activeArenaTab === "debate" ? (
              <>
                <div className={styles.arenaGrid}>
                  {/* ── COL 1: Experts ── */}
                  <aside className={styles.col}>
                    <div className={styles.colHeader}><Users size={14} /><span>Panel</span><span className={styles.colCount}>{visibleExperts.length}/{session.experts.length}</span></div>
                    <div className={styles.expertList}>
                      {visibleExperts.map((exp) => {
                        const isActive = activeSpeaker?.id === exp.id;
                        const credential = getCredentialCode(exp.role);
                        return (
                          <div key={exp.id} className={`${styles.expertCard} ${isActive ? styles.expertPulse : ""}`} data-stance={exp.stance}>
                            <div className={styles.expertAvatarWrap}>
                              <div className={styles.expertAvatar} data-stance={exp.stance}>{credential}</div>
                              {isActive && <div className={styles.avatarRing} />}
                            </div>
                            <div className={styles.expertInfo}>
                              <span className={styles.expertName}>{exp.role}</span>
                            </div>
                            <div className={styles.expertStance} data-stance={exp.stance}>{exp.stance}</div>
                            <button className={styles.expertToggle} type="button" onClick={() => hideExpert(exp.id)} aria-label={`Remove ${exp.role} from visible panel`}>
                              <X size={11} />
                            </button>
                            {isActive && <div className={styles.typingBubble}><span /><span /><span /></div>}
                          </div>
                        );
                      })}
                      {hiddenExperts.length > 0 && (
                        <div className={styles.addBackPanel}>
                          <span className={styles.addBackLabel}>Add back</span>
                          {hiddenExperts.map((exp) => (
                            <button key={exp.id} type="button" className={styles.addBackBtn} onClick={() => showExpert(exp.id)}>
                              <Plus size={11} />
                              <span>{getCredentialCode(exp.role)}</span>
                              <em>{exp.role}</em>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </aside>

                  {/* ── COL 2: Argument graph (HERO) ── */}
                  <section className={styles.graphCol}>
                    <div className={styles.colHeader}>
                      <GitBranch size={14} /><span>Argument Map</span>
                      <div className={styles.legend}>
                        <span className={styles.legendItem} data-rel="supports">Supports</span>
                        <span className={styles.legendItem} data-rel="challenges">Challenges</span>
                        <span className={styles.legendItem} data-rel="revises">Revises</span>
                      </div>
                    </div>

                    <div className={styles.graphCanvas}>
                      <button
                        className={styles.graphFocusFab}
                        type="button"
                        onClick={() => setGraphFocus(true)}
                        aria-label="Open argument graph full screen"
                        title="Open graph full screen"
                      >
                        <Maximize2 size={15} />
                        <span>Full screen</span>
                      </button>
                      <ArgumentGraph session={panelSession ?? session} visibleCount={panelVisibleCount} activeSpeakerId={activeSpeaker?.id ?? null} />
                      {isIntervening && (
                        <div className={styles.graphOverlay}>
                          <Loader2 size={18} className={styles.spin} />
                          <span>Re-orchestrating the argument graph…</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.tracePanel}>
                      <div className={styles.traceHead}><Activity size={13} /><span>Reasoning Trace</span></div>
                      <div className={styles.traceGrid}>
                        {traceRows.map((row) => (
                          <div key={row.label} className={styles.traceItem}>
                            <span className={styles.traceLabel}>{row.label}</span>
                            <span className={styles.traceValue}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline scrubber */}
                    <div className={styles.timeline}>
                      <button className={styles.playBtn} onClick={togglePlay} aria-label={isSimulating ? "Pause" : "Play"}>
                        {isSimulating ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <button className={styles.stepBtn} onClick={() => stepToPanel(panelVisibleCount - 1)} disabled={panelVisibleCount <= 0} aria-label="Step back"><SkipBack size={14} /></button>
                      <div className={styles.scrubTrack}>
                        {(panelSession?.turns ?? []).map((t, i) => {
                          const on = i < panelVisibleCount;
                          const cur = i === panelVisibleCount - 1;
                          return (
                            <button
                              key={t.id}
                              className={styles.scrubDot}
                              data-on={on ? "true" : "false"}
                              data-current={cur ? "true" : "false"}
                              data-rel={t.relation}
                              title={t.headline}
                              onClick={() => stepToPanel(i + 1)}
                            />
                          );
                        })}
                      </div>
                      <button className={styles.stepBtn} onClick={() => stepToPanel(panelVisibleCount + 1)} disabled={panelVisibleCount >= total} aria-label="Step forward"><SkipForward size={14} /></button>
                      <span className={styles.timelineCount}>{panelVisibleCount}/{displayTotal}</span>
                    </div>
                  </section>

                  {/* ── COL 3: Transcript + intervention ── */}
                  <section className={styles.transcript}>
                    <div className={styles.colHeader}><FileText size={14} /><span>Argument Log</span><span className={styles.colCount}>{panelVisibleCount}/{total}</span></div>

                    <div className={styles.turnList} ref={transcriptRef}>
                      {justIntervenedMsg && (
                        <div className={styles.interventionBanner}><Zap size={13} /><span>You intervened: <em>&ldquo;{justIntervenedMsg}&rdquo;</em></span></div>
                      )}

                      {visibleTurns.map((turn) => {
                        const isMod  = turn.speaker_id === "moderator";
                        const expert = session.experts.find((e) => e.id === turn.speaker_id);
                        const speakerTitle = getSpeakerTitle(expert?.role, isMod);
                        const credential = getCredentialCode(expert?.role, isMod);
                        const rel    = getRelationMeta(turn.relation);
                        const RelIcon = rel.Icon;
                        return (
                          <article key={turn.id} className={`${styles.turn} ${isMod ? styles.turnMod : styles.turnExpert}`}>
                            <div className={styles.turnHead}>
                              {isMod ? (
                                <div className={styles.modAvatar}><MessageSquare size={13} /></div>
                              ) : (
                                <div className={styles.turnAvatar} data-stance={expert?.stance}>
                                  <span className={styles.initials}>{credential}</span>
                                </div>
                              )}
                              <div className={styles.turnMeta}>
                                <span className={styles.turnSpeaker}>{speakerTitle}</span>
                                {!isMod && expert && <span className={styles.turnRole}>{credential} credential</span>}
                              </div>
                              <div className={`${styles.relBadge} ${styles[`rel_${rel.cls}`]}`}><RelIcon size={11} /><span>{rel.label}</span></div>
                            </div>
                            <div className={styles.turnBody}>
                              <p className={styles.claim}>{turn.claim}</p>
                              {turn.evidence && (
                                <div className={styles.evidenceBox}>
                                  <span className={styles.evidenceTag}><Info size={11} /> Evidence Lead</span>
                                  <p className={styles.evidenceText}>{turn.evidence}</p>
                                  {turn.sources.length > 0 && (
                                    <details className={styles.sourceDisclosure}>
                                      <summary>Show evidence leads</summary>
                                      <div className={styles.sourceList}>
                                        {turn.sources.map((source) => (
                                          <div key={`${turn.id}-${source.label}`} className={styles.sourceCard}>
                                            <div className={styles.sourceTop}>
                                              <span className={styles.sourceLabel}>{source.label}</span>
                                              <span className={styles.sourceType}>{source.source_type}</span>
                                            </div>
                                            <p className={styles.sourceRelevance}>{source.relevance}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}

                      {activeSpeaker && (
                        <div className={styles.typingRow}>
                          <div className={styles.turnAvatar} data-stance={activeSpeaker.stance}><span className={styles.initials}>{getCredentialCode(activeSpeaker.role)}</span></div>
                          <div className={styles.typingContent}>
                            <span className={styles.turnSpeaker}>{activeSpeaker.role}</span>
                            <div className={styles.typingDots}><span /><span /><span /></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Intervention input */}
                    <div className={styles.interventionBox}>
                      {canIntervene && (
                        <details className={styles.quickDisclosure}>
                          <summary>Suggested interventions</summary>
                          <div className={styles.quickInterventions}>
                            {QUICK_INTERVENTIONS.map((q) => (
                              <button key={q} type="button" className={styles.quickBtn} onClick={() => handleIntervene(q)}>{q}</button>
                            ))}
                          </div>
                        </details>
                      )}
                      <div className={styles.inputRow}>
                        <input
                          type="text"
                          className={styles.inputField}
                          placeholder={isGenerating ? "Claims are still appearing…" : isSimulating ? "Pause the replay to intervene…" : isIntervening ? "Applying your challenge…" : "Challenge a claim, direct a speaker, or inject evidence…"}
                          disabled={isGenerating || isSimulating || isIntervening}
                          value={interventionText}
                          onChange={(e) => setIText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleIntervene(interventionText); }}
                        />
                        <button type="button" className={styles.sendBtn} disabled={isGenerating || isSimulating || isIntervening || !interventionText.trim()} onClick={() => handleIntervene(interventionText)}>
                          {isIntervening ? <Loader2 size={15} className={styles.spin} /> : <Send size={15} />}
                        </button>
                      </div>
                      {error && (<div className={styles.errorBanner} style={{ marginTop: "0.5rem" }}><AlertTriangle size={13} /><span>{error}</span></div>)}
                    </div>
                  </section>
                </div>

                <button
                  className={styles.bottomVerdictButton}
                  type="button"
                  onClick={() => setActiveArenaTab("verdict")}
                >
                  <FileText size={16} />
                  <span>Open Final Verdict</span>
                  <em>{isFinished ? "Ready" : `${panelVisibleCount}/${displayTotal} claims reviewed`}</em>
                </button>
              </>
            ) : (
              <section className={styles.verdictPanel} data-ready={isFinished ? "true" : "false"}>
                <div className={styles.verdictHero}>
                  <span className={styles.verdictEyebrow}>Final Verdict</span>
                  <h2 className={styles.verdictTitle}>{isFinished ? "Decision brief" : "Verdict forming…"}</h2>
                  <p className={styles.verdictSummary}>
                    {isFinished
                      ? session.brief.strongest_position
                      : "The panel is still revealing claims. Let the trace finish, then use this tab as the final screen in your demo video."}
                  </p>
                  <div className={styles.verdictMeta}>
                    <span>Convergence: <strong>{signalLabel(summary?.convergence ?? 0)}</strong></span>
                    <span>Claims reviewed: <strong>{panelVisibleCount}/{displayTotal}</strong></span>
                    <span>Mode: <strong>{session.mode === "openai" ? "Turn-by-turn" : "Curated replay"}</strong></span>
                  </div>
                </div>

                <div className={styles.verdictGrid}>
                  {verdictItems.map(({ title, key, cls }) => (
                    <article key={key} className={styles.verdictCard} data-accent={cls}>
                      <span className={styles.verdictCardTitle}>{title}</span>
                      <p className={styles.verdictCardText}>{session.brief[key]}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {isGraphFocus && (
              <div className={styles.focusOverlay} role="dialog" aria-modal="true" aria-label="Full screen argument graph">
                <div className={styles.focusTopbar}>
                  <div>
                    <span className={styles.focusEyebrow}>Argument Graph Focus</span>
                    <h3 className={styles.focusTitle}>{session.topic}</h3>
                  </div>
                  <button className={styles.closeFocusBtn} type="button" onClick={() => setGraphFocus(false)} aria-label="Close graph focus mode">
                    <X size={17} />
                  </button>
                </div>

                <div className={styles.focusGraphCanvas}>
                  <ArgumentGraph session={panelSession ?? session} visibleCount={panelVisibleCount} activeSpeakerId={activeSpeaker?.id ?? null} />
                </div>

                <div className={styles.focusBottom}>
                  <div className={styles.tracePanel}>
                    <div className={styles.traceHead}><Activity size={13} /><span>Reasoning Trace</span></div>
                    <div className={styles.traceGrid}>
                      {traceRows.map((row) => (
                        <div key={row.label} className={styles.traceItem}>
                          <span className={styles.traceLabel}>{row.label}</span>
                          <span className={styles.traceValue}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.timeline}>
                    <button className={styles.playBtn} onClick={togglePlay} aria-label={isSimulating ? "Pause" : "Play"}>
                      {isSimulating ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button className={styles.stepBtn} onClick={() => stepToPanel(panelVisibleCount - 1)} disabled={panelVisibleCount <= 0} aria-label="Step back"><SkipBack size={14} /></button>
                    <div className={styles.scrubTrack}>
                      {(panelSession?.turns ?? []).map((t, i) => {
                        const on = i < panelVisibleCount;
                        const cur = i === panelVisibleCount - 1;
                        return (
                          <button
                            key={t.id}
                            className={styles.scrubDot}
                            data-on={on ? "true" : "false"}
                            data-current={cur ? "true" : "false"}
                            data-rel={t.relation}
                            title={t.headline}
                            onClick={() => stepToPanel(i + 1)}
                          />
                        );
                      })}
                    </div>
                    <button className={styles.stepBtn} onClick={() => stepToPanel(panelVisibleCount + 1)} disabled={panelVisibleCount >= total} aria-label="Step forward"><SkipForward size={14} /></button>
                    <span className={styles.timelineCount}>{panelVisibleCount}/{displayTotal}</span>
                  </div>
                </div>
              </div>
            )}
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
