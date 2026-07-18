# Build Week Demo Plan

## Goal

Show that Agora AI is not a chatbot. It is a system for producing replayable reasoning artifacts where expert agents debate turn by turn, challenge each other, update positions, expose evidence leads, and produce a useful decision brief.

## Demo Topic

Should AGI models be open source?

This topic is ideal for the hackathon because it is timely, controversial, and naturally demonstrates technical, legal, economic, security, and safety perspectives.

## 3-Minute Flow

### 0:00-0:20 - Start With The Question

Open the app directly on the arena screen. Enter the topic and choose Oxford Debate.

### 0:20-0:45 - Generated Panel

Show Agora assembling the expert panel:

- AI Safety Researcher
- Open-Source Advocate
- Security Researcher
- Innovation Economist
- Technology Policy Lawyer

### 0:45-1:30 - Live Debate

Experts make short evidence-backed claims. The transcript should feel active, not like a static essay. Point out that the graph, signal meters, reasoning trace, and evidence leads are all state derived from the same debate turns.

### 1:30-2:00 - User Intervention

Inject: "Security researcher, challenge the open-source advocate."

Agora should route the intervention to the right speaker and update the argument graph.

### 2:00-2:30 - Position Shift

Inject new evidence and show one expert revising their stance. This is the signature moment.

### 2:30-3:00 - Final Brief

Show the moderator brief:

- strongest position
- weakest assumption
- unresolved disagreement
- next question to research

End with: "Search engines organize information. Agora organizes reasoning."

## Judging Alignment

- Technological implementation: multi-agent orchestration, structured outputs, debate state, streaming-ready UI.
- Technical depth: OpenAI mode creates the expert panel, then generates each turn in a separate structured call conditioned on prior turns.
- Traceability: visible run mode, replay state, edge lineage, signal propagation, evidence leads, and an auditable graph.
- Security: deterministic fallback, schema validation, configurable CORS, and no required API key for the public demo.
- Design: serious intelligence-tool interface with a replayable graph and intervention controls.
- Potential impact: education, policy analysis, research, product strategy, and critical thinking.
- Quality of idea: an interactive reasoning arena instead of a passive answer bot.
