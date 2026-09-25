import type { JevAction } from "../../shared/types.ts";
import { ARENA } from "../game/simulation.ts";
import type { World } from "../game/types.ts";

type Props = { world: World; action: JevAction | null };

export function Arena({ world, action }: Props) {
  const { player, enemies, exit, status } = world;
  return (
    <div className="relative w-full max-w-[640px]">
      <svg
        viewBox={`0 0 ${ARENA.width} ${ARENA.height}`}
        className="w-full rounded-lg border border-slate-800 bg-slate-900"
        role="img"
        aria-label="Arena"
      >
        <rect x={exit.x - 22} y={exit.y - 22} width={44} height={44} rx={6} className="fill-sky-500/20 stroke-sky-400" />
        <text x={exit.x} y={exit.y + 4} textAnchor="middle" className="fill-sky-300 text-[11px] font-semibold">
          EXIT
        </text>

        {enemies.map((e) => (
          <g key={e.id}>
            <circle cx={e.pos.x} cy={e.pos.y} r={13} className="fill-rose-500" />
            <HealthBar x={e.pos.x} y={e.pos.y - 22} value={e.health} colour="fill-rose-400" />
          </g>
        ))}

        <circle cx={player.pos.x} cy={player.pos.y} r={13} className="fill-emerald-400" />
        <HealthBar x={player.pos.x} y={player.pos.y - 22} value={player.health} colour="fill-emerald-300" />
        <text x={player.pos.x} y={player.pos.y + 30} textAnchor="middle" className="fill-slate-300 font-mono text-[10px]">
          {action ?? "…"}
        </text>
      </svg>

      {status !== "running" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/70 text-2xl font-semibold">
          {status === "escaped" ? "Escaped!" : "Defeated"}
        </div>
      )}
    </div>
  );
}

function HealthBar({ x, y, value, colour }: { x: number; y: number; value: number; colour: string }) {
  return (
    <g>
      <rect x={x - 16} y={y} width={32} height={4} className="fill-slate-700" />
      <rect x={x - 16} y={y} width={(32 * Math.max(0, value)) / 100} height={4} className={colour} />
    </g>
  );
}
