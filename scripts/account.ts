// Read-only OpenRouter account inspector. Command line only: none of this
// is reachable from the browser or the Worker.
//
//   npm run account                  # this API key: spend, limits, free-tier status
//   npm run account -- credits       # account balance       (management key)
//   npm run account -- activity      # last 30 days by model (management key)
//   npm run account -- generation <id>   # cost/latency of one request
//
// OPENROUTER_API_KEY comes from .dev.vars. The optional OPENROUTER_MANAGEMENT_KEY
// comes from .env.admin (gitignored). It lives in a separate file on purpose:
// Wrangler loads everything in .dev.vars into the Worker, and a management key
// can create and delete API keys, so it has no business being there.

import { OpenRouter } from "@openrouter/sdk";

try {
  process.loadEnvFile(".env.admin");
} catch {
  // Optional: only `credits` and `activity` need it.
}

const [command = "key", ...args] = process.argv.slice(2);
const usd = (n: number | null | undefined) => (n == null ? "–" : `$${n.toFixed(6)}`);

function client(kind: "api" | "management"): OpenRouter {
  const apiKey = kind === "api" ? process.env.OPENROUTER_API_KEY : process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!apiKey) {
    console.error(
      kind === "api"
        ? "OPENROUTER_API_KEY is not set in .dev.vars."
        : [
            "This command needs a management key: OpenRouter only exposes the account",
            "balance and activity to management keys, not ordinary API keys.",
            "",
            "  1. Create one at https://openrouter.ai/settings/management-keys",
            "  2. Put it in .env.admin (gitignored):  OPENROUTER_MANAGEMENT_KEY=...",
          ].join("\n"),
    );
    process.exit(1);
  }
  return new OpenRouter({ apiKey });
}

async function key() {
  const { data: k } = await client("api").apiKeys.getCurrentKeyMetadata();
  console.log("Local API key (.dev.vars). The deployed Worker uses its own key, set as a Worker secret.");
  console.log(`  name              ${k.label.startsWith("sk-") ? "(unnamed)" : k.label}`);
  console.log(`  free tier         ${k.isFreeTier ? "yes (never purchased credits)" : "no"}`);
  console.log(`  spend today       ${usd(k.usageDaily)}`);
  console.log(`  spend this week   ${usd(k.usageWeekly)}`);
  console.log(`  spend this month  ${usd(k.usageMonthly)}`);
  console.log(`  spend all time    ${usd(k.usage)}`);
  console.log(
    `  key spend limit   ${k.limit == null ? "none set" : `${usd(k.limit)} (${usd(k.limitRemaining)} left${k.limitReset ? `, resets ${k.limitReset}` : ""})`}`,
  );
  const f = k.freeModelDailyRequests;
  console.log(`  :free model reqs  ${f.used}/${f.limit} today`);
  if (k.limit == null) {
    console.log("\n  Tip: set a spend limit on this key before deploying (SPEC.md, 'Protecting the key').");
  }
}

async function credits() {
  const { data } = await client("management").credits.getCredits();
  console.log("Account balance");
  console.log(`  credits granted/purchased  ${usd(data.totalCredits)}`);
  console.log(`  used                       ${usd(data.totalUsage)}`);
  console.log(`  remaining                  ${usd(data.totalCredits - data.totalUsage)}`);
}

async function activity() {
  const res = await client("management").analytics.getUserActivity();
  const rows = res.data;
  if (!rows.length) return console.log("No activity in the last 30 completed UTC days (today isn't included yet).");
  console.log("date        requests  input tok   cost        model");
  for (const r of rows) {
    console.log(
      `${r.date.slice(0, 10)}  ${String(r.requests).padStart(8)}  ${String(r.promptTokens).padStart(9)}   ${usd(r.usage).padEnd(10)}  ${r.model}`,
    );
  }
}

async function generation(id: string | undefined) {
  if (!id) {
    console.error("Usage: npm run account -- generation <id>");
    process.exit(1);
  }
  const { data: g } = await client("api")
    .generations.getGeneration({ id })
    .catch((err: unknown) => {
      throw new Error(`${err instanceof Error ? err.message : err}\n(Stats can take ~10s to appear after a request.)`);
    });
  console.log(JSON.stringify(
    { id: g.id, model: g.model, provider: g.providerName, createdAt: g.createdAt, latencyMs: g.latency,
      tokensPrompt: g.tokensPrompt, tokensCompletion: g.tokensCompletion, cost: g.totalCost, app: g.httpReferer },
    null, 2,
  ));
}

const commands: Record<string, () => Promise<void>> = {
  key,
  credits,
  activity,
  generation: () => generation(args[0]),
};

if (!commands[command]) {
  console.error(`Unknown command "${command}". Try: key, credits, activity, generation <id>`);
  process.exit(1);
}
try {
  await commands[command]();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
