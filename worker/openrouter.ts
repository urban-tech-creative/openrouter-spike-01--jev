// OpenRouter client setup. The only file that knows how we authenticate.
//
// This runs server-side only (Cloudflare Worker, or Node for scripts/check-jev.ts).
// The API key must never reach the browser: see SPEC.md "Secrets and environment".

import { OpenRouter } from "@openrouter/sdk";

export function createOpenRouter(apiKey: string | undefined): OpenRouter {
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Locally, put it in .dev.vars; when deployed, run `npx wrangler secret put OPENROUTER_API_KEY`.",
    );
  }

  return new OpenRouter({
    apiKey,
    // Optional attribution headers: these show up in the OpenRouter dashboard,
    // which makes it easy to tell which spike a request came from.
    appTitle: "UTC openrouter-spike-01--jev",
    httpReferer: "https://github.com/urban-tech-creative/openrouter-spike-01--jev",
    // Jev typically answers in 70-500ms. Fail fast rather than letting a hung
    // request hold the single in-flight slot (see SPEC.md "Loop scheduling").
    timeoutMs: 5000,
  });
}
