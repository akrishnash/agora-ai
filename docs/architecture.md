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
5. Panel Builder creates the best set of expert roles for the topic.
6. The moderator opens the debate; each turn is emitted with a stable `id`, a short `headline`, the `target_id` of the earlier claim it answers, the `relation` to that claim, and a `confidence`.
7. Because every turn carries its `target_id` and `relation`, **the turns _are_ the argument graph** — the frontend derives nodes (turns) and edges (target links) directly, with no separate graph structure to keep in sync.
8. The frontend graph engine replays turns in order and propagates confidence/status: a `challenges` turn drains its target's confidence and marks it *contested*; a `revises` turn supersedes its target. This is a pure function of `(turns, visibleCount)`, which is what powers the timeline scrubber.
9. User interventions call `POST /debates/interventions` with the current session and instruction.
10. Backend returns an updated session with appended turns (new nodes/edges) and a sharper brief.

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
- `turns` — `id`, `speaker_id`, `headline`, `claim`, `evidence`, `relation`, `target_id`, `confidence` (the argument graph is derived from these)
- `brief` — `strongest_position`, `weakest_assumption`, `unresolved_disagreement`, `next_question`
- `mode` — `demo` or `openai`

## Reliability Strategy

The app must never fail during a hackathon demo just because an API key is absent or a model call fails. The backend therefore falls back to deterministic demo data for both debate creation and intervention handling.

## Next Technical Slices

- Stream turns over Server-Sent Events.
- Add source retrieval for real citations.
- Persist saved debates.
- Add shareable public debate links.
- Add deployment configuration for Vercel and Railway/Render.
