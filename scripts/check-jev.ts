// Throwaway harness: fire canned states at the Jev decision layer and print
// what comes back. Run before touching the UI (SPEC.md "Implementation order").
//
//   npm run check-jev
//
// Each experiment holds the situation fixed and varies only the instruction
// (or varies one fact and holds the instruction fixed). If the probabilities
// don't move where you'd expect, the problem is state/question shaping in
// worker/jev.ts, and it's far cheaper to find out here than in the arena.

import { createOpenRouter } from "../worker/openrouter.ts";
import { decide } from "../worker/jev.ts";
import type { DecisionRequest } from "../shared/types.ts";

type Situation = Omit<DecisionRequest, "instruction">;

const base: Situation = {
  playerHealth: 80,
  nearestEnemy: { distance: 120, direction: "east", dangerouslyClose: false, frozen: false },
  enemiesRemaining: 6,
  enemiesInFreezeRange: 0,
  nearestHealthPack: null,
  freezeRechargeSeconds: 8,
  exit: { distance: 400, direction: "north-west" },
};

const RECKLESS = "Attack them. Be reckless.";
const ESCAPE = "Stop fighting. Avoid everyone and get to the exit.";

const experiments: { name: string; runs: [string, Situation][] }[] = [
  {
    name: "Baseline: instruction alone swings the choice",
    runs: [RECKLESS, ESCAPE, "Hold your position."].map((i) => [i, base]),
  },
  {
    name: "Health trade-off: 25% health, health pack 60 units away, enemy closing",
    runs: [RECKLESS, "Stay alive at all costs.", ESCAPE, "Do whatever you think is best."].map((i) => [
      i,
      {
        ...base,
        playerHealth: 25,
        nearestEnemy: { distance: 90, direction: "east", dangerouslyClose: false, frozen: false },
        nearestHealthPack: { distance: 60, direction: "south" },
      },
    ]),
  },
  {
    name: "Health pack is irrelevant at full health? (same pack, 100% health, 'do what's best')",
    runs: [100, 60, 25].map((hp) => [
      `Do whatever you think is best. [health ${hp}]`,
      { ...base, playerHealth: hp, nearestHealthPack: { distance: 60, direction: "south" } },
    ]),
  },
  {
    name: "Freeze timing: freeze ready, THREE enemies in range, one dangerously close",
    runs: [RECKLESS, "Save your freeze for emergencies.", "Use your freeze whenever you can.", ESCAPE].map((i) => [
      i,
      {
        ...base,
        playerHealth: 60,
        nearestEnemy: { distance: 40, direction: "south", dangerouslyClose: true, frozen: false },
        enemiesInFreezeRange: 3,
        freezeRechargeSeconds: 0,
      },
    ]),
  },
  {
    name: "Freeze waste: freeze ready, ZERO enemies in range, nearest far away",
    runs: [RECKLESS, "Save your freeze for emergencies.", "Use your freeze whenever you can.", ESCAPE].map((i) => [
      i,
      {
        ...base,
        nearestEnemy: { distance: 250, direction: "east", dangerouslyClose: false, frozen: false },
        enemiesInFreezeRange: 0,
        freezeRechargeSeconds: 0,
      },
    ]),
  },
  {
    name: "Frozen enemy: nearest enemy is frozen and in reach",
    runs: [RECKLESS, ESCAPE, "Do whatever you think is best."].map((i) => [
      i,
      { ...base, nearestEnemy: { distance: 30, direction: "east", dangerouslyClose: true, frozen: true } },
    ]),
  },
  {
    name: "Room cleared, 'attack' order still in force",
    runs: [RECKLESS, "Do whatever you think is best."].map((i) => [
      i,
      { ...base, nearestEnemy: null, enemiesRemaining: 0, nearestHealthPack: { distance: 80, direction: "west" } },
    ]),
  },
];

const client = createOpenRouter(process.env.OPENROUTER_API_KEY);
let totalCost = 0;

for (const { name, runs } of experiments) {
  console.log(`\n=== ${name} ===`);
  for (const [label, situation] of runs) {
    const instruction = label.replace(/ \[.*\]$/, "");
    try {
      const r = await decide(client, { instruction, ...situation });
      totalCost += r.costUsd ?? 0;
      const probs = r.offered.map((a) => `${a}=${r.probabilities[a].toFixed(2)}`).join(" ");
      console.log(
        `${JSON.stringify(label).padEnd(58)} -> ${r.action.padEnd(14)} conf=${r.confidence.toFixed(2)} danger=${r.danger?.toFixed(2)}\n    ${probs}`,
      );
    } catch (err) {
      console.log(`${JSON.stringify(label)} -> ERROR ${err instanceof Error ? err.message : err}`);
    }
  }
}

console.log(`\nTotal cost: $${totalCost.toFixed(6)}`);
