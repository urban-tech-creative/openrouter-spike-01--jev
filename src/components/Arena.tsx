import type { JevAction } from "../../shared/types.ts";
import {
  ARENA,
  ATTACK_RANGE,
  BODY_RADIUS,
  DANGER_RANGE,
  ENEMY_DPS,
  FREEZE_RADIUS,
  FREEZE_RECHARGE_SECONDS,
  FREEZE_SECONDS,
  HEALTH_PACK_HEAL,
  PLAYER_DPS,
  distance,
} from "../game/simulation.ts";
import type { World } from "../game/types.ts";

type Props = {
  world: World;
  action: JevAction | null;
  confidence: number | null;
  enemyCount: number;
  onStart: () => void;
};

export function Arena({ world, action, confidence, enemyCount, onStart }: Props) {
  const { player, enemies, healthPacks, exit, status } = world;
  const inRange = (pos: { x: number; y: number }) => distance(pos, player.pos) <= ATTACK_RANGE;
  const hitting = (e: (typeof enemies)[number]) => e.frozenMs === 0 && inRange(e.pos);
  const attacking = action === "APPROACH_ENEMY" && enemies.some((e) => inRange(e.pos));
  const freezeReady = world.freezeRechargeMs === 0;
  const blast = world.freezeBlastMs / 400; // 1 -> 0 as the blast fades

  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-[640px]">
        <svg
          viewBox={`0 0 ${ARENA.width} ${ARENA.height}`}
          className="w-full rounded-lg border border-slate-800 bg-slate-900"
          role="img"
          aria-label="Arena"
          // Live state for scripts/play-games.ts (and any other automation) to read,
          // so it doesn't have to scrape the rendered text.
          data-status={status}
          data-action={action ?? ""}
          data-health={Math.ceil(player.health)}
          data-enemies={enemies.length}
          data-frozen={enemies.filter((e) => e.frozenMs > 0).length}
          data-health-packs={healthPacks.length}
          data-freeze-recharge={Math.ceil(world.freezeRechargeMs / 1000)}
          data-elapsed={Math.round(world.elapsedMs)}
        >
          <rect x={exit.x - 22} y={exit.y - 22} width={44} height={44} rx={6} className="fill-sky-500/20 stroke-sky-400" />
          <text x={exit.x} y={exit.y + 4} textAnchor="middle" className="fill-sky-300 text-[11px] font-semibold">
            EXIT
          </text>

          {healthPacks.map((h) => (
            <g key={h.id} transform={`translate(${h.pos.x} ${h.pos.y})`}>
              <rect x={-10} y={-10} width={20} height={20} rx={4} className="fill-lime-400/20 stroke-lime-400" />
              <path d="M-2.5 -6.5h5v4h4v5h-4v4h-5v-4h-4v-5h4z" className="fill-lime-300" />
            </g>
          ))}

          {/* The "dangerouslyClose" threshold Jev is told about. */}
          <circle cx={player.pos.x} cy={player.pos.y} r={DANGER_RANGE} className="fill-none stroke-amber-400/40" strokeDasharray="2 5" />

          {/* Freeze reach, shown only while the power is ready to use. */}
          {freezeReady && (
            <circle cx={player.pos.x} cy={player.pos.y} r={FREEZE_RADIUS} className="fill-none stroke-cyan-400/50" strokeDasharray="8 6" />
          )}
          {blast > 0 && (
            <circle
              cx={player.pos.x}
              cy={player.pos.y}
              r={FREEZE_RADIUS * (1.1 - blast * 0.3)}
              className="fill-cyan-300 stroke-cyan-200"
              fillOpacity={blast * 0.35}
              strokeOpacity={blast}
            />
          )}

          {enemies.map((e) => {
            const frozen = e.frozenMs > 0;
            return (
              <g key={e.id}>
                {!frozen && (
                  <circle
                    cx={e.pos.x}
                    cy={e.pos.y}
                    r={ATTACK_RANGE}
                    className={hitting(e) ? "fill-rose-500/15 stroke-rose-400" : "fill-none stroke-rose-400/45"}
                    strokeDasharray={hitting(e) ? undefined : "3 4"}
                  />
                )}
                <circle
                  cx={e.pos.x}
                  cy={e.pos.y}
                  r={BODY_RADIUS}
                  className={frozen ? "fill-cyan-200 stroke-cyan-400" : "fill-rose-500"}
                  strokeWidth={2}
                />
                {frozen && (
                  <text x={e.pos.x} y={e.pos.y + 4} textAnchor="middle" className="fill-cyan-700 font-mono text-[10px] font-bold">
                    {Math.ceil(e.frozenMs / 1000)}
                  </text>
                )}
                <HealthBar x={e.pos.x} y={e.pos.y - 22} value={e.health} colour="fill-rose-400" />
              </g>
            );
          })}

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

      {/* Status in normal-sized text: in the SVG it shrinks with the arena and is unreadable on a phone. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-slate-400">
        <span className="text-emerald-300">{action ?? "…"}</span>
        {confidence !== null && <span>conf {confidence.toFixed(2)}</span>}
        <span>hp {Math.ceil(player.health)}</span>
        <span>
          enemies {enemies.length}/{enemyCount}
        </span>
        <span className={freezeReady ? "text-cyan-300" : undefined}>
          freeze {freezeReady ? "READY" : `${Math.ceil(world.freezeRechargeMs / 1000)}s`}
        </span>
      </div>
    </div>
  );
}

/** What the rings and numbers mean, using the same constants the simulation enforces. */
export function ArenaLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      <li>
        <Swatch className="border-emerald-400" /> Player attack range {ATTACK_RANGE}px: hits one enemy for {PLAYER_DPS}{" "}
        hp/s, only while ordered to APPROACH_ENEMY
      </li>
      <li>
        <Swatch className="border-rose-400" /> Enemy attack range {ATTACK_RANGE}px: each hits for {ENEMY_DPS} hp/s
      </li>
      <li>
        <Swatch className="border-cyan-400" /> Freeze reach {FREEZE_RADIUS}px (shown while ready): stops enemies for{" "}
        {FREEZE_SECONDS}s, recharges in {FREEZE_RECHARGE_SECONDS}s
      </li>
      <li>
        <Swatch className="border-lime-400 border-solid" /> Health pack: +{HEALTH_PACK_HEAL} hp, appears every 6–8s (max 2)
      </li>
      <li>
        <Swatch className="border-amber-400/60" /> "Dangerously close" ({DANGER_RANGE}px), as reported to Jev
      </li>
      <li>Rings turn solid while a hit is landing. Ranges are centre to centre.</li>
    </ul>
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
