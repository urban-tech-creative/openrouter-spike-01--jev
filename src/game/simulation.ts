// Deterministic game logic. Jev picks an action; this file carries it out.
// Nothing in here knows about Jev, OpenRouter or React.

import type { DecisionRequest, Direction, JevAction } from "../../shared/types.ts";
import type { Vec, World } from "./types.ts";

export const ARENA = { width: 640, height: 420 };

const PLAYER_SPEED = 110; // px/s: faster than enemies, so evading can work
const ENEMY_SPEED = 45;
const CONTACT_RANGE = 26;
const DANGER_RANGE = 70;
const EXIT_RANGE = 22;
const ENEMY_DPS = 14; // damage per second each enemy deals in contact
const PLAYER_DPS = 45; // damage per second the player deals when attacking

export function createWorld(): World {
  return {
    player: { pos: { x: 90, y: 330 }, health: 100 },
    enemies: [
      { id: 1, pos: { x: 330, y: 110 }, health: 100 },
      { id: 2, pos: { x: 430, y: 340 }, health: 100 },
    ],
    exit: { x: 580, y: 60 },
    status: "running",
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
        if (distance(player.pos, nearest.pos) > CONTACT_RANGE * 0.8) {
          player.pos = moveToward(player.pos, nearest.pos, PLAYER_SPEED * dt);
        }
        if (distance(player.pos, nearest.pos) <= CONTACT_RANGE) {
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
    if (distance(enemy.pos, player.pos) > CONTACT_RANGE * 0.8) {
      enemy.pos = moveToward(enemy.pos, player.pos, ENEMY_SPEED * dt);
    }
    if (distance(enemy.pos, player.pos) <= CONTACT_RANGE) {
      player = { ...player, health: Math.max(0, player.health - ENEMY_DPS * dt) };
    }
  }

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

function nearestEnemy<T extends { pos: Vec }>(from: Vec, enemies: T[]): T | undefined {
  let best: T | undefined;
  for (const e of enemies) {
    if (!best || distance(from, e.pos) < distance(from, best.pos)) best = e;
  }
  return best;
}

function distance(a: Vec, b: Vec): number {
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
