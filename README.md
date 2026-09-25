# openrouter-spike-01--jev

A small Urban Tech Creative spike: **React/Vite app → Cloudflare Worker → OpenRouter → Jev**.

A green character in a tiny arena follows a natural-language order ("Attack them. Be reckless.", "Avoid everyone and get to the exit."). Every ~500ms, [Jev](https://openrouter.ai/docs/guides/community/jev) (TypeSafe's decision model, served through OpenRouter's alpha Decisions API) picks one of up to six actions: fight, evade, head for the exit, grab a health pack, fire a freeze blast, or wait. Ordinary TypeScript then carries the action out. A debug panel shows the probabilities and confidence Jev returns.

See [SPEC.md](SPEC.md) for the brief.

## Run it locally

Requires Node 22.18+ (the harness runs TypeScript directly with Node).

```sh
npm install
cp .dev.vars.example .dev.vars   # then paste your OpenRouter key into it
npm run check-jev                # optional: sanity-check Jev from the command line
npm run dev                      # http://localhost:5199
```

`npm run dev` runs the Worker inside the real Workers runtime (via `@cloudflare/vite-plugin`), so `/api/decide` behaves locally the same way it does when deployed. Nothing is deployed or created in Cloudflare.

A demo session costs well under a tenth of a cent: Jev charges only for input tokens, and each decision costs about $0.00002.

## Checking your OpenRouter account

`scripts/account.ts` is a read-only command-line inspector. It isn't part of the app.

```sh
npm run account                        # this key: spend today/week/month, spend limit, free-tier status
npm run account -- generation <id>     # cost, latency and provider for one request (stats land ~10s after it)
npm run account -- credits             # account balance: credits granted vs used
npm run account -- activity            # last 30 completed UTC days, by model
```

`credits` and `activity` need a **management key**. OpenRouter doesn't show account balance to ordinary API keys. Create one at <https://openrouter.ai/settings/management-keys> and put it in `.env.admin` (gitignored) as `OPENROUTER_MANAGEMENT_KEY=...`. Keep it out of `.dev.vars`: Wrangler loads that file into the Worker, and a management key can create and delete API keys.

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
- **The choice set can change per request.** Criteria are sent fresh every time, so this demo only offers `FREEZE` while it's recharged and `SEEK_HEALTH` while a pack exists (`availableActions` in `worker/jev.ts`). Jev can't pick an impossible action, and nothing needs validating afterwards.
- Probabilities vary slightly between identical calls. Compare them against thresholds, never for equality.
- Latency is about 250–450ms in practice, so a 500ms tick sometimes overlaps a pending request. The loop skips those ticks rather than queueing them.
- The SDK (`client.alpha.decisions.create`) makes the Worker bundle about 1.7 MB (about 240 KB gzipped). That's fine for Workers. If size ever matters, the endpoint is a single `fetch` to `POST https://openrouter.ai/api/alpha/decisions`.

## What Jev can and can't do (findings)

From `npm run check-jev` experiments and watching full games. Each result is a single run, so treat the numbers as indicative.

**Does well**
- **Weighing a trade-off against health.** With a health pack 60 units away, "do whatever you think is best" picks `SEEK_HEALTH` at 0.13 on 100% health, 0.88 on 60% and 0.97 on 25%. "Attack them. Be reckless." on 25% health still charges in (0.98).
- **Spending a limited resource when it pays off.** "Use your freeze whenever you can" with three enemies in reach gives `FREEZE` 1.00. With none in reach it drops to 0.41 at confidence 0.27.
- **Open-ended orders.** "Do whatever you think is best" produced the most capable play: it dodged, grabbed a pack, re-froze the moment the power recharged, and escaped on 96 hp.

**Does less well**
- **Takes the order literally.** "Use your freeze whenever you can" wasted it straight away on nothing, then chose `WAIT` (0.70) for 9 seconds while being killed. With no freeze available, the order said nothing else, and the order outweighed the danger.
- **Only partly understands "frozen".** Next to a frozen enemy, the danger answer drops from 0.82 to 0.58, not near zero, and "do what's best" still evades it about half the time. Rewording the state from `frozen: true` to `"FROZEN: cannot move or attack right now"` helped a little.
- **Doesn't see an emergency as one.** "Save your freeze for emergencies" with three enemies in reach and one dangerously close picks `EVADE` (0.54) over `FREEZE` (0.27).
- **Tends to fire the freeze early,** before anything is in reach. That happened across several orders.
- **A cleared room under "Attack them"** mostly gives `WAIT` (0.61): there's nothing left to attack, and leaving isn't what it was ordered to do.

Balance, for reference (offline, 200 seeded games with scripted policies): charging in alone never clears the room, health packs alone clear it 21% of the time, and freezing well plus picking up health clears it 76%. So the outcome depends on how well Jev uses the tools, not on luck.

## Deploying (when ready)

Not done yet. When you want a shareable URL:

1. Set a **spend limit** on the OpenRouter key in the OpenRouter dashboard. The deployed Worker is an unauthenticated proxy, rate-limited to 300 requests per minute per IP (see `wrangler.jsonc`).
2. `npx wrangler login`
3. `npx wrangler secret put OPENROUTER_API_KEY`
4. `npm run deploy`

Never put the key in a `VITE_*` variable. Vite bundles those into browser code.
