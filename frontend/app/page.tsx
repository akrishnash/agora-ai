"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
  Quote,
  RefreshCw,
  SearchCheck,
  Sparkles,
  Wand2
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

const softFlags = [
  ["Loaded word", "“obviously”"],
  ["Overreach", "“everyone”"],
  ["Missing context", "“code”"]
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
      setError("Start the backend on port 8001, then try again.");
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
          "Rewrite this claim into a clearer, less misleading version."
        )
      );
    } catch {
      setError("Could not refresh the check. Backend might be asleep.");
    } finally {
      setIsLoading(false);
    }
  }

  const score = useMemo(() => {
    if (!session) return 62;
    const average = session.graph.reduce((sum, item) => sum + item.confidence, 0) / session.graph.length;
    const penalty = session.graph.filter((item) => item.status !== "supported").length * 9;
    return Math.max(35, Math.min(86, Math.round(average - penalty)));
  }, [session]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <SearchCheck size={22} />
          <span>DebateVerify</span>
        </div>
        <nav>
          <a href="#check">Check</a>
          <a href="#report">Report</a>
          <a href="#examples">Examples</a>
        </nav>
      </header>

      <section className={styles.hero} id="check">
        <p className={styles.eyebrow}>Your calm claim checker</p>
        <h1>Spot weak claims before they spread.</h1>
        <p className={styles.subcopy}>
          Paste a claim. DebateVerify finds loaded wording, missing context, and a cleaner
          way to say it.
        </p>

        <div className={styles.claimDock}>
          <div className={styles.inputWidget}>
            <Quote size={18} />
            <textarea
              aria-label="Claim to verify"
              onChange={(event) => setClaim(event.target.value)}
              rows={3}
              value={claim}
            />
          </div>
          <button className={styles.checkButton} disabled={isLoading} onClick={() => analyze()} type="button">
            {isLoading ? <Loader2 className={styles.spin} size={18} /> : <ArrowRight size={18} />}
            Check
          </button>
        </div>

        <div className={styles.exampleRow} id="examples">
          {examples.map((example) => (
            <button key={example} onClick={() => analyze(example)} type="button">
              {example}
            </button>
          ))}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
      </section>

      <section className={styles.preview} id="report">
        <div className={styles.mockWindow}>
          <div className={styles.windowTop}>
            <span />
            <span />
            <span />
            <strong>Live check</strong>
          </div>

          <div className={styles.widgetGrid}>
            <article className={styles.scoreWidget}>
              <span>Verdict</span>
              <strong>Partly supported</strong>
              <div>
                <i style={{ width: `${score}%` }} />
              </div>
              <small>{score}% confidence</small>
            </article>

            <article className={styles.cleanWidget}>
              <div>
                <Wand2 size={18} />
                <span>Cleaner version</span>
              </div>
              <p>
                {session?.brief.strongest_position ||
                  "Open releases may improve scrutiny, but frontier AI needs staged access based on risk."}
              </p>
              <button disabled={!session || isLoading} onClick={sharpen} type="button">
                {isLoading ? <Loader2 className={styles.spin} size={16} /> : <RefreshCw size={16} />}
                Refine
              </button>
            </article>

            <article className={styles.flagsWidget}>
              <span>Weak spots</span>
              {softFlags.map(([label, value]) => (
                <div key={label}>
                  <CircleAlert size={15} />
                  <strong>{label}</strong>
                  <em>{value}</em>
                </div>
              ))}
            </article>

            <article className={styles.nextWidget}>
              <Sparkles size={19} />
              <span>Next thing to verify</span>
              <p>
                {session?.brief.next_question ||
                  "What evidence would show that openness improves safety without increasing misuse?"}
              </p>
            </article>
          </div>
        </div>

        <div className={styles.promiseStrip}>
          <div>
            <Check size={16} />
            No outrage meter
          </div>
          <div>
            <Check size={16} />
            No wall of text
          </div>
          <div>
            <Check size={16} />
            Just the weak spots
          </div>
        </div>
      </section>
    </main>
  );
}
