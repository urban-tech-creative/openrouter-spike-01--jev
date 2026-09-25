// The contract between the browser and the Worker. Deliberately provider-free:
// nothing here mentions OpenRouter.

export const JEV_ACTIONS = ["APPROACH_ENEMY", "EVADE", "SEEK_EXIT", "SEEK_HEALTH", "FREEZE", "WAIT"] as const;
export type JevAction = (typeof JEV_ACTIONS)[number];

export const DIRECTIONS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
export type Direction = (typeof DIRECTIONS)[number];

type Place = { distance: number; direction: Direction };

export type DecisionRequest = {
  instruction: string;
  playerHealth: number;
  nearestEnemy: (Place & { dangerouslyClose: boolean; frozen: boolean }) | null;
  enemiesRemaining: number;
  /** Unfrozen enemies close enough that FREEZE would catch them. */
  enemiesInFreezeRange: number;
  nearestHealthPack: Place | null;
  /** 0 when the freeze power is ready to use. */
  freezeRechargeSeconds: number;
  exit: Place;
};

export type DecisionResponse = {
  action: JevAction;
  /** Only the actions that were available this tick; the rest weren't offered to Jev. */
  offered: JevAction[];
  probabilities: Record<JevAction, number>;
  /** 0-1: how peaked the distribution is, not how correct the answer is. */
  confidence: number;
  /** Probability (0-1) that the character is in immediate danger, or null if not returned. */
  danger: number | null;
  latencyMs: number;
  costUsd: number | null;
};
