// Worker entry point: one route, POST /api/decide. Static assets (the React
// app) are served by Cloudflare before this code runs; see wrangler.jsonc.

import { createOpenRouter } from "./openrouter.ts";
import { decide } from "./jev.ts";
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

    let body: DecisionRequest;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body?.instruction !== "string" || body.instruction.length > 500) {
      return Response.json({ error: "instruction must be a string of at most 500 characters" }, { status: 400 });
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
