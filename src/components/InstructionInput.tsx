import { useState } from "react";

const PRESETS = [
  "Attack them. Be reckless.",
  "Stop fighting. Avoid everyone and get to the exit.",
  "Hold your position.",
  "Do whatever you think is best.",
];

type Props = { current: string; onApply: (instruction: string) => void; onReset: () => void };

// The instruction is applied on submit, not per keystroke, so Jev never
// decides on a half-typed order.
export function InstructionInput({ current, onApply, onReset }: Props) {
  const [draft, setDraft] = useState(current);

  const apply = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setDraft(trimmed);
      onApply(trimmed);
    }
  };

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Give the character an order…"
          aria-label="Instruction"
        />
        <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500" type="submit">
          Order
        </button>
        <button
          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          type="button"
          onClick={onReset}
        >
          Reset
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => apply(p)}
            className={`rounded-full border px-3 py-1 text-xs ${
              p === current ? "border-emerald-500 text-emerald-300" : "border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
