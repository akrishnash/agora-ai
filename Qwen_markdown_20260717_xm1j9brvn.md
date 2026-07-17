# 🏆 Agora AI: The Hackathon Winning Playbook

**Goal:** Don't just build a multi-agent wrapper. Build the definitive tool for structured reasoning. 
**Mantra:** "Search engines organize information. Agora AI organizes reasoning."

---

## Phase 1: The "Secret Sauce" (How to Actually Win)
Multi-agent chatbots are common in hackathons. To win, you must differentiate. Here is how Agora beats the competition:

1. **The Visual "Aha!" Moment:** Do not just show a chat window. The **Argument Graph** is your star. When an expert challenges a claim, the node on the graph must visually change (e.g., from Green [Supported] to Yellow [Contested] to Blue [Revised]). Judges need to *see* the reasoning shift.
2. **The "Mind-Change" Demo:** Judges love seeing an AI admit it was wrong. Script your demo so that Expert A makes a strong claim, Expert B introduces a specific piece of evidence, and Expert A explicitly *revises* their stance. 
3. **Strict Structured Outputs:** Many teams will use messy prompt chaining. You are using the **OpenAI Responses API with strict JSON schema**. Highlight this in your pitch. It proves your app is production-ready, not just a hack.
4. **The "Director" UX:** Don't make the user a passive reader. The "Intervention" mechanic (injecting evidence mid-debate) makes the user feel like a director guiding the AI, not just a prompter.

---

## Phase 2: The Build Execution Plan

### 🚨 Immediate Priority (Today)
- [ ] **Claim Credits:** Team rep fills out the credit request form immediately.
- [ ] **Lock the Fallback:** Build the Deterministic Demo Mode. Hardcode a 3-turn AGI debate. If the API fails during the judging period, you just toggle a boolean and the app runs perfectly.

### Sprint 1: Backend & Orchestration (FastAPI + OpenAI)
- [ ] **Define the Schema:** Create Pydantic models for `ExpertPanel`, `DebateTurn`, `ClaimNode`, and `ArgumentGraph`.
- [ ] **The Moderator Agent:** Build the logic that takes the last 2 turns and decides: *Who speaks next? What is their stance? What evidence do they cite?*
- [ ] **Streaming:** Use the OpenAI Responses API streaming endpoint. Stream the text to the frontend immediately, but wait for the final JSON block to update the Argument Graph.

### Sprint 2: Frontend & Visualization (Next.js)
- [ ] **Split Screen UI:** Left side = Live Transcript (clean, readable). Right side = Argument Graph (interactive).
- [ ] **Graph Library:** Use `react-flow` or `recharts` (if doing a simpler tree). Make it look sleek. Dark mode is highly recommended for "hacker/developer" tools.
- [ ] **Intervention UI:** Add a sleek input bar at the bottom: *"Inject evidence or redirect debate..."*

### Sprint 3: The Polish (The 20% that gets 80% of the points)
- [ ] **Loading States:** Multi-agent generation takes time. Build beautiful, thematic loading states (e.g., "Convening the panel...", "Synthesizing counter-arguments...").
- [ ] **The Decision Brief:** The final output must be a gorgeous, formatted summary (Strongest Position, Weakest Assumption, Unresolved Disagreement).

---

## Phase 3: The 3-Minute Winning Demo Script
*Judges watch hundreds of demos. You have 30 seconds to hook them. Practice this script until it is flawless.*

**[0:00 - 0:30] The Hook**
> "Most AI tools give you one confident answer, hiding the nuance. ChatGPT organizes text, but Agora AI organizes *reasoning*. We built Agora to solve the 'illusion of consensus' in LLMs."

**[0:30 - 1:15] The Live Debate (Show, Don't Tell)**
> "Let's ask a hard question: *'Should AGI models be open source?'* Watch as Agora instantly convenes an AI Safety Researcher, an Economist, and a Security Expert. Notice the Argument Graph on the right building in real-time. The Economist argues for open-source innovation..." *(Point to the graph node turning green)*.

**[1:15 - 2:00] The Intervention & The Mind-Change**
> "But wait. The Security Researcher pushes back, citing recent dual-use malware data. The node turns yellow—it's contested. **Here is where Agora gets powerful: I can intervene.** I'm going to inject a new piece of evidence: *'Assume open-source weights are restricted to verified researchers.'* Watch the AI Safety Researcher update their position based on my constraint." *(Show the node turning blue/revised)*.

**[2:00 - 2:40] The Synthesis**
> "The debate concludes. Agora doesn't just give a summary; it generates a Decision Brief. It highlights the strongest position, the weakest assumption, and the exact next research question needed to resolve the deadlock. We didn't just get an answer; we got a mapped-out thought process."

**[2:40 - 3:00] The Close**
> "Built on Next.js and FastAPI, leveraging the OpenAI Responses API with strict structured outputs to guarantee reliable graph generation. Search engines organize information. Agora AI organizes reasoning. Thank you."

---

## Phase 4: Technical & Submission Checklist

### The Code
- [ ] **Clean up the Repo:** Remove `console.log`s, commented-out code, and `.env` files.
- [ ] **The README.md:** This is your landing page. It must include:
  - The One-Liner.
  - A GIF or screenshot of the Argument Graph.
  - Clear instructions on how to run it locally.
  - A section explicitly detailing how you used the OpenAI Responses API and Structured Outputs.

### The Submission
- [ ] **RECORD A BACKUP VIDEO:** The #1 reason hackathon projects fail is the live demo crashing. Record a crisp, 3-minute Loom/video of you executing the exact script above. Upload it to YouTube unlisted and link it in your submission.
- [ ] **Deploy the Frontend:** Deploy the Next.js app to Vercel. Judges will not clone your repo to test it. Give them a live URL.
- [ ] **Deploy the Backend:** Deploy FastAPI to Railway, Render, or Fly.io. 
- [ ] **Seed the Database/State:** Ensure the live deployed version has a "Start Demo" button that triggers your Deterministic Fallback so judges can see it work instantly without waiting for API generation.

---

## Phase 5: Hackathon Survival Rules
1. **Scope Down:** If the Argument Graph is too hard to build perfectly in time, make it a simple linear timeline of claims instead of a complex web. *A simple feature that works perfectly beats a complex feature that is broken.*
2. **Sleep:** Do not pull an all-nighter before the demo. A tired presenter stumbles. A well-rested presenter sells the vision.
3. **Embrace the Fallback:** If the live API is acting weird during the judging window, do not panic. Switch to the Deterministic Mode. The judges are judging the *product vision and UX*, not your ability to keep a server from timing out.

**Now, close this file and start building. Good luck.**