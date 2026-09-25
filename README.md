# openrouter-spike-01--jev

A small Urban Tech Creative spike: **React/Vite app → Cloudflare Worker → OpenRouter → Jev**.

A green character in a tiny arena follows a natural-language order ("Attack them. Be reckless.", "Avoid everyone and get to the exit."). Every ~500ms, [Jev](https://openrouter.ai/docs/guides/community/jev) (TypeSafe's decision model, served through OpenRouter's alpha Decisions API) picks one of four actions. Ordinary TypeScript then carries the action out. A debug panel shows the probabilities and confidence Jev returns.

See [SPEC.md](SPEC.md) for the brief.

## Run it locally

Requires Node 22.18+ (the harness runs TypeScript directly with Node).

```sh
npm install
cp .dev.vars.example .dev.vars   # then paste your OpenRouter key into it
npm run check-jev                # optional: sanity-check Jev from the command line
npm run dev                      # http://localhost:5173
```

`npm run dev` runs the Worker inside the real Workers runtime (via `@cloudflare/vite-plugin`), so `/api/decide` behaves locally the same way it does when deployed. Nothing is deployed or created in Cloudflare.

A demo session costs well under a tenth of a cent: Jev charges only for input tokens, and each decision costs about $0.00002.

## What's reusable

To call a decision model from another UTC project, copy these files:

| File | What it's for | Copy it? |
| --- | --- | --- |
| `worker/openrouter.ts` | OpenRouter client + auth. | As-is. |
| `worker/jev.ts` | Builds the Decisions request (state + typed questions), parses the answers into a small domain object. Pins `typesafe/jev-1.13`. | Change the actions, state description and questions. |
| `worker/index.ts` | `POST /api/decide`: rate limit, validation, error handling. | Adapt the route. |
| `shared/types.ts` | Browser ↔ Worker contract, with no OpenRouter types. | Adapt. |
| `src/lib/useDecisionLoop.ts` | Polls decisions separately from rendering: single-flight, discards stale responses, fails soft. | Useful for any "AI sets intent every N ms" loop. |
| `scripts/check-jev.ts` | Command-line harness that fires canned states at the decision layer. | Write one first for any new decision task. |

Everything under `src/game` and `src/components` is demo-specific.

### Things worth knowing about Jev

- It's not a chat model. You send `state` plus named `questions` of type `choice` (pick one label), `noul` (yes/no probability) or `score` (ordered scale). One request can carry several questions; this demo sends a `choice` and a `noul` together.
- Put the **user's instruction in the question's `instructions`** and the **facts in `state`**. With that split, the same state swings from `APPROACH_ENEMY 1.00` to `SEEK_EXIT 0.95` just by changing the order.
- `confidence` measures how peaked the distribution is, not how correct the answer is. "Escape" given while an enemy is right on top of the character splits EVADE/SEEK_EXIT roughly 50/50 at confidence ~0.35.
- Probabilities vary slightly between identical calls. Compare them against thresholds, never for equality.
- Latency is about 250–450ms in practice, so a 500ms tick sometimes overlaps a pending request. The loop skips those ticks rather than queueing them.
- The SDK (`client.alpha.decisions.create`) makes the Worker bundle about 1.7 MB (about 240 KB gzipped). That's fine for Workers. If size ever matters, the endpoint is a single `fetch` to `POST https://openrouter.ai/api/alpha/decisions`.

## Deploying (when ready)

Not done yet. When you want a shareable URL:

1. Set a **spend limit** on the OpenRouter key in the OpenRouter dashboard. The deployed Worker is an unauthenticated proxy, rate-limited to 300 requests per minute per IP (see `wrangler.jsonc`).
2. `npx wrangler login`
3. `npx wrangler secret put OPENROUTER_API_KEY`
4. `npm run deploy`

Never put the key in a `VITE_*` variable. Vite bundles those into browser code.
