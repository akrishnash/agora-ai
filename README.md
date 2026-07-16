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

- Interactive Next.js debate arena.
- FastAPI debate orchestration API.
- Deterministic demo mode when no API key is configured.
- OpenAI mode when `OPENAI_API_KEY` is present.
- User interventions that add turns, revise the graph, and sharpen the moderator brief.
- Argument graph showing claims, confidence, support, contestation, and revision.
- Final moderator report with strongest position, weakest assumption, unresolved disagreement, and next question.

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

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

The backend runs on `http://127.0.0.1:8001`.

Leave `OPENAI_API_KEY` blank for deterministic demo mode. Add an API key to enable OpenAI-powered debate generation and interventions.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

The frontend runs on `http://localhost:3000`.

## Hackathon Demo

Recommended 3-minute flow:

1. Start with `Should AGI models be open source?`
2. Show the generated expert panel.
3. Let the first debate turns appear.
4. Click `Security researcher, challenge the open-source advocate.`
5. Show the new turns, revised argument graph, and updated moderator brief.
6. End with: `Search engines organize information. Agora organizes reasoning.`

## Development Principles

- Build a working product, not a static demo.
- Keep the first workflow extremely polished.
- Prefer structured outputs for agent state and debate summaries.
- Make the user a participant, not a passive transcript reader.
- Document how Codex and OpenAI models are used throughout development.

## License

This project is licensed under the MIT License.
