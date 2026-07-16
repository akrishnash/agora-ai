# Architecture

## System Shape

```text
Next.js Arena UI
      |
      | POST /debates
      | POST /debates/interventions
      v
FastAPI Debate API
      |
      v
Debate Orchestrator
      |
      +--> Demo Mode Fallback
      +--> OpenAI Responses API Mode
      +--> Panel Builder
      +--> Moderator Agent
      +--> Expert Agents
      +--> Argument Graph Builder
      +--> Final Brief Generator
```

## Data Flow

1. User submits a topic and debate format.
2. Frontend calls `POST /debates`.
3. Backend runs deterministic demo mode when `OPENAI_API_KEY` is empty.
4. Backend runs OpenAI mode when `OPENAI_API_KEY` is configured.
5. Panel Builder creates the best set of expert roles.
6. Moderator opens the debate and controls turns.
7. Expert agents respond with claims, evidence, stance, and confidence.
8. Argument Graph Builder extracts claim nodes and relationships.
9. User interventions call `POST /debates/interventions` with the current session and instruction.
10. Backend returns an updated session with new turns, graph changes, and a sharper brief.

## API Contract

`POST /debates`

```json
{
  "topic": "Should AGI models be open source?",
  "format": "Oxford"
}
```

`POST /debates/interventions`

```json
{
  "session": { "...": "current DebateSession" },
  "instruction": "Security researcher, challenge the open-source advocate."
}
```

Both endpoints return `DebateSession`:

- `id`
- `topic`
- `format`
- `experts`
- `turns`
- `graph`
- `brief`
- `mode`

## Reliability Strategy

The app must never fail during a hackathon demo just because an API key is absent or a model call fails. The backend therefore falls back to deterministic demo data for both debate creation and intervention handling.

## Next Technical Slices

- Stream turns over Server-Sent Events.
- Add source retrieval for real citations.
- Persist saved debates.
- Add shareable public debate links.
- Add deployment configuration for Vercel and Railway/Render.
