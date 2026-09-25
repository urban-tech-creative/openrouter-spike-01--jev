// Deterministic game logic. Jev picks an action; this file carries it out.
// Nothing in here knows about Jev, OpenRouter or React.

import type { DecisionRequest, Direction, JevAction } from "../../shared/types.ts";
import type { Vec, World } from "./types.ts";

export const ARENA = { width: 640, height: 420 };

// Exported so the UI can draw and label the real values rather than guesses.
export const PLAYER_SPEED = 110; // px/s: faster than enemies, so evading can work
export const ENEMY_SPEED = 45;
export const BODY_RADIUS = 13;
/** Centre-to-centre distance at which the player and enemies can hurt each other. Same for both sides. */
export const ATTACK_RANGE = 26;
/** Below this distance the state sent to Jev says the nearest enemy is "dangerouslyClose". */
export const DANGER_RANGE = 70;
const EXIT_RANGE = 22;
export const ENEMY_DPS = 6; // damage per second each enemy deals while in range
export const PLAYER_DPS = 60; // damage per second the player deals to one enemy when attacking

// Spread out so they arrive in ones and twos rather than all at once.
const ENEMY_SPAWNS: Vec[] = [
  { x: 300, y: 100 },
  { x: 430, y: 330 },
  { x: 240, y: 230 },
  { x: 520, y: 200 },
  { x: 590, y: 380 },
  { x: 160, y: 50 },
];

export function createWorld(): World {
  return {
    player: { pos: { x: 90, y: 330 }, health: 100 },
    enemies: ENEMY_SPAWNS.map((pos, i) => ({ id: i + 1, pos: { ...pos }, health: 100 })),
    exit: { x: 580, y: 60 },
    status: "ready", // nothing moves and no decisions are requested until Start
    elapsedMs: 0,
  };
}

export function step(world: World, action: JevAction | null, dtMs: number): World {
  if (world.status !== "running") return world;
  const dt = dtMs / 1000;

  let player = { ...world.player };
  let enemies = world.enemies.map((e) => ({ ...e }));
  const nearest = nearestEnemy(player.pos, enemies);

  // 1. Carry out Jev's latest decision.
  switch (action) {
    case "APPROACH_ENEMY":
      if (nearest) {
        if (distance(player.pos, nearest.pos) > ATTACK_RANGE * 0.8) {
          player.pos = moveToward(player.pos, nearest.pos, PLAYER_SPEED * dt);
        }
        if (distance(player.pos, nearest.pos) <= ATTACK_RANGE) {
          nearest.health -= PLAYER_DPS * dt;
        }
      }
      break;
    case "EVADE":
      if (nearest) player.pos = moveToward(player.pos, nearest.pos, -PLAYER_SPEED * dt);
      break;
    case "SEEK_EXIT":
      player.pos = moveToward(player.pos, world.exit, PLAYER_SPEED * dt);
      break;
    case "WAIT":
    case null:
      break;
  }
  player.pos = clampToArena(player.pos);
  enemies = enemies.filter((e) => e.health > 0);

  // 2. Enemies close in and hurt the player on contact.
  for (const enemy of enemies) {
    if (distance(enemy.pos, player.pos) > ATTACK_RANGE * 0.8) {
      enemy.pos = moveToward(enemy.pos, player.pos, ENEMY_SPEED * dt);
    }
    if (distance(enemy.pos, player.pos) <= ATTACK_RANGE) {
      player = { ...player, health: Math.max(0, player.health - ENEMY_DPS * dt) };
    }
  }
  separate(enemies);

  const status =
    player.health <= 0 ? "dead" : distance(player.pos, world.exit) <= EXIT_RANGE ? "escaped" : "running";

  return { ...world, player, enemies, status, elapsedMs: world.elapsedMs + dtMs };
}

/** Summarise the world into the small, human-readable state Jev decides on. */
export function toDecisionRequest(world: World, instruction: string): DecisionRequest {
  const { pos, health } = world.player;
  const nearest = nearestEnemy(pos, world.enemies);
  return {
    instruction,
    playerHealth: Math.round(health),
    nearestEnemy: nearest
      ? {
          distance: Math.round(distance(pos, nearest.pos)),
          direction: compass(pos, nearest.pos),
          dangerouslyClose: distance(pos, nearest.pos) <= DANGER_RANGE,
        }
      : null,
    exit: { distance: Math.round(distance(pos, world.exit)), direction: compass(pos, world.exit) },
  };
}

/** Push overlapping enemies apart so a crowd stays countable instead of stacking into one circle. */
function separate(enemies: { pos: Vec }[]): void {
  const minGap = BODY_RADIUS * 2;
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i].pos;
      const b = enemies[j].pos;
      const d = distance(a, b);
      if (d > 0 && d < minGap) {
        const push = (minGap - d) / 2 / d;
        const dx = (b.x - a.x) * push;
        const dy = (b.y - a.y) * push;
        enemies[i].pos = { x: a.x - dx, y: a.y - dy };
        enemies[j].pos = { x: b.x + dx, y: b.y + dy };
      }
    }
  }
}

function nearestEnemy<T extends { pos: Vec }>(from: Vec, enemies: T[]): T | undefined {
  let best: T | undefined;
  for (const e of enemies) {
    if (!best || distance(from, e.pos) < distance(from, best.pos)) best = e;
  }
  return best;
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Move `from` toward `to` by `amount` px (negative moves away), never overshooting. */
function moveToward(from: Vec, to: Vec, amount: number): Vec {
  const d = distance(from, to);
  if (d === 0) return from;
  const t = amount > 0 ? Math.min(amount, d) / d : amount / d;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

function clampToArena(p: Vec): Vec {
  const m = 12;
  return {
    x: Math.min(ARENA.width - m, Math.max(m, p.x)),
    y: Math.min(ARENA.height - m, Math.max(m, p.y)),
  };
}

const DIRECTIONS: Direction[] = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

// Screen y grows downward, so "north" is up the screen.
function compass(from: Vec, to: Vec): Direction {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const index = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS[(index + 8) % 8];
}
