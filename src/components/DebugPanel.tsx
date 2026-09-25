import { JEV_ACTIONS } from "../../shared/types.ts";
import type { DecisionLoopState } from "../lib/useDecisionLoop.ts";

type Props = { instruction: string; loop: DecisionLoopState };

export function DebugPanel({ instruction, loop }: Props) {
  const d = loop.lastDecision;
  return (
    <aside className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
      <Section title="Instruction">
        <p className="text-slate-200">“{instruction}”</p>
      </Section>

      <Section title="Confidence">
        {/* Confidence = how peaked the distribution is, not how correct it is.
            Decisive orders give high confidence; conflicted ones give low. */}
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-4xl font-semibold tabular-nums">{d ? d.confidence.toFixed(2) : "–"}</span>
          <span className="text-slate-400">{d ? confidenceLabel(d.confidence) : "waiting for first decision"}</span>
        </div>
        <Bar value={d?.confidence ?? 0} className="bg-amber-400" />
      </Section>

      <Section title="Action probabilities">
        <div className="space-y-1.5">
          {JEV_ACTIONS.map((a) => {
            const p = d?.probabilities[a] ?? 0;
            const chosen = d?.action === a;
            return (
              <div key={a} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2">
                <span className={`font-mono text-xs ${chosen ? "text-emerald-300" : "text-slate-400"}`}>
                  {chosen ? "▶ " : ""}
                  {a}
                </span>
                <Bar value={p} className={chosen ? "bg-emerald-400" : "bg-slate-500"} />
                <span className="text-right font-mono text-xs tabular-nums">{p.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Immediate danger? (second question, same request)">
        <div className="grid grid-cols-[1fr_3rem] items-center gap-2">
          <Bar value={d?.danger ?? 0} className="bg-rose-400" />
          <span className="text-right font-mono text-xs tabular-nums">{d?.danger?.toFixed(2) ?? "–"}</span>
        </div>
      </Section>

      <Section title="Request">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-slate-400">in flight</dt>
          <dd>{loop.inFlight ? "yes" : "no"}</dd>
          <dt className="text-slate-400">latency</dt>
          <dd>{d ? `${d.latencyMs} ms` : "–"}</dd>
          <dt className="text-slate-400">requests / skipped ticks</dt>
          <dd>
            {loop.requests} / {loop.skippedTicks}
          </dd>
          <dt className="text-slate-400">session cost</dt>
          <dd>${loop.totalCostUsd.toFixed(6)}</dd>
        </dl>
        {loop.error && <p className="mt-2 rounded bg-rose-950 px-2 py-1 font-mono text-xs text-rose-300">{loop.error}</p>}
      </Section>

      <Section title="State sent to Jev">
        <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
          {loop.lastRequest ? JSON.stringify(loop.lastRequest, null, 2) : "–"}
        </pre>
      </Section>
    </aside>
  );
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return "decisive";
  if (c >= 0.5) return "leaning";
  return "torn";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Bar({ value, className }: { value: number; className: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
      <div className={`h-full transition-[width] duration-300 ${className}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
