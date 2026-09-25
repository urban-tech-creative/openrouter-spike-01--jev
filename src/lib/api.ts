import type { DecisionRequest, DecisionResponse } from "../../shared/types.ts";

/** Ask the Worker for a decision. The browser never talks to OpenRouter directly. */
export async function requestDecision(req: DecisionRequest): Promise<DecisionResponse> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`${res.status}: ${body?.error ?? res.statusText}`);
  }
  return res.json();
}
