# Agora AI

Agora AI is an interactive reasoning platform for exploring complex questions through live debates between AI expert agents. Instead of returning one answer, Agora assembles a panel of domain perspectives, lets them argue with evidence, allows the user to interrupt or introduce new information, and ends with a clear map of consensus, disagreement, weak assumptions, and next steps.

## Hackathon Vision

Search engines organize information. Agora organizes reasoning.

The project is being built for OpenAI Build Week as a complete product that demonstrates multi-agent orchestration, streaming responses, structured reasoning, evidence-aware discussion, and a polished user experience.

## Core Experience

1. Enter a difficult question.
2. Agora generates an ideal expert panel for the topic.
3. A moderator runs a structured debate.
4. Experts make claims, challenge each other, and cite supporting evidence.
5. The user can interrupt, ask follow-ups, or inject new evidence.
6. The debate produces a final reasoning brief with consensus, disagreement, confidence, and recommended reading.

## Planned Features

- AI-generated expert panels based on the topic.
- Debate formats such as Oxford Debate, Scientific Peer Review, Supreme Court, and Shark Tank.
- Streaming expert responses.
- User interventions during the debate.
- Position updates when new evidence is introduced.
- Argument graph showing claims, evidence, support, and objections.
- Final moderator report.
- Saved debates and shareable summaries.

## Repository Structure

```text
agora-ai/
├── frontend/   # Next.js application
├── backend/    # FastAPI services and debate orchestration
├── docs/       # Product, architecture, and hackathon documentation
├── prompts/    # Prompt templates and agent definitions
├── assets/     # Images, demo assets, and design resources
├── README.md
├── LICENSE
└── .gitignore
```

## Proposed Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, Python
- AI: OpenAI Responses API
- Data: Supabase or PostgreSQL
- Deployment: Vercel and Railway/Render/Fly.io

## Development Principles

- Build a working product, not a static demo.
- Keep the first workflow extremely polished.
- Prefer structured outputs for agent state and debate summaries.
- Make the user a participant, not a passive transcript reader.
- Document how Codex and OpenAI models are used throughout development.

## License

This project is licensed under the MIT License.
