export type Vec = { x: number; y: number };

export type Enemy = { id: number; pos: Vec; health: number; frozenMs: number };

export type HealthPack = { id: number; pos: Vec };

export type World = {
  player: { pos: Vec; health: number };
  enemies: Enemy[];
  healthPacks: HealthPack[];
  exit: Vec;
  /** 0 when the freeze power is ready. */
  freezeRechargeMs: number;
  /** Counts down after a freeze fires, so the UI can draw the blast. */
  freezeBlastMs: number;
  nextHealthPackMs: number;
  nextId: number;
  status: "ready" | "running" | "escaped" | "dead";
  elapsedMs: number;
};
