import { useCallback, useEffect, useRef, useState } from "react";
import { Arena } from "./components/Arena.tsx";
import { DebugPanel } from "./components/DebugPanel.tsx";
import { InstructionInput } from "./components/InstructionInput.tsx";
import { createWorld, step, toDecisionRequest } from "./game/simulation.ts";
import type { World } from "./game/types.ts";
import { useDecisionLoop } from "./lib/useDecisionLoop.ts";

const ENEMY_COUNT = createWorld().enemies.length;
const STARTING_INSTRUCTION = "Attack them. Be reckless.";

export default function App() {
  const [world, setWorld] = useState<World>(createWorld);
  const [instruction, setInstruction] = useState(STARTING_INSTRUCTION);
  const [epoch, setEpoch] = useState(0);

  const worldRef = useRef(world);
  worldRef.current = world;

  const buildRequest = useCallback(
    () => (worldRef.current.status === "running" ? toDecisionRequest(worldRef.current, instruction) : null),
    [instruction],
  );
  const loop = useDecisionLoop(buildRequest, epoch);

  // Render loop: moves every frame using the most recent decision, never
  // waiting on the network. Jev sets intent; this code does the moving.
  const actionRef = useRef(loop.lastDecision?.action ?? null);
  actionRef.current = loop.lastDecision?.action ?? null;
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loopFrame = (now: number) => {
      const dt = Math.min(now - last, 100); // don't jump after a background tab
      last = now;
      setWorld((w) => step(w, actionRef.current, dt));
      frame = requestAnimationFrame(loopFrame);
    };
    frame = requestAnimationFrame(loopFrame);
    return () => cancelAnimationFrame(frame);
  }, []);

  const applyInstruction = (next: string) => {
    setInstruction(next);
    setEpoch((e) => e + 1);
  };
  const reset = () => {
    setWorld(createWorld());
    setEpoch((e) => e + 1);
  };
  const start = () => {
    setWorld({ ...createWorld(), status: "running" });
    setEpoch((e) => e + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold">Jev Arena</h1>
          <p className="text-sm text-slate-400">
            You don't control the green character. Give it an order; Jev (via OpenRouter) picks one of four actions
            every ~500ms, and ordinary TypeScript carries it out.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]">
          <div className="space-y-3">
            <Arena world={world} action={loop.lastDecision?.action ?? null} enemyCount={ENEMY_COUNT} onStart={start} />
            <InstructionInput current={instruction} onApply={applyInstruction} onReset={reset} />
          </div>
          <DebugPanel instruction={instruction} loop={loop} />
        </div>
      </div>
    </div>
  );
}
