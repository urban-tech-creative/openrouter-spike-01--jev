// Validates POST /api/decide bodies before anything reaches Jev.
//
// Why this matters: the Worker is a public, unauthenticated proxy to a billed
// API, and Jev charges per input token. Without this, any string field (say a
// "direction") could be stuffed with pages of text, and a single call would
// cost many times the normal amount. So every field is checked against the
// shape the game actually sends, and the request is rebuilt from known fields
// only, meaning nothing unexpected is passed through to Jev.

import { DIRECTIONS, type DecisionRequest, type Direction } from "../shared/types.ts";

/** A real request is well under 1 KB, even with a 500-character instruction. */
export const MAX_BODY_BYTES = 4096;
const MAX_INSTRUCTION_CHARS = 500;
const MAX_DISTANCE = 1000; // the arena is 640 x 420, so no real distance comes close

export class InvalidRequest extends Error {}

export function parseDecisionRequest(body: unknown): DecisionRequest {
  const b = object(body, "body");
  const instruction = b.instruction;
  if (typeof instruction !== "string" || !instruction.trim() || instruction.length > MAX_INSTRUCTION_CHARS) {
    throw new InvalidRequest(`instruction must be a non-empty string of at most ${MAX_INSTRUCTION_CHARS} characters`);
  }

  const enemy = b.nearestEnemy === null ? null : object(b.nearestEnemy, "nearestEnemy");
  return {
    instruction,
    playerHealth: number(b.playerHealth, "playerHealth", 0, 100),
    nearestEnemy: enemy && {
      ...place(enemy, "nearestEnemy"),
      dangerouslyClose: boolean(enemy.dangerouslyClose, "nearestEnemy.dangerouslyClose"),
      frozen: boolean(enemy.frozen, "nearestEnemy.frozen"),
    },
    enemiesRemaining: number(b.enemiesRemaining, "enemiesRemaining", 0, 50),
    enemiesInFreezeRange: number(b.enemiesInFreezeRange, "enemiesInFreezeRange", 0, 50),
    nearestHealthPack: b.nearestHealthPack === null ? null : place(object(b.nearestHealthPack, "nearestHealthPack"), "nearestHealthPack"),
    freezeRechargeSeconds: number(b.freezeRechargeSeconds, "freezeRechargeSeconds", 0, 60),
    exit: place(object(b.exit, "exit"), "exit"),
  };
}

function place(value: Record<string, unknown>, name: string) {
  return {
    distance: number(value.distance, `${name}.distance`, 0, MAX_DISTANCE),
    direction: direction(value.direction, `${name}.direction`),
  };
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidRequest(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new InvalidRequest(`${name} must be a number from ${min} to ${max}`);
  }
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new InvalidRequest(`${name} must be true or false`);
  return value;
}

function direction(value: unknown, name: string): Direction {
  if (!(DIRECTIONS as readonly unknown[]).includes(value)) {
    throw new InvalidRequest(`${name} must be one of: ${DIRECTIONS.join(", ")}`);
  }
  return value as Direction;
}
