import type { JevAction } from "../../shared/types.ts";
import {
  ARENA,
  ATTACK_RANGE,
  BODY_RADIUS,
  DANGER_RANGE,
  ENEMY_DPS,
  PLAYER_DPS,
  distance,
} from "../game/simulation.ts";
import type { World } from "../game/types.ts";

type Props = { world: World; action: JevAction | null; enemyCount: number; onStart: () => void };

export function Arena({ world, action, enemyCount, onStart }: Props) {
  const { player, enemies, exit, status } = world;
  const inRange = (pos: { x: number; y: number }) => distance(pos, player.pos) <= ATTACK_RANGE;
  const anyInRange = enemies.some((e) => inRange(e.pos));
  const attacking = action === "APPROACH_ENEMY" && anyInRange;

  return (
    <div className="space-y-2">
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

          {/* The "dangerouslyClose" threshold Jev is told about. */}
          <circle
            cx={player.pos.x}
            cy={player.pos.y}
            r={DANGER_RANGE}
            className="fill-none stroke-amber-400/40"
            strokeDasharray="2 5"
          />

          {enemies.map((e) => (
            <g key={e.id}>
              <circle
                cx={e.pos.x}
                cy={e.pos.y}
                r={ATTACK_RANGE}
                className={inRange(e.pos) ? "fill-rose-500/15 stroke-rose-400" : "fill-none stroke-rose-400/45"}
                strokeDasharray={inRange(e.pos) ? undefined : "3 4"}
              />
              <circle cx={e.pos.x} cy={e.pos.y} r={BODY_RADIUS} className="fill-rose-500" />
              <HealthBar x={e.pos.x} y={e.pos.y - 22} value={e.health} colour="fill-rose-400" />
            </g>
          ))}

          <circle
            cx={player.pos.x}
            cy={player.pos.y}
            r={ATTACK_RANGE}
            className={attacking ? "fill-emerald-400/15 stroke-emerald-300" : "fill-none stroke-emerald-400/60"}
            strokeDasharray={attacking ? undefined : "3 4"}
          />
          <circle cx={player.pos.x} cy={player.pos.y} r={BODY_RADIUS} className="fill-emerald-400" />
          <HealthBar x={player.pos.x} y={player.pos.y - 22} value={player.health} colour="fill-emerald-300" />
          <text x={player.pos.x} y={player.pos.y + 40} textAnchor="middle" className="fill-slate-300 font-mono text-[10px]">
            {action ?? "…"}
          </text>

          <text x={12} y={ARENA.height - 12} className="fill-slate-400 font-mono text-[12px]">
            enemies {enemies.length}/{enemyCount} · health {Math.ceil(player.health)}
          </text>
        </svg>

        {status !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-950/70">
            {status !== "ready" && (
              <span className="text-2xl font-semibold">{status === "escaped" ? "Escaped!" : "Defeated"}</span>
            )}
            <button
              type="button"
              onClick={onStart}
              className="rounded-md bg-emerald-600 px-5 py-2 font-medium hover:bg-emerald-500"
            >
              {status === "ready" ? "Start" : "Play again"}
            </button>
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <li>
          <Swatch className="border-emerald-400" /> Player attack range {ATTACK_RANGE}px: hits one enemy for{" "}
          {PLAYER_DPS} hp/s, only while ordered to APPROACH_ENEMY
        </li>
        <li>
          <Swatch className="border-rose-400" /> Enemy attack range {ATTACK_RANGE}px: each hits for {ENEMY_DPS} hp/s
        </li>
        <li>
          <Swatch className="border-amber-400/60" /> "Dangerously close" ({DANGER_RANGE}px), as reported to Jev
        </li>
        <li>Rings turn solid while a hit is landing. Ranges are centre to centre.</li>
      </ul>
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span className={`mr-1 inline-block size-2.5 rounded-full border-2 border-dashed align-middle ${className}`} />;
}

function HealthBar({ x, y, value, colour }: { x: number; y: number; value: number; colour: string }) {
  return (
    <g>
      <rect x={x - 16} y={y} width={32} height={4} className="fill-slate-700" />
      <rect x={x - 16} y={y} width={(32 * Math.max(0, value)) / 100} height={4} className={colour} />
    </g>
  );
}
