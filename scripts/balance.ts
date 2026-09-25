// Offline balance runner: plays the game thousands of times with no Jev and no
// network, using scripted stand-in policies instead.
//
//   npm run balance                # 200 games per policy
//   npm run balance -- 1000        # more games
//
// This answers "are the game rules sound?", which is a question about the
// game, not Jev. Test those separately: if every policy wins, the tools don't
// matter, and nothing Jev does with them will tell you anything.
//
// Games are seeded, so the same seed plays the same game under every policy
// and a rule change can be compared like for like. It runs because
// src/game/simulation.ts is plain functions with no React or browser.

import { createWorld, step, toDecisionRequest } from "../src/game/simulation.ts";
import type { DecisionRequest, JevAction } from "../shared/types.ts";

// Stand-ins for Jev. Each is a hypothesis about how a decent player might act,
// so edit or add freely. Keep them simple: the point is to bracket what's
// possible (never uses a tool vs. uses it well), not to play optimally.
const policies: Record<string, (s: DecisionRequest) => JevAction> = {
  "charge in, nothing else": () => "APPROACH_ENEMY",
  "charge + freeze crowds": (s) => (canFreeze(s) ? "FREEZE" : "APPROACH_ENEMY"),
  "charge + heal when hurt": (s) => (needsHealth(s) ? "SEEK_HEALTH" : "APPROACH_ENEMY"),
  "charge + freeze + heal": (s) => (canFreeze(s) ? "FREEZE" : needsHealth(s) ? "SEEK_HEALTH" : "APPROACH_ENEMY"),
  "only evade": () => "EVADE",
};

const canFreeze = (s: DecisionRequest) => s.freezeRechargeSeconds === 0 && s.enemiesInFreezeRange >= 2;
const needsHealth = (s: DecisionRequest) => s.playerHealth < 50 && s.nearestHealthPack !== null;

const GAMES = Number(process.argv[2] ?? 200);
const FRAME_MS = 16;
const DECISION_EVERY_MS = 400; // roughly Jev's real cadence: new intent a few times a second
const TIME_LIMIT_MS = 60_000;

// Small deterministic PRNG, so seed N is the same game every time.
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

console.log(`${GAMES} seeded games per policy, ${TIME_LIMIT_MS / 1000}s limit\n`);
console.log("policy                     cleared  died  timed out  avg length  avg hp if cleared");

for (const [name, policy] of Object.entries(policies)) {
  let cleared = 0;
  let died = 0;
  const lengths: number[] = [];
  const hpLeft: number[] = [];

  for (let seed = 1; seed <= GAMES; seed++) {
    const random = seeded(seed);
    let world = { ...createWorld(), status: "running" as const } as ReturnType<typeof createWorld>;
    let action: JevAction = "WAIT";
    let untilDecision = 0;

    while (world.status === "running" && world.enemies.length > 0 && world.elapsedMs < TIME_LIMIT_MS) {
      untilDecision -= FRAME_MS;
      if (untilDecision <= 0) {
        action = policy(toDecisionRequest(world, ""));
        untilDecision = DECISION_EVERY_MS;
      }
      world = step(world, action, FRAME_MS, random);
    }

    lengths.push(world.elapsedMs / 1000);
    if (world.status === "dead") died++;
    else if (world.enemies.length === 0) {
      cleared++;
      hpLeft.push(world.player.health);
    }
  }

  const pct = (n: number) => `${Math.round((100 * n) / GAMES)}%`.padStart(4);
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
  console.log(
    `${name.padEnd(26)} ${pct(cleared).padStart(7)} ${pct(died).padStart(5)} ${pct(GAMES - cleared - died).padStart(10)} ${`${avg(lengths)}s`.padStart(11)} ${avg(hpLeft).padStart(18)}`,
  );
}
