// Plays real games in a headless browser and logs what Jev decided, moment by
// moment. The whole system is live: React app -> Worker -> OpenRouter -> Jev.
//
//   npm run dev                                  # in another terminal first
//   npm run play-games                           # a few default orders, one game each
//   npm run play-games -- "Hide in a corner." "Protect your health."
//   npm run play-games -- --runs 3 --shots       # repeat each order; save end screenshots
//
// This answers "what does Jev actually do over a whole game?": timing, tool use,
// and behaviour that only shows up over time, such as dithering between two
// actions or waiting while being hit. Each game costs about $0.001.
//
// For "how does Jev read one situation?", use `npm run check-jev` instead:
// it's faster, cheaper and controlled. One game is a single sample.
//
// Reads the arena's data-* attributes (see src/components/Arena.tsx), not its
// rendered text. Needs Playwright's Chromium: `npx playwright install chromium`.

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.ARENA_URL ?? "http://localhost:5199/";
const GAME_TIMEOUT_MS = 60_000;
const POLL_MS = 100;

const DEFAULT_ORDERS = [
  "Attack them. Be reckless.",
  "Stay alive at all costs.",
  "Use your freeze whenever you can.",
  "Do whatever you think is best.",
];

// --- arguments ------------------------------------------------------------
const argv = process.argv.slice(2);
const runs = Number(flagValue("--runs") ?? 1);
const shots = argv.includes("--shots");
const orders = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--runs");
if (!orders.length) orders.push(...DEFAULT_ORDERS);

function flagValue(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

// --- is the app running? ----------------------------------------------------
try {
  await fetch(URL);
} catch {
  console.error(`Nothing is answering at ${URL}. Start the app first: npm run dev`);
  process.exit(1);
}

type Snapshot = {
  status: string;
  action: string;
  health: number;
  enemies: number;
  frozen: number;
  healthPacks: number;
  freezeRecharge: number;
  elapsed: number;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

// Every /api/decide response passes through here, so cost and errors are exact.
let calls = 0;
let apiErrors = 0;
let costUsd = 0;
page.on("response", async (res) => {
  if (!res.url().includes("/api/decide")) return;
  calls++;
  if (!res.ok()) return void apiErrors++;
  costUsd += ((await res.json().catch(() => ({}))) as { costUsd?: number }).costUsd ?? 0;
});
page.on("pageerror", (err) => console.error("page error:", err.message));

await page.goto(URL);
const arena = page.getByRole("img", { name: "Arena" });

const read = (): Promise<Snapshot> =>
  arena.evaluate((svg) => {
    const d = (name: string) => svg.getAttribute(`data-${name}`) ?? "";
    return {
      status: d("status"),
      action: d("action") || "…",
      health: Number(d("health")),
      enemies: Number(d("enemies")),
      frozen: Number(d("frozen")),
      healthPacks: Number(d("health-packs")),
      freezeRecharge: Number(d("freeze-recharge")),
      elapsed: Number(d("elapsed")),
    };
  });

const summary: string[] = [];
if (shots) mkdirSync("experiments", { recursive: true });

for (const order of orders) {
  for (let run = 1; run <= runs; run++) {
    // Give the order the way a person would: type it and submit, then Start.
    await page.getByLabel("Instruction").fill(order);
    await page.getByLabel("Instruction").press("Enter");
    await page.getByRole("button", { name: /^(Start|Play again)$/ }).click();

    const before = { calls, apiErrors, costUsd };
    let prev = await read();
    let freezes = 0;
    let pickups = 0;
    const timeline: string[] = [];
    const started = Date.now();

    console.log(`\n## "${order}"${runs > 1 ? ` (run ${run}/${runs})` : ""}`);

    while (Date.now() - started < GAME_TIMEOUT_MS) {
      await page.waitForTimeout(POLL_MS);
      const now = await read();
      const t = `${(now.elapsed / 1000).toFixed(1)}s`.padStart(6);
      const hud = `hp ${now.health}, enemies ${now.enemies}${now.frozen ? ` (${now.frozen} frozen)` : ""}, freeze ${now.freezeRecharge ? `${now.freezeRecharge}s` : "ready"}`;

      if (now.freezeRecharge > prev.freezeRecharge) {
        freezes++;
        timeline.push(`${t}  ❄ froze ${now.frozen} enem${now.frozen === 1 ? "y" : "ies"}`);
      }
      if (now.health > prev.health + 5) {
        pickups++;
        timeline.push(`${t}  + health pack (${prev.health} -> ${now.health} hp)`);
      }
      if (now.action !== prev.action) timeline.push(`${t}  ${now.action.padEnd(15)} ${hud}`);
      prev = now;

      if (now.status !== "running") break;
    }

    const outcome = prev.status === "running" ? "timed out" : prev.status;
    console.log(timeline.map((l) => `  ${l}`).join("\n"));
    console.log(`  => ${outcome.toUpperCase()} at ${(prev.elapsed / 1000).toFixed(1)}s, ${prev.health} hp, ${prev.enemies} enemies left`);

    if (shots) {
      const file = `experiments/${Date.now()}-${order.replace(/\W+/g, "-").slice(0, 40)}.png`;
      await arena.screenshot({ path: file });
      console.log(`  screenshot: ${file}`);
    }

    summary.push(
      [
        order.slice(0, 38).padEnd(38),
        outcome.padEnd(9),
        `${(prev.elapsed / 1000).toFixed(1)}s`.padStart(6),
        String(prev.health).padStart(4),
        String(prev.enemies).padStart(6),
        String(freezes).padStart(8),
        String(pickups).padStart(6),
        String(calls - before.calls).padStart(6),
        `$${(costUsd - before.costUsd).toFixed(5)}`.padStart(9),
        apiErrors - before.apiErrors ? `  ${apiErrors - before.apiErrors} API errors` : "",
      ].join(" "),
    );
  }
}

console.log(`\n${"order".padEnd(38)} ${"outcome".padEnd(9)}   time   hp  left  freezes  packs  calls      cost`);
console.log(summary.join("\n"));
await browser.close();
