"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gauge,
  GitBranch,
  Loader2,
  MessageSquareWarning,
  Radio,
  Scale,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Wand2
} from "lucide-react";
import { useMemo, useState } from "react";
import { createDebate, injectIntervention } from "@/lib/api";
import type { DebateFormat, DebateSession } from "@/lib/types";
import styles from "./page.module.css";

const exampleClaims = [
  "Open-source AGI is obviously safer because everyone can inspect the code.",
  "Interest rates will drop by 2% this year because inflation is solved.",
  "A new study proves caffeine prevents cognitive decline."
];

const auditFindings = [
  {
    label: "Loaded language",
    token: "obviously",
    tone: "bias",
    explanation: "Attempts to preempt disagreement by implying the conclusion is already settled."
  },
  {
    label: "Overgeneralization",
    token: "everyone can inspect",
    tone: "warning",
    explanation: "Assumes universal expertise, time, access, and incentive to audit frontier systems."
  },
  {
    label: "Category error",
    token: "code",
    tone: "info",
    explanation: "AI risk is not only source code; weights, data, evaluations, deployment, and misuse pathways matter."
  }
];

const quickActions = [
  "Fact-check the strongest pro claim.",
  "Find the weakest assumption.",
  "Challenge the con argument.",
  "Rewrite the claim more accurately."
];

const debateFormat: DebateFormat = "Scientific Review";

export default function Home() {
  const [claim, setClaim] = useState(exampleClaims[0]);
  const [session, setSession] = useState<DebateSession | null>(null);
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeClaim(nextClaim = claim) {
    setClaim(nextClaim);
    setIsLoading(true);
    setError(null);
    try {
      const result = await createDebate(nextClaim, debateFormat);
      setSession(result);
    } catch {
      setError("Could not reach DebateVerify API. Start the FastAPI backend on port 8001.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runIntervention(nextInstruction = instruction) {
    if (!session || !nextInstruction.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await injectIntervention(session, nextInstruction.trim());
      setSession(result);
      setInstruction("");
    } catch {
      setError("The live audit could not be updated. Check the backend and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!session) {
    return (
      <main className={styles.landing}>
        <header className={styles.landingHeader}>
          <div className={styles.logo}>
            <SearchCheck size={22} />
            <span>DebateVerify</span>
          </div>
          <div className={styles.extensionPill}>
            <ExternalLink size={15} />
            Browser extension mode
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <Sparkles size={16} />
            AI media literacy lab
          </div>
          <h1>Paste a claim. Watch AI agents test it from every angle.</h1>
          <p>
            DebateVerify stages opposing arguments, checks evidence quality, flags
            weak reasoning, and turns messy public claims into a structured quality report.
          </p>

          <div className={styles.claimBox}>
            <label htmlFor="claim">Claim to verify</label>
            <textarea
              id="claim"
              onChange={(event) => setClaim(event.target.value)}
              rows={5}
              value={claim}
            />
            <div className={styles.claimActions}>
              <span>Supports claims, headlines, URLs, and pasted excerpts.</span>
              <button disabled={isLoading} onClick={() => analyzeClaim()} type="button">
                {isLoading ? <Loader2 className={styles.spin} size={18} /> : <ArrowRight size={18} />}
                Analyze claim
              </button>
            </div>
          </div>

          <div className={styles.examples}>
            <span>Example claims</span>
            <div>
              {exampleClaims.map((example) => (
                <button key={example} onClick={() => analyzeClaim(example)} type="button">
                  {example}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className={styles.errorBanner}>{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <AnalysisWorkspace
      claim={claim}
      error={error}
      instruction={instruction}
      isLoading={isLoading}
      onAnalyze={() => analyzeClaim()}
      onInstructionChange={setInstruction}
      onIntervention={runIntervention}
      session={session}
    />
  );
}

function AnalysisWorkspace({
  claim,
  error,
  instruction,
  isLoading,
  onAnalyze,
  onInstructionChange,
  onIntervention,
  session
}: {
  claim: string;
  error: string | null;
  instruction: string;
  isLoading: boolean;
  onAnalyze: () => void;
  onInstructionChange: (value: string) => void;
  onIntervention: (value?: string) => void;
  session: DebateSession;
}) {
  const credibility = useMemo(() => {
    const average =
      session.graph.reduce((total, node) => total + node.confidence, 0) / session.graph.length;
    const penalty = session.graph.filter((node) => node.status !== "supported").length * 8;
    return Math.max(18, Math.min(82, Math.round(average - penalty)));
  }, [session.graph]);

  const proTurns = session.turns.filter((turn) =>
    ["open", "economist", "safety"].includes(turn.speaker_id)
  );
  const conTurns = session.turns.filter((turn) => ["security", "policy"].includes(turn.speaker_id));
  const auditTurns = session.turns.filter((turn) => turn.speaker_id === "moderator");

  return (
    <main className={styles.workspaceShell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.logo}>
            <SearchCheck size={21} />
            <span>DebateVerify</span>
          </div>
          <nav>
            <button className={styles.navActive} type="button">Deep Analysis</button>
            <button type="button">Extension</button>
            <button type="button">Workspace</button>
          </nav>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.livePill}>
            <Radio size={15} />
            Live fact-checking
          </div>
          <div className={styles.scorePill}>
            <Gauge size={15} />
            Credibility {credibility}%
          </div>
        </div>
      </header>

      {error ? <div className={styles.inlineError}>{error}</div> : null}

      <section className={styles.analysisGrid}>
        <aside className={styles.claimPanel}>
          <PanelTitle icon={<FileText size={16} />} title="Original target claim" />
          <div className={styles.highlightedClaim}>
            "Open-source AGI is{" "}
            <mark className={styles.biasMark}>obviously</mark> safer because{" "}
            <mark className={styles.warningMark}>everyone can inspect</mark> the{" "}
            <mark className={styles.infoMark}>code</mark>."
          </div>

          <div className={styles.findingStack}>
            <PanelTitle icon={<MessageSquareWarning size={16} />} title="Linguistic audit" />
            {auditFindings.map((finding) => (
              <article className={styles.finding} data-tone={finding.tone} key={finding.label}>
                <div>
                  <strong>{finding.label}</strong>
                  <span>{finding.token}</span>
                </div>
                <p>{finding.explanation}</p>
              </article>
            ))}
          </div>

          <div className={styles.claimTypes}>
            <PanelTitle icon={<BadgeCheck size={16} />} title="Claim typology" />
            <div>
              <span>Factual</span>
              <span>Value</span>
              <span>Causal</span>
              <span>Framing</span>
            </div>
          </div>
        </aside>

        <section className={styles.debateStage}>
          <div className={styles.stageHeader}>
            <div>
              <span>Multi-agent verification</span>
              <h2>{claim}</h2>
            </div>
            <button disabled={isLoading} onClick={onAnalyze} type="button">
              {isLoading ? <Loader2 className={styles.spin} size={16} /> : <Wand2 size={16} />}
              Rerun
            </button>
          </div>

          <div className={styles.streams}>
            <ArgumentStream
              icon={<BrainCircuit size={18} />}
              label="Pro Agent"
              tone="pro"
              turns={proTurns}
            />
            <ArgumentStream
              icon={<ShieldAlert size={18} />}
              label="Con Agent"
              tone="con"
              turns={conTurns}
            />
          </div>

          <div className={styles.auditRail}>
            <div className={styles.auditChip}>
              <CheckCircle2 size={16} />
              Fact checker: cryptography analogy is relevant but incomplete.
            </div>
            <div className={styles.auditChipWarning}>
              <AlertTriangle size={16} />
              Logic auditor: "everyone can inspect" overstates practical auditability.
            </div>
            {auditTurns.map((turn) => (
              <div className={styles.auditChip} key={turn.claim}>
                <Scale size={16} />
                {turn.claim}
              </div>
            ))}
          </div>

          <div className={styles.commandBar}>
            <input
              onChange={(event) => onInstructionChange(event.target.value)}
              placeholder="Ask agents to fact-check, challenge, rewrite, or expose weak reasoning..."
              value={instruction}
            />
            <button disabled={isLoading} onClick={() => onIntervention()} type="button">
              Inject
            </button>
          </div>
          <div className={styles.quickActions}>
            {quickActions.map((action) => (
              <button disabled={isLoading} key={action} onClick={() => onIntervention(action)} type="button">
                {action}
              </button>
            ))}
          </div>
        </section>

        <aside className={styles.reportPanel}>
          <PanelTitle icon={<GitBranch size={16} />} title="Evidence topology" />
          <div className={styles.graphBox}>
            {session.graph.map((node, index) => (
              <article className={styles.graphNode} data-status={node.status} key={`${node.label}-${index}`}>
                <span />
                <div>
                  <strong>{node.label}</strong>
                  <small>{node.confidence}% confidence</small>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.qualityReport}>
            <PanelTitle icon={<Scale size={16} />} title="Debate quality report" />
            <div className={styles.verdict}>
              <AlertTriangle size={20} />
              <div>
                <span>Verdict</span>
                <strong>Partially supported</strong>
              </div>
            </div>
            <ReportItem
              tone="danger"
              title="False or unsupported claim"
              value='"Everyone can inspect the code" is misleading; meaningful frontier-model audits require specialist access and context.'
            />
            <ReportItem
              tone="purple"
              title="Weakest assumption"
              value={session.brief.weakest_assumption}
            />
            <ReportItem
              tone="green"
              title="Better version"
              value={
                session.brief.strongest_position ||
                "Open releases can improve scrutiny, but frontier systems need staged access based on risk."
              }
            />
            <ReportItem title="What to verify next" value={session.brief.next_question} />
            <button className={styles.shareButton} type="button">
              Generate shareable report
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className={styles.panelTitle}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

function ArgumentStream({
  icon,
  label,
  tone,
  turns
}: {
  icon: React.ReactNode;
  label: string;
  tone: "pro" | "con";
  turns: DebateSession["turns"];
}) {
  return (
    <div className={styles.argumentStream} data-tone={tone}>
      <div className={styles.streamTitle}>
        {icon}
        <span>{label}</span>
      </div>
      {turns.map((turn) => (
        <article key={`${turn.speaker_id}-${turn.claim}`}>
          <strong>{turn.relation}</strong>
          <p>{turn.claim}</p>
          <small>{turn.evidence}</small>
        </article>
      ))}
    </div>
  );
}

function ReportItem({
  title,
  tone = "neutral",
  value
}: {
  title: string;
  tone?: "danger" | "green" | "neutral" | "purple";
  value: string;
}) {
  return (
    <article className={styles.reportItem} data-tone={tone}>
      <strong>{title}</strong>
      <p>{value}</p>
    </article>
  );
}
