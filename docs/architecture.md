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
      +--> Reasoning Trace
      +--> Final Brief Generator
```

## Data Flow

1. User submits a topic and debate format.
2. Frontend calls `POST /debates/stream` for progressive generation, or `POST /debates` for the legacy full-session contract.
3. Backend runs deterministic demo mode when `OPENAI_API_KEY` is empty.
4. Backend runs OpenAI mode when `OPENAI_API_KEY` is configured.
5. Panel Builder creates the best set of expert roles for the topic.
6. In OpenAI mode, the backend generates each turn in a separate structured model call conditioned on the prior turns. Demo mode replays a deterministic, topic-aware trace with the same contract.
7. The moderator opens the debate; each turn is emitted with a stable `id`, a short `headline`, the `target_id` of the earlier claim it answers, the `relation` to that claim, and an internal signal value used for graph rendering.
8. Because every turn carries its `target_id` and `relation`, **the turns _are_ the argument graph** — the frontend derives nodes (turns) and edges (target links) directly, with no separate graph structure to keep in sync.
9. The frontend graph engine replays turns in order and propagates signal/status: a `challenges` turn drains its target's signal and marks it *contested*; a `revises` turn supersedes its target. This is a pure function of `(turns, visibleCount)`, which powers the timeline scrubber and reasoning trace.
10. User interventions call `POST /debates/interventions` with the current session and instruction.
11. Backend returns an updated session with appended turns (new nodes/edges) and a sharper brief.

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
- `experts` — `id`, `name`, `role`, `stance`, `confidence`
- `turns` — `id`, `speaker_id`, `headline`, `claim`, `evidence`, `sources`, `relation`, `target_id`, `confidence` (the argument graph is derived from these)
- `brief` — `strongest_position`, `weakest_assumption`, `unresolved_disagreement`, `next_question`
- `mode` — `demo` or `openai`

`POST /debates/stream` returns newline-delimited JSON events:

- `session` — an empty-turn `DebateSession` after panel creation
- `turn` — one generated `DebateTurn` at a time
- `brief` — final `ModeratorBrief`
- `done` — stream complete

## Reliability Strategy

The app must never fail during a hackathon demo just because an API key is absent or a model call fails. The backend therefore falls back to deterministic demo data for both debate creation and intervention handling.

## Next Technical Slices

- Add pause/cancel controls for long-running turn generation.
- Add retrieval-backed citations with URLs.
- Persist saved debates.
- Add shareable public debate links.
- Add deployment configuration for Vercel and Railway/Render.
