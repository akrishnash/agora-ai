"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  SearchCheck,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { useMemo, useState } from "react";
import { createDebate, injectIntervention } from "@/lib/api";
import type { DebateFormat, DebateSession } from "@/lib/types";
import styles from "./page.module.css";

const defaultClaim = "Open-source AGI is obviously safer because everyone can inspect the code.";
const debateFormat: DebateFormat = "Scientific Review";

const examples = [
  "Open-source AGI is obviously safer because everyone can inspect the code.",
  "This new study proves coffee prevents dementia.",
  "Remote work always makes teams less productive."
];

const flags = [
  {
    label: "Loaded language",
    text: "“obviously” pushes certainty before evidence."
  },
  {
    label: "Overreach",
    text: "“everyone can inspect” ignores expertise, access, and incentives."
  },
  {
    label: "Category mix-up",
    text: "AI safety is not just code. Weights, data, evals, deployment, and misuse matter too."
  }
];

export default function Home() {
  const [claim, setClaim] = useState(defaultClaim);
  const [session, setSession] = useState<DebateSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(nextClaim = claim) {
    setClaim(nextClaim);
    setIsLoading(true);
    setError(null);
    try {
      setSession(await createDebate(nextClaim, debateFormat));
    } catch {
      setError("Backend is not running. Start FastAPI on port 8001 and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sharpen() {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    try {
      setSession(
        await injectIntervention(
          session,
          "Rewrite this claim into a more accurate and less misleading version."
        )
      );
    } catch {
      setError("Could not update the report. Check the backend and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const score = useMemo(() => {
    if (!session) return 0;
    const avg = session.graph.reduce((sum, item) => sum + item.confidence, 0) / session.graph.length;
    const uncertaintyPenalty = session.graph.filter((item) => item.status !== "supported").length * 9;
    return Math.max(28, Math.min(84, Math.round(avg - uncertaintyPenalty)));
  }, [session]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <SearchCheck size={22} />
          <span>DebateVerify</span>
        </div>
        <span className={styles.mode}>Media literacy, without the noise</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.kicker}>
          <Sparkles size={16} />
          Claim checker for messy internet arguments
        </div>
        <h1>Drop a claim. Get the weak spots.</h1>
        <p>
          DebateVerify checks framing, evidence, assumptions, and gives you a calmer
          version of the claim.
        </p>

        <div className={styles.searchCard}>
          <textarea
            aria-label="Claim to verify"
            onChange={(event) => setClaim(event.target.value)}
            rows={4}
            value={claim}
          />
          <div className={styles.searchFooter}>
            <div className={styles.examples}>
              {examples.map((example) => (
                <button key={example} onClick={() => analyze(example)} type="button">
                  {example}
                </button>
              ))}
            </div>
            <button className={styles.primaryButton} disabled={isLoading} onClick={() => analyze()} type="button">
              {isLoading ? <Loader2 className={styles.spin} size={18} /> : <ArrowRight size={18} />}
              Check claim
            </button>
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
      </section>

      {session ? (
        <section className={styles.result}>
          <div className={styles.scoreCard}>
            <span>Verdict</span>
            <strong>Partly supported</strong>
            <div className={styles.scoreBar}>
              <i style={{ width: `${score}%` }} />
            </div>
            <small>{score}% confidence after checking assumptions and evidence quality</small>
          </div>

          <div className={styles.reportGrid}>
            <article className={styles.claimReview}>
              <h2>What’s shaky?</h2>
              <div className={styles.highlightedClaim}>
                Open-source AGI is <mark>obviously</mark> safer because{" "}
                <mark>everyone can inspect</mark> the <mark>code</mark>.
              </div>
              <div className={styles.flags}>
                {flags.map((flag) => (
                  <div key={flag.label}>
                    <TriangleAlert size={16} />
                    <span>{flag.label}</span>
                    <p>{flag.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.takeaway}>
              <h2>Cleaner version</h2>
              <p>
                {session.brief.strongest_position ||
                  "Open releases can improve scrutiny, but frontier AI may need staged access based on risk."}
              </p>
              <div className={styles.nextBox}>
                <CheckCircle2 size={17} />
                <span>{session.brief.next_question}</span>
              </div>
              <button className={styles.secondaryButton} disabled={isLoading} onClick={sharpen} type="button">
                {isLoading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}
                sharpen report
              </button>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
