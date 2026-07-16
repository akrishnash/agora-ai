import type { DebateFormat, DebateSession } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

async function requestSession(path: string, body: unknown): Promise<DebateSession> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Agora API returned ${response.status}`);
  }

  return response.json() as Promise<DebateSession>;
}

export function createDebate(topic: string, format: DebateFormat): Promise<DebateSession> {
  return requestSession("/debates", { topic, format });
}

export function injectIntervention(
  session: DebateSession,
  instruction: string
): Promise<DebateSession> {
  return requestSession("/debates/interventions", { session, instruction });
}
