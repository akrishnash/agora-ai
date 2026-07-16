# Architecture

## System Shape

```text
Next.js Arena UI
      |
      | POST /debates
      v
FastAPI Debate API
      |
      v
Debate Orchestrator
      |
      +--> Panel Builder
      +--> Moderator Agent
      +--> Expert Agents
      +--> Argument Graph Builder
      +--> Final Brief Generator
```

## Data Flow

1. User submits a topic and debate format.
2. Panel Builder creates the best set of expert roles.
3. Moderator opens the debate and controls turns.
4. Expert agents respond with claims, evidence, stance, and confidence.
5. Argument Graph Builder extracts claim nodes and relationships.
6. User interventions are routed to the relevant agent or moderator.
7. Final Brief Generator summarizes consensus, disagreement, assumptions, and next questions.

## First Implementation Contract

The backend already exposes a deterministic `POST /debates` endpoint that returns:

- session id
- topic
- format
- experts
- turns
- argument graph
- moderator brief

The next sprint replaces deterministic demo content with OpenAI Responses API orchestration while keeping the response contract stable.
