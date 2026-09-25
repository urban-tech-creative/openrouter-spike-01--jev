# openrouter-spike-01--jev

> **This is the original brief, kept as written.** The build followed it, but some details changed along the way: the demo grew from four actions to six (health packs and a freeze power), and the browser/Worker contract lives in `shared/`. See [README.md](README.md) for what was built and what was learned.

## Purpose

This repository is a small technical spike for Urban Tech Creative exploring how to use **OpenRouter** from a deployed web project, using **TypeSafe Jev** as the first example model.

The wider goal is to build a collection of very small, understandable spike repositories inside the `urban-tech-creative` GitHub organisation.

Future developers and coding agents should be able to find these repositories and reuse known-good integration patterns when assembling larger prototypes.

This repository should therefore optimise for:

* simplicity
* readability
* easy local setup
* easy deployment
* obvious separation between reusable integration code and demo-specific code
* minimal dependencies
* a stack that is already useful for future UTC browser prototypes

It is not intended to become a production application.

---

## Chosen stack

Use:

* **React**
* **Vite**
* **TypeScript**
* **Tailwind CSS**
* **Cloudflare Workers**
* **OpenRouter**
* the official OpenRouter TypeScript SDK where appropriate

Avoid introducing additional frameworks unless they materially simplify the spike.

The intended architecture is:

```text
React / Vite browser application
              |
              | POST /api/decide
              v
      Cloudflare Worker
              |
              | OPENROUTER_API_KEY
              v
          OpenRouter
              |
              v
             Jev
```

The browser should never communicate with OpenRouter directly.

---

## What is Jev?

Jev is a **decision model** from TypeSafe rather than a conventional generative LLM.

It accepts some textual or structured state plus constrained questions and returns structured decisions with probabilities.

For example, given:

> The player has 30% health. An enemy is nearby. The exit is some distance away. The instruction is "avoid combat and escape".

Jev might choose between:

* `APPROACH_ENEMY`
* `EVADE`
* `SEEK_EXIT`
* `WAIT`

and return probabilities for those choices.

The important architectural distinction is:

**Jev decides what should happen. Ordinary application code makes it happen.**

Do not use Jev for:

* arithmetic
* physics
* collision detection
* pathfinding
* animation
* rendering
* exact timing
* generating prose

Use Jev only where a fuzzy semantic judgement is useful.

### Verified API facts

These were confirmed against the OpenRouter documentation on 2026-09-24. They are recorded here so the implementer does not have to rediscover them, but the docs remain the source of truth if they have since changed.

* Endpoint: `POST https://openrouter.ai/api/alpha/decisions` — note **alpha**. This is a separate API surface from chat completions and does not behave like it.
* Model: `typesafe/jev-1.13`, with a moving alias `~typesafe/jev-latest`.
* Authentication: an ordinary OpenRouter API key. No separate TypeSafe account is required.
* Context window: 32,000 tokens.
* Latency: roughly 70–500ms.
* Pricing: $0.042 per million input tokens, **output tokens are free**. Each response carries a `usage.cost` field in USD. A demo of this size costs fractions of a cent per hour.
* The official OpenRouter TypeScript SDK supports the Decisions API, so prefer it over hand-rolled `fetch`.

Jev answers three kinds of typed question, called primitives:

* **Choice** — "which one of these options?" Returns the winning label, a probability for every label (including labels at 0, summing to 1), and a `confidence` value.
* **Noul** — "does this condition hold?" Returns the probability of yes.
* **Score** — "where does this fall on an ordered scale?" Returns a probability-weighted position plus per-level probabilities and confidence.

`confidence` (0 to 1) measures how *peaked* the distribution is, not how correct it is. A flat distribution gives low confidence, a peaked one high confidence.

Multiple questions can be batched into a single request at no extra round trip.

Probabilities vary slightly between calls on identical input. Treat them as threshold bands, never as exact values to compare for equality.

### Model pinning

Pin `typesafe/jev-1.13` explicitly in code rather than using the `~typesafe/jev-latest` alias.

This repository is intended as a reference other projects copy from. A reference whose behaviour changes silently when an alias moves is a poor reference, and the alpha status of the endpoint makes that more likely, not less. Mention the alias in a comment so a reader knows it exists and can opt into it deliberately.

Sources:

* <https://openrouter.ai/docs/guides/community/jev>
* <https://openrouter.ai/blog/insights/what-is-jev/>
* <https://openrouter.ai/typesafe/jev-1.13>

---

## Spike goal

Build the smallest browser-based interactive demo which proves:

1. A deployed UTC web application can call Jev through OpenRouter securely.
2. A React/Vite frontend can communicate cleanly with a Cloudflare Worker API.
3. Application state can be converted into a small Jev decision request.
4. Jev can choose between a constrained set of actions.
5. Changing a natural-language instruction causes visibly different behaviour.
6. The OpenRouter integration is isolated enough to be reused in another UTC project.

---

## Demo concept

Create a tiny top-down simulation.

The world contains:

* one AI-controlled character
* two hostile characters
* one exit

Use deliberately simple visuals.

Circles, rectangles, icons and labels are preferable to spending time on game assets.

The AI-controlled character has health.

Enemies slowly approach and damage the character when close.

The user does **not** directly control the character.

Instead, the user gives it a natural-language instruction, for example:

> Attack the enemies. Be reckless.

or:

> Avoid everybody and escape.

The instruction should be editable while the simulation is running.

---

## Jev decision loop

Approximately every 500ms, construct a concise state containing information such as:

* user's current instruction
* player health
* nearest enemy distance
* nearest enemy direction
* whether an enemy is dangerously close
* exit distance
* exit direction

Ask Jev to choose exactly one action:

```ts
type JevAction =
  | "APPROACH_ENEMY"
  | "EVADE"
  | "SEEK_EXIT"
  | "WAIT";
```

Jev should make the semantic decision only.

Normal deterministic TypeScript should translate that decision into movement.

For example:

```text
Jev returns:

SEEK_EXIT

Application code:

calculate direction to exit
move character toward exit
handle collision
render movement
```

Do not ask Jev to return:

* coordinates
* movement vectors
* arbitrary JSON instructions
* prose
* code
* new actions

Keep the model's action space intentionally tiny.

### Loop scheduling

This is the part most likely to make the demo look broken, so it is specified rather than left to judgement.

**Separate the decision cadence from the render loop.** The simulation renders and moves continuously at animation frame rate, always acting on the *most recent* decision it has. It never blocks, stalls or skips frames waiting for a response. Jev changes the character's *intent*; it does not drive the character's *movement*.

**Single-flight the requests.** Jev's latency range tops out around the 500ms tick interval, so ticks will sometimes overlap. If a request is already in flight when the next tick is due, skip that tick rather than queueing or racing it. Never allow two decisions to be in flight at once.

**Discard stale responses.** If a response arrives for a state that has since been superseded, prefer the newer decision.

**Fail soft.** On a request error, keep acting on the last known decision and surface the error in the debug panel. The simulation should never freeze because the API did.

### Optional: demonstrate a second primitive

The core requirement is a single **Choice** question returning one `JevAction`.

If it costs little, also send a **Noul** question such as "is the character in immediate danger?" in the same request. Batched questions add no extra round trip, and this demonstrates two of Jev's three primitives in a repository whose purpose is to be a reference.

Skip this if it complicates the code. One clear Choice is better than two muddled questions.

---

## Frontend

Use React + TypeScript + Tailwind.

The frontend should contain roughly:

* the simulation area
* an instruction input
* a small status/debug panel
* controls to restart/reset the simulation if useful

Do not build a general-purpose game framework.

A simple React animation/update loop is sufficient.

Keep simulation logic separate from presentation where convenient, but avoid abstraction for abstraction's sake.

---

## Debug UI

The demo should make Jev's involvement visible.

Include a compact debug panel showing:

* current instruction
* current state sent to Jev
* selected action
* returned probabilities
* returned confidence
* request latency
* whether a request is in flight
* latest API error, if any

Watching the probabilities change is part of the experiment.

Show `confidence` prominently. It is the most legible signal that Jev is genuinely responding to the instruction: a decisive instruction should produce a peaked distribution, a vague or conflicted one a flat distribution. That contrast is the demo.

The UI should be presentable enough to demonstrate quickly, but polish is secondary to clarity.

---

## OpenRouter integration

Use the official OpenRouter TypeScript SDK if it supports the required Jev Decisions functionality cleanly.

If direct HTTP is substantially clearer for this specific endpoint, direct `fetch` is acceptable.

Prefer the simplest implementation that reflects the current official OpenRouter API.

Keep OpenRouter-specific code isolated in the Worker.

A likely structure is:

```text
worker/
  index.ts
  openrouter.ts
  jev.ts
```

Responsibilities:

### `openrouter.ts`

Own:

* OpenRouter client creation
* shared OpenRouter configuration
* authentication setup

### `jev.ts`

Own:

* Jev-specific request construction
* action definitions
* response parsing
* conversion into the small domain model used by the frontend

The rest of the application should not need to understand OpenRouter's raw response format.

---

## Secrets and environment

The OpenRouter API key must never be exposed to the browser.

Use:

```text
OPENROUTER_API_KEY=
```

For local development, use the normal Cloudflare/Wrangler local secret mechanism.

For deployed environments, store `OPENROUTER_API_KEY` as a **Cloudflare Worker secret**.

Do not use:

```text
VITE_OPENROUTER_API_KEY
```

or otherwise place the key in frontend environment variables, because Vite-exposed variables are bundled into browser code.

Provide an example environment file or setup instructions where useful, but never commit real secrets.

### Protecting the key from abuse

The deployed Worker is an unauthenticated proxy to a billed API on a public URL, and each open tab issues roughly two requests per second.

User authentication remains a non-goal. However, add two cheap protections, because a shareable link should not become somebody else's free inference endpoint:

* A rate limit on `/api/decide` in the Worker. Cloudflare's rate limiting binding is a few lines of `wrangler.jsonc` and needs no extra service.
* A spend limit on the OpenRouter API key itself, set in the OpenRouter dashboard.

Per-request cost is negligible; the concern is abuse volume, not demo usage.

---

## API boundary

Expose a very small Worker endpoint such as:

```text
POST /api/decide
```

The browser sends only the state required for the decision.

For example:

```ts
type DecisionRequest = {
  instruction: string;
  playerHealth: number;
  nearestEnemy: {
    distance: number;
    direction: string;
    dangerouslyClose: boolean;
  } | null;
  exit: {
    distance: number;
    direction: string;
  };
};
```

The Worker calls Jev and returns a small frontend-friendly response such as:

```ts
type DecisionResponse = {
  action: JevAction;
  probabilities: Record<JevAction, number>;
  confidence: number;
  latencyMs: number;
};
```

The exact types may change based on Jev's actual API response.

Do not leak unnecessary provider-specific data into the frontend.

---

## Suggested project structure

Keep the structure simple.

Something approximately like:

```text
src/
  components/
    Arena.tsx
    DebugPanel.tsx
    InstructionInput.tsx

  game/
    simulation.ts
    types.ts

  lib/
    api.ts

  App.tsx
  main.tsx

worker/
  index.ts
  openrouter.ts
  jev.ts

scripts/
  check-jev.ts

SPEC.md
README.md
wrangler.jsonc
```

`scripts/check-jev.ts` is a throwaway command-line harness that fires a handful of canned states at the decision layer and prints the resulting actions, probabilities and confidence. See implementation order below.

This is guidance, not a requirement.

If a simpler structure emerges during implementation, prefer the simpler structure.

---

## Deployment

Deploy the project using Cloudflare Workers.

The ideal outcome is a single easily shareable web deployment.

Avoid introducing:

* a separate conventional backend server
* a database
* additional cloud services
* complex infrastructure

unless the OpenRouter/Jev integration genuinely requires them.

The reusable capability being demonstrated is:

**React/Vite web app → Cloudflare Worker → OpenRouter → Jev**

---

## Implementation order

Build the risky part first.

Criteria 1–4 and 6–8 below are plumbing that is already known to work. Criterion 5 — the character visibly changing behaviour when the instruction changes — is the only genuine unknown in this spike, and it depends entirely on how application state is serialised into Jev's question.

Therefore:

1. Write `worker/jev.ts` and `worker/openrouter.ts` first.
2. Write `scripts/check-jev.ts`: a small script that sends several hand-written states to the decision layer and prints the results. Include at least one pair that differs *only* in the instruction, for example "attack them, be reckless" versus "avoid everyone and get to the exit", with all other state identical.
3. Confirm the probabilities actually swing between those two cases before writing any React.

If they do not swing, that is a state-shaping problem, and it is far cheaper to discover it here than after the arena renders. Iterate on the phrasing of the state and the question until the contrast is unmistakable.

Only then build the Worker route, the simulation and the UI.

---

## Success criteria

The spike is successful when:

1. It runs locally with minimal setup.
2. It can be deployed to Cloudflare.
3. The OpenRouter API key remains server-side.
4. Jev successfully makes repeated decisions through OpenRouter.
5. The character visibly behaves differently when its instruction changes.
6. The user can observe Jev's returned probabilities.
7. The OpenRouter/Jev integration is simple enough to copy into another UTC prototype.
8. The README clearly explains setup, deployment and which parts are reusable.

A useful manual test is:

Start with:

> Attack them. Be reckless.

Then, while the simulation is running, change it to:

> Stop fighting. Avoid everyone and get to the exit.

The character should visibly change behaviour without any game logic being changed.

---

## Non-goals

Do not add, unless required to prove the core integration:

* authentication (rate limiting is not authentication, and is required — see above)
* accounts
* persistence
* databases
* multiplayer
* elaborate pathfinding
* complex game-engine architecture
* generative dialogue
* additional AI models
* agent frameworks
* elaborate state management libraries
* production-grade observability
* premature reusable abstractions

React, Vite, Tailwind and Cloudflare are already chosen.

Do not spend time re-evaluating the basic stack.

Prefer boring code around the interesting bit.

---

## Repository philosophy

This repository is intended to become one member of a larger UTC library of experimental capability spikes.

Future coding agents should be able to inspect this repository and quickly answer:

> How do we call a decision model through OpenRouter from a deployed React/Cloudflare UTC project?

The repository should make that answer extremely obvious.

Treat the spike as a **reusable capability brick**, not merely a one-off demo.

Where possible, comment code to explain **why the OpenRouter/Jev-specific parts exist**, rather than explaining ordinary React or TypeScript.

Keep the project small enough that a developer or coding agent can understand the whole architecture quickly.

---

## Implementation guidance

Use judgement.

Do not over-engineer the spike in pursuit of this document.

If the current OpenRouter API, Jev model behaviour or Cloudflare tooling differs from assumptions in this spec, follow the current official documentation and keep the implementation as small as possible.

Stop adding features once the success criteria are met.
