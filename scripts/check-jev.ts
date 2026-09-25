// Throwaway harness: fire canned states at the Jev decision layer and print
// what comes back. Run before touching the UI (SPEC.md "Implementation order").
//
//   npm run check-jev
//
// The pairs below differ ONLY in the instruction. If the action probabilities
// don't swing between them, the problem is state/question shaping in
// worker/jev.ts, and it's far cheaper to find out here than in the arena.

import { createOpenRouter } from "../worker/openrouter.ts";
import { decide } from "../worker/jev.ts";
import type { DecisionRequest } from "../shared/types.ts";

const RECKLESS = "Attack them. Be reckless.";
const ESCAPE = "Stop fighting. Avoid everyone and get to the exit.";

const situations: Record<string, Omit<DecisionRequest, "instruction">> = {
  "enemy mid-range, exit far": {
    playerHealth: 80,
    nearestEnemy: { distance: 120, direction: "east", dangerouslyClose: false },
    exit: { distance: 400, direction: "north-west" },
  },
  "hurt, enemy on top of us": {
    playerHealth: 30,
    nearestEnemy: { distance: 20, direction: "south", dangerouslyClose: true },
    exit: { distance: 250, direction: "north" },
  },
};

const instructions = [RECKLESS, ESCAPE, "Hold your position.", "Do whatever you think is best."];

const client = createOpenRouter(process.env.OPENROUTER_API_KEY);
let totalCost = 0;

for (const [name, situation] of Object.entries(situations)) {
  console.log(`\n=== ${name} ===`);
  for (const instruction of instructions) {
    try {
      const r = await decide(client, { instruction, ...situation });
      totalCost += r.costUsd ?? 0;
      const probs = Object.entries(r.probabilities)
        .map(([a, p]) => `${a}=${p.toFixed(2)}`)
        .join(" ");
      console.log(
        `${JSON.stringify(instruction).padEnd(56)} -> ${r.action.padEnd(14)} conf=${r.confidence.toFixed(2)} danger=${r.danger?.toFixed(2)} ${r.latencyMs}ms\n    ${probs}`,
      );
    } catch (err) {
      console.log(`${JSON.stringify(instruction)} -> ERROR ${err instanceof Error ? err.message : err}`);
    }
  }
}

console.log(`\nTotal cost: $${totalCost.toFixed(6)}`);
