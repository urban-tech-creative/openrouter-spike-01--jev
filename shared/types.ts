// The contract between the browser and the Worker. Deliberately provider-free:
// nothing here mentions OpenRouter.

export const JEV_ACTIONS = ["APPROACH_ENEMY", "EVADE", "SEEK_EXIT", "WAIT"] as const;
export type JevAction = (typeof JEV_ACTIONS)[number];

export type Direction = "north" | "north-east" | "east" | "south-east" | "south" | "south-west" | "west" | "north-west";

export type DecisionRequest = {
  instruction: string;
  playerHealth: number;
  nearestEnemy: {
    distance: number;
    direction: Direction;
    dangerouslyClose: boolean;
  } | null;
  exit: {
    distance: number;
    direction: Direction;
  };
};

export type DecisionResponse = {
  action: JevAction;
  probabilities: Record<JevAction, number>;
  /** 0-1: how peaked the distribution is, not how correct the answer is. */
  confidence: number;
  /** Probability (0-1) that the character is in immediate danger, or null if not returned. */
  danger: number | null;
  latencyMs: number;
  costUsd: number | null;
};
