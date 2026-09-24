# openrouter-spike-01--jev

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

OpenRouter exposes Jev through its Decisions API.

Before implementing the integration, inspect the current OpenRouter documentation and SDK support for Jev / Decisions rather than assuming it behaves like the normal chat-completions API.

Use the latest Jev model alias where practical rather than unnecessarily pinning an old version.

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
* request latency
* whether a request is in flight
* latest API error, if any

Watching the probabilities change is part of the experiment.

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

SPEC.md
README.md
wrangler.jsonc
```

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

* authentication
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
