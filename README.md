# Agora AI

Agora AI is an interactive reasoning platform for exploring complex questions through live debates between AI expert agents. Instead of returning one answer, Agora assembles a panel of domain perspectives, lets them argue with evidence, allows the user to interrupt or introduce new information, and ends with a clear map of consensus, disagreement, weak assumptions, and next steps.

## Hackathon Vision

Search engines organize information. Agora organizes reasoning.

The project is being built for OpenAI Build Week as a complete product that demonstrates multi-agent orchestration, structured outputs, evidence-aware discussion, user intervention, and a polished product experience.

## Core Experience

1. Enter a difficult question.
2. Agora generates an ideal expert panel for the topic.
3. A moderator runs a structured debate.
4. Experts make claims, challenge each other, and cite supporting evidence.
5. The user can interrupt, ask follow-ups, or inject new evidence.
6. The debate updates its argument graph and final reasoning brief.

## Current Features

- **Living argument graph** (React Flow): every debate turn is a node, and each turn is linked to the earlier claim it answers by a colored edge — green *supports*, red *challenges*, amber *revises*. The graph grows turn by turn as the debate unfolds.
- **Live belief revision**: when a claim is challenged, the engine propagates a confidence penalty to the target node — its meter visibly drops and its status flips to *contested* or *revised*, in real time.
- **Timeline scrubber**: play, pause, step, or click any point to rewind the reasoning; the graph, confidences, and status re-derive for that moment in the debate.
- **User intervention**: challenge a claim or inject evidence, and the panel appends new turns, grows the graph, and rewrites the brief.
- **Executive decision brief**: strongest position, weakest assumption, unresolved disagreement, and the next research question, with a panel-consensus score.
- **Topic-aware demo mode** (no API key required): a deterministic, on-topic fallback so a live demo never fails or shows the wrong debate. `OPENAI_API_KEY` upgrades panel generation and interventions to a live model via the Responses API with strict structured outputs.

## Repository Structure

```text
agora-ai/
├── frontend/   # Next.js debate arena
├── backend/    # FastAPI debate orchestration API
├── docs/       # Product, architecture, and hackathon documentation
├── prompts/    # Prompt templates and agent definitions
├── assets/     # Images, demo assets, and design resources
├── README.md
├── LICENSE
└── .gitignore
```

## Tech Stack

- Frontend: Next.js, React, TypeScript, CSS Modules
- Backend: FastAPI, Python
- AI: OpenAI Responses API
- Deployment target: Vercel and Railway/Render/Fly.io

## Local Development

Requires Python 3.11+ (tested through 3.14) and Node 18+.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional; add OPENAI_API_KEY to go live
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

The backend runs on `http://127.0.0.1:8001`.

Leave `OPENAI_API_KEY` blank for deterministic, topic-aware demo mode. Add an API key (in `backend/.env`, loaded automatically) to enable live model generation and interventions.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and talks to the backend on port 8001 (override with `NEXT_PUBLIC_API_BASE_URL`).

## Hackathon Demo

Recommended 3-minute flow:

1. Open on the arena and pick the curated scenario `Should frontier AI models be open source?`
2. As the panel speaks, watch the **argument graph build node by node** — a red edge appears the moment the security researcher challenges the open-source advocate, and that claim's confidence meter visibly drops to *contested*.
3. Use the **timeline scrubber** to rewind to the moment of challenge — the graph and confidences roll back with it. (This is the signature "reasoning is a thing you can replay" moment.)
4. Run an intervention, e.g. `Introduce new evidence: model-weight leakage increases biosecurity risk.` — a new node grows on the graph and an expert **revises** in place.
5. Land on the **Decision Brief**: strongest position, weakest assumption, unresolved disagreement, next question, with the panel-consensus score.
6. End with: `Search engines organize information. Agora organizes reasoning.`

## Development Principles

- Build a working product, not a static demo.
- Keep the first workflow extremely polished.
- Prefer structured outputs for agent state and debate summaries.
- Make the user a participant, not a passive transcript reader.
- Document how Codex and OpenAI models are used throughout development.

## License

This project is licensed under the MIT License.
