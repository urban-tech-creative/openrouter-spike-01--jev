// Worker entry point: one route, POST /api/decide. Static assets (the React
// app) are served by Cloudflare before this code runs; see wrangler.jsonc.

import { createOpenRouter } from "./openrouter.ts";
import { decide } from "./jev.ts";
import { InvalidRequest, MAX_BODY_BYTES, parseDecisionRequest } from "./validate.ts";
import type { DecisionRequest } from "../shared/types.ts";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/decide") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.DECIDE_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return Response.json({ error: "Rate limited" }, { status: 429 });
    }

    // Reject oversized bodies before reading them: see validate.ts for why.
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return Response.json({ error: "Request too large" }, { status: 413 });
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return Response.json({ error: "Request too large" }, { status: 413 });
    }

    let body: DecisionRequest;
    try {
      body = parseDecisionRequest(JSON.parse(text));
    } catch (err) {
      const message = err instanceof InvalidRequest ? err.message : "Invalid JSON";
      return Response.json({ error: message }, { status: 400 });
    }

    try {
      const client = createOpenRouter(env.OPENROUTER_API_KEY);
      return Response.json(await decide(client, body));
    } catch (err) {
      console.error("Jev decision failed", err);
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 502 });
    }
  },
} satisfies ExportedHandler<Env>;
