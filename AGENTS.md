# Notes for coding agents

A small reference spike: React/Vite -> Cloudflare Worker -> OpenRouter -> Jev (a decision model). Read `README.md` first; `SPEC.md` is the original brief.

- **Where the interesting code is.** `worker/jev.ts` turns game state into a Jev request and back; `worker/openrouter.ts` holds the client. Everything under `src/` is a demo around them.
- **Experiment rather than guess.** Jev's behaviour is empirical: small wording changes in the state or action descriptions can move the probabilities a lot. The README's "Experimenting with Jev" section describes three cheap ways to find out what it actually does (`check-jev`, `balance`, `play-games`) and what they're each good for. They're all fine to run and extend.
- **Secrets.** `OPENROUTER_API_KEY` lives in `.dev.vars` (gitignored) and must never reach browser code (no `VITE_*` variables). The optional management key lives in `.env.admin`, never in `.dev.vars`, because Wrangler loads that file into the Worker.
- **Deploying creates real cloud resources and exposes a billed key.** Check with a human before running `npm run deploy` or `wrangler secret put`.
- **Before calling it done:** `npm run typecheck`.
