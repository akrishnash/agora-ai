import type { DebateFormat, DebateSession, DebateStreamEvent } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

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

export function createDebate(
  topic: string,
  format: DebateFormat,
  options: { demoOnly?: boolean } = {}
): Promise<DebateSession> {
  return requestSession("/debates", { topic, format, demo_only: options.demoOnly ?? false });
}

export async function streamDebate(
  topic: string,
  format: DebateFormat,
  onEvent: (event: DebateStreamEvent) => void,
  options: { demoOnly?: boolean } = {}
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/debates/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ topic, format, demo_only: options.demoOnly ?? false })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agora stream returned ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as DebateStreamEvent);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as DebateStreamEvent);
  }
}

export function injectIntervention(
  session: DebateSession,
  instruction: string
): Promise<DebateSession> {
  return requestSession("/debates/interventions", { session, instruction });
}
