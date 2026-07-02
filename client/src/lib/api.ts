// Client for the plant-care ADK agent. server/main.py mounts ADK's own REST
// routes (get_fast_api_app) — there is no custom endpoint; this module speaks
// ADK's session + /run_sse protocol directly.
//
// Streaming: RN's fetch cannot read response bodies incrementally, so /run_sse
// is consumed with XMLHttpRequest onprogress (the same native-networking path
// forage/api.ts uses for uploads) and parsed as SSE by hand.
//
// dev-note: base URL hardcoded for local dev, same story as forage/api.ts.
const API_BASE = "http://localhost:8000";

// The agents-dir *package folder* on the server (server/plantcare/), as listed
// by GET /list-apps. NOT the agent's `name` field ("plant_care") — easy to mix
// up; only this constant may spell it.
const ADK_APP_NAME = "plantcare";

// Single-user on-device app: one fixed ADK user id.
const ADK_USER_ID = "frondly";

export type Severity = "low" | "medium" | "high";

export type Diagnosis = {
  problem: string;
  severity: Severity;
  healthScore: number; // 0–100, plotted on the GrowthVine
  confidence: number; // 0–1
  careSteps: string[];
};

// One part of a genai Content message: text, or an inline base64 image.
export type MessagePart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type StreamCallbacks = {
  onText: (fullTextSoFar: string) => void;
  onDiagnosis: (d: Diagnosis) => void;
  onDone: () => void;
  onError: (e: Error) => void;
};

// ---- pure helpers (exported for jest; no network) ----

// Split an SSE buffer into complete `data:` payloads plus the unconsumed
// remainder (frames end with a blank line).
export function parseSseChunks(buffer: string): { payloads: string[]; rest: string } {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  const payloads: string[] = [];
  for (const frame of frames) {
    for (const line of frame.split("\n")) {
      if (line.startsWith("data:")) payloads.push(line.slice(5).trim());
    }
  }
  return { payloads, rest };
}

// ADK serializes events with camelCase aliases (functionCall); accept the
// snake_case spelling too so an ADK upgrade can't silently break extraction.
// No other code may touch the raw field name.
export function functionCallsOfEvent(event: any): { name: string; args: any }[] {
  const parts: any[] = event?.content?.parts ?? [];
  return parts.map((p) => p?.functionCall ?? p?.function_call).filter(Boolean);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Map a record_diagnosis function call (snake_case args — the tool's Python
// signature) to a Diagnosis. Malformed args are clamped/defaulted, not fatal.
export function extractDiagnosis(event: any): Diagnosis | null {
  for (const call of functionCallsOfEvent(event)) {
    if (call.name !== "record_diagnosis") continue;
    const args = call.args ?? {};
    return {
      problem: String(args.problem ?? "Diagnosis"),
      severity: (["low", "medium", "high"] as const).includes(args.severity as Severity)
        ? (args.severity as Severity)
        : "medium",
      healthScore: clamp(Math.round(Number(args.health_score ?? 50)), 0, 100),
      confidence: clamp(Number(args.confidence ?? 0.5), 0, 1),
      careSteps: Array.isArray(args.care_steps) ? args.care_steps.map(String) : [],
    };
  }
  return null;
}

// Streamed text: partial events carry deltas to accumulate; the final
// (non-partial) text event carries the complete reply and supersedes them.
export function foldEventText(current: string, event: any): string {
  const parts: any[] = event?.content?.parts ?? [];
  const text = parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
  if (!text) return current;
  return event?.partial ? current + text : text;
}

// First message to the agent: profile + full journal (journals are small) +
// the photo. The agent's instruction expects exactly this context.
export function buildDiagnoseParts(
  plant: {
    name: string;
    species: string;
    latitude: number | null;
    longitude: number | null;
    lastWatered: Date | null;
  },
  history: Record<string, unknown>[],
  base64Jpeg: string
): MessagePart[] {
  const lines = [
    "Please diagnose my plant from the attached photo.",
    "",
    "Plant profile:",
    `- name: ${plant.name}`,
    `- species: ${plant.species}`,
    plant.latitude != null && plant.longitude != null
      ? `- location: lat ${plant.latitude}, lon ${plant.longitude}`
      : "- location: unknown",
    plant.lastWatered
      ? `- last watered: ${plant.lastWatered.toISOString().slice(0, 10)}`
      : "- last watered: unknown",
    "",
    "History (oldest→newest):",
    ...(history.length
      ? history.map((h) => `- ${JSON.stringify(h)}`)
      : ["- (no observations yet)"]),
  ];
  return [{ text: lines.join("\n") }, { inlineData: { mimeType: "image/jpeg", data: base64Jpeg } }];
}

// ---- network ----

// POST /apps/{app}/users/{uid}/sessions → session id.
export async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/apps/${ADK_APP_NAME}/users/${ADK_USER_ID}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Create session failed (${res.status}).`);
  const session = (await res.json()) as { id: string };
  return session.id;
}

// POST /run_sse and stream ADK events into the callbacks. Returns the XHR so
// the caller can abort() when the screen unmounts.
export function sendMessage(
  sessionId: string,
  parts: MessagePart[],
  cb: StreamCallbacks
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  let seen = 0; // chars of responseText already consumed
  let pending = ""; // partial SSE frame carried between onprogress calls
  let text = "";
  let done = false;

  const finish = (err?: Error) => {
    if (done) return;
    done = true;
    if (err) cb.onError(err);
    else cb.onDone();
  };

  const consume = () => {
    if (done) return;
    pending += xhr.responseText.slice(seen);
    seen = xhr.responseText.length;
    const { payloads, rest } = parseSseChunks(pending);
    pending = rest;
    for (const payload of payloads) {
      let event: any;
      try {
        event = JSON.parse(payload);
      } catch {
        continue; // tolerate a malformed frame rather than killing the stream
      }
      if (event?.error) {
        finish(new Error(String(event.error)));
        return;
      }
      const nextText = foldEventText(text, event);
      if (nextText !== text) {
        text = nextText;
        cb.onText(text);
      }
      const diagnosis = extractDiagnosis(event);
      if (diagnosis) cb.onDiagnosis(diagnosis);
    }
  };

  xhr.open("POST", `${API_BASE}/run_sse`);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 90_000; // a full Gemini turn with tool calls can take a while
  xhr.onprogress = consume;
  xhr.onload = () => {
    consume();
    if (xhr.status >= 200 && xhr.status < 300) finish();
    else finish(new Error(`Diagnose failed (${xhr.status}).`));
  };
  xhr.onerror = () => finish(new Error("Network error — is the server running on :8000?"));
  xhr.ontimeout = () => finish(new Error("Diagnose timed out. Check the server."));
  xhr.send(
    JSON.stringify({
      app_name: ADK_APP_NAME,
      user_id: ADK_USER_ID,
      session_id: sessionId,
      new_message: { role: "user", parts },
      streaming: true,
    })
  );
  return xhr;
}
